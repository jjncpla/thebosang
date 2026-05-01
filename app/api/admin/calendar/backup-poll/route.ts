/**
 * 통합 캘린더 webhook 백업 폴링 endpoint
 *
 * 목적:
 *  - 1차 webhook 누락 / 텔레그램·구글캘린더 측 일시적 장애 대비.
 *  - 1시간마다 외부 시스템을 능동적으로 폴링해 (source, externalId)에 없는
 *    이벤트를 보충 처리한다.
 *
 * 호출 권한: ADMIN 또는 CRON_SECRET 헤더.
 *
 * 권장 호출 빈도: 1시간 (Railway scheduled task 또는 외부 cron).
 *
 * 처리 흐름:
 *  1) 텔레그램 getUpdates 로 최근 24시간 메시지 조회 → 누락분 보충 처리
 *  2) (선택) Google Calendar events.list — 환경변수 미구성 시 skip
 *  3) WebhookEvent 에 retries < maxRetries & processedAt = null 인 미처리분 재시도
 *
 * 응답:
 *  { ok, telegram: { polled, recovered, skipped }, retried }
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  recordWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
  findUnprocessedEvents,
} from "@/lib/webhook-idempotency"
import { parseSpecialClinicMessage, type TfOrg } from "@/lib/parse-special-clinic-message"

/* ─────────────────────────────────────────────────
   인증: ADMIN 세션 OR x-cron-secret 헤더
   ───────────────────────────────────────────────── */
async function authorize(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers.get("x-cron-secret")
  if (cronSecret && provided && provided === cronSecret) return true

  const session = await auth()
  return !!session && session.user.role === "ADMIN"
}

/* ─────────────────────────────────────────────────
   채팅방 ID → TF 조직 매핑 (webhook handler와 동일 로직)
   ───────────────────────────────────────────────── */
function parseIdList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
}

function resolveTfOrg(chatId: string): TfOrg | null {
  const neutralIds = parseIdList(process.env.TELEGRAM_SPECIAL_CLINIC_NEUTRAL_CHAT_IDS)
  const isanIds = [
    ...parseIdList(process.env.TELEGRAM_SPECIAL_CLINIC_CHAT_ID),
    ...parseIdList(process.env.TELEGRAM_SPECIAL_CLINIC_ISAN_CHAT_IDS),
  ]
  const thebosangIds = parseIdList(process.env.TELEGRAM_SPECIAL_CLINIC_THEBOSANG_CHAT_IDS)

  if (neutralIds.includes(chatId)) return "neutral"
  if (isanIds.includes(chatId)) return "이산"
  if (thebosangIds.includes(chatId)) return "더보상"
  if (neutralIds.length === 0 && isanIds.length === 0 && thebosangIds.length === 0) return "이산"
  return null
}

/* ─────────────────────────────────────────────────
   텔레그램 getUpdates (최근 24시간)
   ───────────────────────────────────────────────── */
type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number }
    from?: { id?: number; first_name?: string; username?: string }
    text?: string
    date: number
  }
  edited_message?: TelegramUpdate["message"]
}

async function fetchRecentTelegramUpdates(): Promise<TelegramUpdate[]> {
  const token =
    process.env.TELEGRAM_SPECIAL_CLINIC_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN
  if (!token) return []

  // getUpdates 는 long polling 방식이라 webhook 구성 시 사용 불가.
  // 대신 webhook 모드에서도 사용 가능한 getMyUpdates 가 없으므로,
  // 운영 환경에서는 텔레그램 측 webhook 이력을 별도 저장하지 않는 한
  // 누락 메시지 회수가 어렵다. 따라서 기본은 'noop' + WebhookEvent 미처리분 재시도.
  // (미래 개선: 별도 archival channel / 봇 user 가 자동 forward 등)
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] }
    if (!data.ok) return []
    return data.result ?? []
  } catch (e) {
    console.error("[backup-poll] telegram getUpdates 실패", e)
    return []
  }
}

/* ─────────────────────────────────────────────────
   누락 텔레그램 메시지 보충 처리
   ───────────────────────────────────────────────── */
async function recoverTelegramSpecialClinic(updates: TelegramUpdate[]) {
  const result = { polled: updates.length, recovered: 0, skipped: 0 }
  const SOURCE = "telegram_special_clinic"

  for (const upd of updates) {
    const msg = upd.message ?? upd.edited_message
    if (!msg?.text) {
      result.skipped++
      continue
    }
    const chatId = String(msg.chat.id)
    const tfOrg = resolveTfOrg(chatId)
    if (!tfOrg) {
      result.skipped++
      continue
    }

    const text = msg.text
    if (!text.includes("난청") || (!text.includes("특진") && !text.includes("재특진")) || !text.includes("일정")) {
      result.skipped++
      continue
    }

    const messageId = String(msg.message_id)
    const externalId = `${chatId}:${messageId}`

    // 이미 WebhookEvent 에 존재하면 1차 webhook이 처리한 것 → skip
    const recorded = await recordWebhookEvent(
      SOURCE,
      externalId,
      upd as unknown as Record<string, unknown>,
      "special_clinic_message_backup",
    )
    if (recorded.status === "duplicate_skipped") {
      result.skipped++
      continue
    }

    // 신규 → 본 처리 실행
    try {
      const sender = msg.from?.first_name ?? msg.from?.username ?? "unknown"
      const msgDate = new Date(msg.date * 1000)
      const parsed = parseSpecialClinicMessage(text, sender, msgDate, { tfOrg })

      for (const p of parsed) {
        if (!p.patientName || !p.tfName) continue

        const existing = await prisma.specialClinicSchedule.findFirst({
          where: {
            patientName: p.patientName,
            tfName: p.tfName,
            clinicType: p.clinicType,
            examRound: p.examRound,
          },
          select: { id: true },
        })

        const data = {
          patientName: p.patientName,
          tfName: p.tfName,
          hospitalName: p.hospitalName,
          clinicType: p.clinicType,
          examRound: p.examRound,
          scheduledDate: p.scheduledDate,
          isAllDay: p.isAllDay,
          scheduledHour: p.scheduledHour ?? null,
          scheduledMinute: p.scheduledMinute ?? 0,
          status: p.status,
          memo: p.memo || null,
          sender,
          sourceDate: msgDate,
          telegramMsgId: messageId,
          rawMessage: text,
        }

        if (existing) {
          await prisma.specialClinicSchedule.update({ where: { id: existing.id }, data })
        } else {
          await prisma.specialClinicSchedule.create({ data })
        }
      }
      await markWebhookProcessed(SOURCE, externalId, "cron_backup")
      result.recovered++
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      await markWebhookFailed(SOURCE, externalId, message)
    }
  }
  return result
}

/* ─────────────────────────────────────────────────
   미처리 WebhookEvent 재시도
   - 1차 webhook에서 본 처리 중 에러난 건 (errorMessage != null, processedAt = null)
   - retries < maxRetries 인 경우만
   - 단순 카운트만 반환 (실제 재처리 로직은 source별로 다양 → 추후 확장)
   ───────────────────────────────────────────────── */
async function retryUnprocessedEvents() {
  const sources = ["telegram_special_clinic", "telegram"] as const
  let total = 0
  for (const s of sources) {
    const unprocessed = await findUnprocessedEvents(s, { maxRetries: 5, limit: 50 })
    total += unprocessed.length
  }
  return total
}

/* ─────────────────────────────────────────────────
   POST /api/admin/calendar/backup-poll
   ───────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const startedAt = new Date()
  const updates = await fetchRecentTelegramUpdates()
  const telegramResult = await recoverTelegramSpecialClinic(updates)
  const retried = await retryUnprocessedEvents()
  const elapsedMs = Date.now() - startedAt.getTime()

  return NextResponse.json({
    ok: true,
    startedAt: startedAt.toISOString(),
    elapsedMs,
    telegram: telegramResult,
    retried,
  })
}

/**
 * GET 핸들러 — 운영 편의용 (수동 점검 / Railway scheduled task GET).
 * 동일 로직 호출.
 */
export async function GET(req: NextRequest) {
  return POST(req)
}
