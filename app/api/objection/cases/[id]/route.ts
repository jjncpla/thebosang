import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const item = await prisma.objectionCase.update({
    where: { id },
    data: {
      tfName: body.tfName,
      patientName: body.patientName,
      caseType: body.caseType,
      approvalStatus: body.approvalStatus,
      progressStatus: body.progressStatus,
      decisionDate: body.decisionDate ? new Date(body.decisionDate) : null,
      examClaimDate: body.examClaimDate ? new Date(body.examClaimDate) : null,
      examResult: body.examResult || null,
      examResultDate: body.examResultDate ? new Date(body.examResultDate) : null,
      reExamClaimDate: body.reExamClaimDate ? new Date(body.reExamClaimDate) : null,
      reExamResult: body.reExamResult || null,
      reExamResultDate: body.reExamResultDate ? new Date(body.reExamResultDate) : null,
      isQualityReview: !!body.isQualityReview,
      managerId: body.managerId || null,
      memo: body.memo || null,
      litigationHandover: !!body.litigationHandover,
      litigationMemo: body.litigationMemo || null,
      needsReDecision: !!body.needsReDecision,
    },
    include: { manager: { select: { id: true, name: true } } },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.objectionCase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
