import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// GET: 중복 현황 미리보기
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const all = await prisma.specialClinicSchedule.findMany({
    where: {
      patientName: { not: null },
      clinicType: { not: null },
      examRound: { not: null },
    },
    select: {
      id: true,
      patientName: true,
      tfName: true,
      clinicType: true,
      examRound: true,
      caseId: true,
      scheduledDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  // patientName + tfName + clinicType + examRound 기준으로 그룹화
  const groups: Record<string, typeof all> = {}
  for (const s of all) {
    const key = `${s.patientName}||${s.tfName}||${s.clinicType}||${s.examRound}`
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }

  const duplicates = Object.entries(groups)
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({ key, count: items.length, items }))

  return NextResponse.json({ duplicateGroups: duplicates.length, duplicates })
}

// POST: 중복 레코드 실제 제거 (caseId 있는 레코드 우선 보존, 없으면 최신 보존)
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const all = await prisma.specialClinicSchedule.findMany({
    where: {
      patientName: { not: null },
      clinicType: { not: null },
      examRound: { not: null },
    },
    select: {
      id: true,
      patientName: true,
      tfName: true,
      clinicType: true,
      examRound: true,
      caseId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const groups: Record<string, typeof all> = {}
  for (const s of all) {
    const key = `${s.patientName}||${s.tfName}||${s.clinicType}||${s.examRound}`
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }

  const toDelete: string[] = []

  for (const items of Object.values(groups)) {
    if (items.length <= 1) continue

    // caseId 있는 것 우선 보존, 없으면 가장 최근 것 보존
    const withCase = items.filter(i => i.caseId)
    const keeper = withCase.length > 0
      ? withCase[withCase.length - 1]
      : items[items.length - 1]

    for (const item of items) {
      if (item.id !== keeper.id) toDelete.push(item.id)
    }
  }

  if (toDelete.length > 0) {
    await prisma.specialClinicSchedule.deleteMany({ where: { id: { in: toDelete } } })
  }

  return NextResponse.json({ deleted: toDelete.length, ids: toDelete })
}
