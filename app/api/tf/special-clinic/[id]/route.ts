import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * 캘린더 일정 편집 → HearingLossDetail 역방향 싱크 (회차별 독립).
 * - assignedStaff → specialExam${N}Attendee (또는 reSpecial/re2Special)
 * - isPickup → specialExam${N}Pickup (회차별 독립)
 *
 * 매칭: (1) schedule.caseId 우선, (2) 없으면 patientName으로 Patient→Case 찾기
 */
async function syncToHearingLoss(updated: {
  caseId: string | null
  patientName: string | null
  clinicType: string | null
  examRound: number | null
  assignedStaff: string | null
  isPickup: boolean | null
}) {
  if (!updated.clinicType || !updated.examRound) return
  if (updated.clinicType !== '특진' && updated.clinicType !== '재특진' && updated.clinicType !== '재재특진') return
  const round = updated.examRound
  if (round < 1 || round > 5) return

  // 1) Case 찾기
  let caseId: string | null = updated.caseId
  if (!caseId && updated.patientName) {
    const patients = await prisma.patient.findMany({
      where: { name: updated.patientName },
      select: { id: true },
    })
    if (patients.length === 1) {
      const c = await prisma.case.findFirst({
        where: { patientId: patients[0].id, caseType: 'HEARING_LOSS' },
        select: { id: true },
      })
      caseId = c?.id ?? null
    }
  }
  if (!caseId) return

  // 2) HearingLossDetail 업데이트 — 회차별 필드
  const prefix =
    updated.clinicType === '특진' ? 'specialExam'
    : updated.clinicType === '재특진' ? 'reSpecialExam'
    : 're2SpecialExam'

  const data: Record<string, unknown> = {}
  if (updated.assignedStaff !== undefined && updated.assignedStaff !== null) {
    data[`${prefix}${round}Attendee`] = updated.assignedStaff
  }
  if (updated.isPickup !== undefined && updated.isPickup !== null) {
    data[`${prefix}${round}Pickup`] = updated.isPickup
  }
  if (Object.keys(data).length === 0) return

  await prisma.hearingLossDetail.updateMany({
    where: { caseId },
    data,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const updated = await prisma.specialClinicSchedule.update({ where: { id }, data: body })

  // HearingLossDetail / 다른 회차 schedule로 싱크
  try {
    await syncToHearingLoss({
      caseId: updated.caseId,
      patientName: updated.patientName,
      clinicType: updated.clinicType,
      examRound: updated.examRound,
      assignedStaff: updated.assignedStaff,
      isPickup: updated.isPickup,
    })
  } catch (e) {
    console.error('[special-clinic PUT sync failed]', e)
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const deleteGroup = searchParams.get("deleteGroup") === "true"

  if (deleteGroup) {
    const record = await prisma.specialClinicSchedule.findUnique({ where: { id }, select: { recurringGroupId: true } })
    if (record?.recurringGroupId) {
      const { count } = await prisma.specialClinicSchedule.deleteMany({ where: { recurringGroupId: record.recurringGroupId } })
      return NextResponse.json({ success: true, deleted: count })
    }
  }

  await prisma.specialClinicSchedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
