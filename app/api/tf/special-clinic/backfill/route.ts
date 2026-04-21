import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseSpecialClinicMessage, type TfOrg } from "@/lib/parse-special-clinic-message"
import { parseTelegramHtml } from "@/lib/parse-telegram-html"
import { NextRequest, NextResponse } from "next/server"

/**
 * Telegram Desktop Export HTML 파일을 업로드받아 과거 특진/재특진 일정을 일괄 등록.
 * 중복(patientName + tfName + clinicType + examRound 동일)은 스킵.
 * 파일 1개 기준 요청 (프론트가 여러 파일을 순차 호출).
 */
export const maxDuration = 300
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const file = formData.get('file')
  const tfOrgRaw = formData.get('tfOrg')
  const tfOrg: TfOrg = tfOrgRaw === '이산' ? '이산' : tfOrgRaw === '더보상' ? '더보상' : 'neutral'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필수 (multipart/form-data)" }, { status: 400 })
  }

  const html = await file.text()
  const messages = parseTelegramHtml(html)

  // 필터: 난청 + 특진/재특진 + 일정
  const filtered = messages
    .filter(m =>
      m.text.includes('난청') &&
      (m.text.includes('특진') || m.text.includes('재특진')) &&
      m.text.includes('일정')
    )
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))

  let savedNew = 0
  let skippedDuplicate = 0
  let parseFailures = 0

  for (const msg of filtered) {
    const msgDate = msg.date ?? new Date()
    const parsed = parseSpecialClinicMessage(msg.text, msg.senderName, msgDate, { tfOrg })

    if (parsed.length === 0) {
      parseFailures++
      continue
    }

    for (const p of parsed) {
      if (!p.patientName || !p.tfName) {
        parseFailures++
        continue
      }

      const existing = await prisma.specialClinicSchedule.findFirst({
        where: {
          patientName: p.patientName,
          tfName: p.tfName,
          clinicType: p.clinicType,
          examRound: p.examRound,
        },
        select: { id: true },
      })

      if (existing) {
        skippedDuplicate++
        continue
      }

      await prisma.specialClinicSchedule.create({
        data: {
          patientName: p.patientName,
          tfName: p.tfName,
          hospitalName: p.hospitalName,
          clinicType: p.clinicType,
          category: p.clinicType,        // 특진 또는 재특진
          examRound: p.examRound,
          scheduledDate: p.scheduledDate,
          isAllDay: p.isAllDay,
          scheduledHour: p.scheduledHour ?? null,
          scheduledMinute: p.scheduledMinute ?? 0,
          status: p.status,
          memo: p.memo || null,
          sender: msg.senderName,
          sourceDate: msgDate,
          rawMessage: msg.text,
        },
      })
      savedNew++
    }
  }

  return NextResponse.json({
    ok: true,
    file: file.name,
    stats: {
      totalMessages: messages.length,
      filtered: filtered.length,
      savedNew,
      skippedDuplicate,
      parseFailures,
    },
  })
}
