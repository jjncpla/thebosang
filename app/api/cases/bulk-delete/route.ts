import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  try {
    const { caseIds } = await req.json();
    if (!caseIds?.length) return NextResponse.json({ error: "caseIds 필요" }, { status: 400 });

    const cases = await prisma.case.findMany({ where: { id: { in: caseIds } }, select: { patientId: true } });
    const patientIds = [...new Set(cases.map(c => c.patientId))];

    await prisma.hearingLossDetail.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.copdDetail.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.pneumoconiosisDetail.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.musculoskeletalDetail.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.occupationalAccidentDetail.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.occupationalCancerDetail.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.bereavedDetail.deleteMany({ where: { caseId: { in: caseIds } } });
    await prisma.case.deleteMany({ where: { id: { in: caseIds } } });

    for (const patientId of patientIds) {
      const remaining = await prisma.case.count({ where: { patientId } });
      if (remaining === 0) await prisma.patient.delete({ where: { id: patientId } });
    }

    return NextResponse.json({ success: true, deletedCount: caseIds.length });
  } catch (err) {
    console.error("[DELETE /api/cases/bulk-delete]", err);
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
