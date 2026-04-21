import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const updated = await prisma.specialClinicSchedule.update({ where: { id }, data: body })

  // 특진/재특진 담당자 → HearingLossDetail 자동 반영
  if (updated.patientName && updated.assignedStaff && (updated.clinicType === '특진' || updated.clinicType === '재특진') && updated.examRound) {
    const round = updated.examRound
    const fieldKey = updated.clinicType === '특진'
      ? `specialExam${round}Attendee`
      : `reSpecialExam${round}Attendee`

    // patientName으로 환자 찾기 → 사건 → HearingLossDetail 업데이트
    if (round >= 1 && round <= 5) {
      const patient = await prisma.patient.findFirst({ where: { name: updated.patientName }, select: { id: true } })
      if (patient) {
        const hearingCase = await prisma.case.findFirst({
          where: { patientId: patient.id, caseType: 'NOISE' },
          select: { id: true },
        })
        if (hearingCase) {
          await prisma.hearingLossDetail.updateMany({
            where: { caseId: hearingCase.id },
            data: { [fieldKey]: updated.assignedStaff },
          })
        }
      }
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await prisma.specialClinicSchedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
