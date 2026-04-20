import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseSpecialClinicMessage, type TfOrg } from "@/lib/parse-special-clinic-message"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { text, sender } = body as { text?: string; sender?: string }
  const tfOrg: TfOrg = body.tfOrg === '더보상' ? '더보상' : '이산'
  if (!text) return NextResponse.json({ error: "text 필수" }, { status: 400 })

  const parsed = parseSpecialClinicMessage(text, sender || "manual", new Date(), { tfOrg })
  const saved = []

  for (const p of parsed) {
    if (!p.patientName || !p.tfName) continue

    // upsert: patientName + tfName + clinicType + examRound
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
      sender: sender || "manual",
      sourceDate: new Date(),
      rawMessage: text,
    }

    if (existing) {
      const rec = await prisma.specialClinicSchedule.update({
        where: { id: existing.id },
        data,
      })
      saved.push(rec)
    } else {
      const rec = await prisma.specialClinicSchedule.create({ data })
      saved.push(rec)
    }
  }

  return NextResponse.json({ parsed: parsed.length, saved: saved.length, records: saved })
}
