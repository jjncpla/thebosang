import { parseSpecialClinicMessage, type TfOrg } from "@/lib/parse-special-clinic-message"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * 채팅방 ID → TF 조직(이산/더보상) 매핑을 환경변수에서 구성.
 * - TELEGRAM_SPECIAL_CLINIC_CHAT_ID / TELEGRAM_SPECIAL_CLINIC_ISAN_CHAT_IDS : 이산TF 방
 * - TELEGRAM_SPECIAL_CLINIC_THEBOSANG_CHAT_IDS : 더보상 방 (콤마 구분, 복수 가능)
 * 허용되지 않은 chat_id 메시지는 무시.
 */
function resolveTfOrg(chatId: string): TfOrg | null {
  const isanIds = [
    process.env.TELEGRAM_SPECIAL_CLINIC_CHAT_ID,          // 기존 단수 변수 (하위호환)
    process.env.TELEGRAM_SPECIAL_CLINIC_ISAN_CHAT_IDS,    // 신규 복수 변수
  ]
    .filter(Boolean)
    .flatMap(v => String(v).split(','))
    .map(s => s.trim())
    .filter(Boolean)

  const thebosangIds = (process.env.TELEGRAM_SPECIAL_CLINIC_THEBOSANG_CHAT_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (isanIds.includes(chatId)) return '이산'
  if (thebosangIds.includes(chatId)) return '더보상'

  // 환경변수가 하나도 설정되지 않은 경우엔 기존 동작대로 '이산'으로 허용 (fallback)
  if (isanIds.length === 0 && thebosangIds.length === 0) return '이산'

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

  return NextResponse.json({ ok: true, count })
}
