import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { syncFromObjectionCase } from "@/lib/case-sync";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // 부분 업데이트 패턴 — 클라이언트가 보낸 필드만 변경
  const data: Record<string, unknown> = {};
  if (body.tfName !== undefined) data.tfName = body.tfName;
  if (body.patientName !== undefined) data.patientName = body.patientName;
  if (body.caseType !== undefined) data.caseType = body.caseType;
  if (body.approvalStatus !== undefined) data.approvalStatus = body.approvalStatus;
  if (body.progressStatus !== undefined) data.progressStatus = body.progressStatus;
  if (body.decisionDate !== undefined) data.decisionDate = body.decisionDate ? new Date(body.decisionDate) : null;
  if (body.examClaimDate !== undefined) data.examClaimDate = body.examClaimDate ? new Date(body.examClaimDate) : null;
  if (body.examResult !== undefined) data.examResult = body.examResult || null;
  if (body.examResultDate !== undefined) data.examResultDate = body.examResultDate ? new Date(body.examResultDate) : null;
  if (body.reExamClaimDate !== undefined) data.reExamClaimDate = body.reExamClaimDate ? new Date(body.reExamClaimDate) : null;
  if (body.reExamResult !== undefined) data.reExamResult = body.reExamResult || null;
  if (body.reExamResultDate !== undefined) data.reExamResultDate = body.reExamResultDate ? new Date(body.reExamResultDate) : null;
  if (body.isQualityReview !== undefined) data.isQualityReview = !!body.isQualityReview;
  if (body.managerId !== undefined) data.managerId = body.managerId || null;
  if (body.memo !== undefined) data.memo = body.memo || null;
  if (body.litigationHandover !== undefined) data.litigationHandover = !!body.litigationHandover;
  if (body.litigationMemo !== undefined) data.litigationMemo = body.litigationMemo || null;
  if (body.needsReDecision !== undefined) data.needsReDecision = !!body.needsReDecision;
  if (body.litigationStatus !== undefined) data.litigationStatus = body.litigationStatus || null;
  if (body.wageCorrectStatus !== undefined) data.wageCorrectStatus = body.wageCorrectStatus || null;
  if (body.caseId !== undefined) data.caseId = body.caseId || null;
  // 송무 인계 (관리파일 L~U)
  if (body.litigationFirstReview !== undefined) data.litigationFirstReview = body.litigationFirstReview || null;
  if (body.litigationFirstDraftAt !== undefined) data.litigationFirstDraftAt = body.litigationFirstDraftAt ? new Date(body.litigationFirstDraftAt) : null;
  if (body.litigationFirstDraftResult !== undefined) data.litigationFirstDraftResult = body.litigationFirstDraftResult || null;
  if (body.litigationContractStatus !== undefined) data.litigationContractStatus = body.litigationContractStatus || null;
  if (body.litigationContractSent !== undefined) data.litigationContractSent = body.litigationContractSent || null;
  if (body.litigationSecondDraftAt !== undefined) data.litigationSecondDraftAt = body.litigationSecondDraftAt ? new Date(body.litigationSecondDraftAt) : null;
  if (body.litigationPoaReceived !== undefined) data.litigationPoaReceived = body.litigationPoaReceived || null;
  if (body.litigationFinalDecision !== undefined) data.litigationFinalDecision = body.litigationFinalDecision || null;
  if (body.litigationPostHandling !== undefined) data.litigationPostHandling = body.litigationPostHandling || null;
  if (body.litigationPostHandler !== undefined) data.litigationPostHandler = body.litigationPostHandler || null;

  const item = await prisma.objectionCase.update({
    where: { id },
    data,
    include: { manager: { select: { id: true, name: true } } },
  });

  // ObjectionReview + Case 싱크 (종결·진행 상태 반영)
  await syncFromObjectionCase(item.id);

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.objectionCase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
