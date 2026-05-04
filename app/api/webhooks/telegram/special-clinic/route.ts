import { parseSpecialClinicMessage, type TfOrg } from "@/lib/parse-special-clinic-message"
import { prisma } from "@/lib/prisma"
import {
  recordWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
} from "@/lib/webhook-idempotency"
import { NextRequest, NextResponse } from "next/server"

const WEBHOOK_SOURCE = "telegram_special_clinic" as const

/**
 * 채팅방 ID → TF 조직 매핑을 환경변수에서 구성.
 * - TELEGRAM_SPECIAL_CLINIC_NEUTRAL_CHAT_IDS : 이산·더보상 혼재 통합방 (TF명 원본 보존)
 * - TELEGRAM_SPECIAL_CLINIC_ISAN_CHAT_IDS : 이산TF 전용방 (TF명에 '이산' 접두어 자동 부여)
 * - TELEGRAM_SPECIAL_CLINIC_CHAT_ID : 기존 단수 변수 (이산 전용방 하위호환)
 * - TELEGRAM_SPECIAL_CLINIC_THEBOSANG_CHAT_IDS : 더보상 전용방 ('더보상' 접두어 자동 부여)
 * 각 변수는 콤마 구분 리스트. 등록되지 않은 chat_id 메시지는 무시.
 */
function parseIdList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
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

  if (neutralIds.includes(chatId)) return 'neutral'
  if (isanIds.includes(chatId)) return '이산'
  if (thebosangIds.includes(chatId)) return '더보상'

  // 환경변수가 하나도 설정되지 않은 경우엔 기존 동작대로 '이산'으로 허용 (fallback)
  if (neutralIds.length === 0 && isanIds.length === 0 && thebosangIds.length === 0) return '이산'

  return null
}

export async function POST(req: NextRequest) {
  // 1. 시크릿 검증
  const secret = req.headers.get("x-telegram-bot-api-secret-token")
  if (secret !== process.env.TELEGRAM_SPECIAL_CLINIC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()

  // 2. message 또는 edited_message 추출
  const msg = body.message ?? body.edited_message
  if (!msg?.text) return NextResponse.json({ ok: true })

  // 3. 채팅방 ID 필터 + TF 조직 결정
  const chatId = String(msg.chat.id)
  const tfOrg = resolveTfOrg(chatId)
  if (!tfOrg) {
    return NextResponse.json({ ok: true, skipped: 'unknown-chat' })
  }

  // 4. 난청 특진/재특진 일정 메시지 필터
  const text: string = msg.text
  if (!text.includes("난청") || (!text.includes("특진") && !text.includes("재특진")) || !text.includes("일정")) {
    return NextResponse.json({ ok: true })
  }

  // 5. 파싱
  const sender = msg.from?.first_name ?? msg.from?.username ?? "unknown"
  const msgDate = new Date(msg.date * 1000)
  const telegramMsgId = String(msg.message_id)

  // 5-1. Idempotency: WebhookEvent 기록 (중복 webhook 시 중단)
  // externalId는 chat_id + message_id 조합으로 텔레그램 전체에서 unique 보장
  const externalId = `${chatId}:${telegramMsgId}`
  const recorded = await recordWebhookEvent(
    WEBHOOK_SOURCE,
    externalId,
    body as Record<string, unknown>,
    "special_clinic_message",
  )
  if (recorded.status === "duplicate_skipped") {
    return NextResponse.json({ ok: true, status: "duplicate_skipped" })
  }

  try {
    const parsed = parseSpecialClinicMessage(text, sender, msgDate, { tfOrg })

    // 6. DB upsert
    let count = 0
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
        telegramMsgId,
        rawMessage: text,
      }

      if (existing) {
        await prisma.specialClinicSchedule.update({ where: { id: existing.id }, data })
      } else {
        await prisma.specialClinicSchedule.create({ data })
      }
      count++
    }

    // 7. 처리 완료 마킹
    await markWebhookProcessed(WEBHOOK_SOURCE, externalId, "webhook")
    return NextResponse.json({ ok: true, count })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[special-clinic webhook] 처리 실패", message)
    await markWebhookFailed(WEBHOOK_SOURCE, externalId, message)
    // 200 반환: 텔레그램 webhook 재전송 폭주 방지 (cron backup-poll 또는 수동 재처리 사용)
    return NextResponse.json({ ok: false, error: "internal_error" })
  }
}
