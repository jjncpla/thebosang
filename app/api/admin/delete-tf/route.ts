import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  try {
    const { tfName } = await req.json();
    if (!tfName) return NextResponse.json({ error: "tfName 필요" }, { status: 400 });

    const cases = await prisma.case.findMany({ where: { tfName }, select: { id: true, patientId: true } });
    const caseIds = cases.map(c => c.id);
    const patientIds = [...new Set(cases.map(c => c.patientId))];

    if (caseIds.length > 0) {
      // HearingLossExam — hearingLossDetail 삭제 전 먼저 제거
      const hlDetails = await prisma.hearingLossDetail.findMany({ where: { caseId: { in: caseIds } }, select: { id: true } });
      const hlDetailIds = hlDetails.map(d => d.id);
      if (hlDetailIds.length > 0) {
        await prisma.hearingLossExam.deleteMany({ where: { hearingLossDetailId: { in: hlDetailIds } } });
      }

      // 상병별 상세 테이블
      await prisma.hearingLossDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.copdDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.pneumoconiosisDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.musculoskeletalDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.occupationalAccidentDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.occupationalCancerDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.bereavedDetail.deleteMany({ where: { caseId: { in: caseIds } } });

      // 파생 사건 자기참조 해제
      await prisma.case.updateMany({ where: { parentCaseId: { in: caseIds } }, data: { parentCaseId: null } });

      // Case 참조하는 나머지 테이블
      await prisma.objectionCase.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.objectionReview.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.message.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.timelineEvent.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.todo.deleteMany({ where: { caseId: { in: caseIds } } });

      await prisma.case.deleteMany({ where: { tfName } });
    }

    for (const patientId of patientIds) {
      const remaining = await prisma.case.count({ where: { patientId } });
      if (remaining === 0) await prisma.patient.delete({ where: { id: patientId } });
    }

    return NextResponse.json({ success: true, deletedCases: caseIds.length });
  } catch (err) {
    console.error("[DELETE /api/admin/delete-tf]", err);
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
