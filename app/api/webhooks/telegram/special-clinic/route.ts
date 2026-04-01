import { parseSpecialClinicMessage } from "@/lib/parse-special-clinic-message"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

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

  // 3. 채팅방 ID 필터
  const allowedChatId = process.env.TELEGRAM_SPECIAL_CLINIC_CHAT_ID
  if (allowedChatId && String(msg.chat.id) !== allowedChatId) {
    return NextResponse.json({ ok: true })
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
  const parsed = parseSpecialClinicMessage(text, sender, msgDate)

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
