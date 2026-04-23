import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month")
  const tfName = searchParams.get("tfName")
  const clinicType = searchParams.get("clinicType")
  const status = searchParams.get("status") ?? "scheduled"

  let dateFrom: Date, dateTo: Date
  if (month) {
    const [y, m] = month.split("-").map(Number)
    dateFrom = new Date(y, m - 1, 1)
    dateTo = new Date(y, m, 0, 23, 59, 59)
  } else {
    const now = new Date()
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  }

  const where: Record<string, unknown> = {
    scheduledDate: { gte: dateFrom, lte: dateTo },
  }
  if (tfName) where.tfName = { contains: tfName }
  if (clinicType) where.clinicType = clinicType
  if (status !== "all") where.status = status

  // 응답 경량화: rawMessage·sourceDate·telegramMsgId는 리스트 응답에서 제외
  // (팝업 상세에만 사용되므로 필요 시 별도 조회)
  const schedules = await prisma.specialClinicSchedule.findMany({
    where,
    orderBy: [{ scheduledDate: "asc" }, { scheduledHour: "asc" }],
    select: {
      id: true,
      patientName: true,
      tfName: true,
      hospitalName: true,
      clinicType: true,
      category: true,
      examRound: true,
      title: true,
      content: true,
      scheduledDate: true,
      isAllDay: true,
      scheduledHour: true,
      scheduledMinute: true,
      status: true,
      sender: true,
      memo: true,
      assignedStaff: true,
      attended: true,
      isPickup: true,
      createdAt: true,
    },
  })

  // 특진/재특진 일정의 patientName으로 Patient 연락처 조회
  const patientNames = [...new Set(
    schedules
      .filter(s => s.patientName && (s.category === "특진" || s.category === "재특진"))
      .map(s => s.patientName as string)
  )]
  const patients = patientNames.length > 0
    ? await prisma.patient.findMany({
        where: { name: { in: patientNames } },
        select: { name: true, phone: true },
      })
    : []
  const phoneMap: Record<string, string> = {}
  for (const p of patients) {
    if (p.phone && !phoneMap[p.name]) phoneMap[p.name] = p.phone
  }

  const enriched = schedules.map(s => ({
    ...s,
    patientPhone: s.patientName ? (phoneMap[s.patientName] ?? null) : null,
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const schedule = await prisma.specialClinicSchedule.create({ data: body })
  return NextResponse.json(schedule)
}
