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

  const schedules = await prisma.specialClinicSchedule.findMany({
    where,
    orderBy: [{ scheduledDate: "asc" }, { scheduledHour: "asc" }],
  })

  return NextResponse.json(schedules)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const schedule = await prisma.specialClinicSchedule.create({ data: body })
  return NextResponse.json(schedule)
}
