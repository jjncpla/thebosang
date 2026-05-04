import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tfName = searchParams.get("tfName");
  const progressStatus = searchParams.get("progressStatus");
  const caseType = searchParams.get("caseType");
  const search = searchParams.get("search");

  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (type === "litigation") {
    where.OR = [{ litigationHandover: true }, { progressStatus: "송무인계" }];
  } else {
    if (progressStatus) where.progressStatus = progressStatus;
  }
  if (tfName) where.tfName = tfName;
  if (caseType) where.caseType = caseType;
  if (search) where.patientName = { contains: search, mode: "insensitive" };

  const items = await prisma.objectionCase.findMany({
    where,
    include: {
      manager: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  // 송무 인계 필드(L~U)는 ObjectionCase 자체 필드로 자동 포함됨

  // 소송인계 탭이면 autoItems 제외
  if (type === "litigation") {
    return NextResponse.json(items);
  }

  // OBJECTION 상태 Case 자동 인입
  const existingCaseIds = items.map(r => r.caseId).filter(Boolean) as string[];

  const objectionWhere: Record<string, unknown> = {
    OR: [
      { status: 'OBJECTION' }, // HEARING_LOSS 영문
      { status: '이의제기' }, // COPD/근골격계 한글
    ],
    ...(existingCaseIds.length > 0 ? { id: { notIn: existingCaseIds } } : {}),
    ...(tfName ? { tfName } : {}),
  };
  if (caseType) objectionWhere.caseType = caseType;
  if (search) objectionWhere.patient = { name: { contains: search, mode: "insensitive" } };

  const objectionCases = await prisma.case.findMany({
    where: objectionWhere,
    include: {
      patient: { select: { name: true } },
      hearingLoss: { select: { decisionReceivedAt: true } },
      copd: {
        select: {
          applications: {
            orderBy: { applicationRound: 'desc' },
            take: 1,
            select: { disposalDate: true, disabilityDispositionDate: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const autoItems = objectionCases.map(c => {
    let autoDecisionDate: string | null = null;
    if (c.caseType === 'HEARING_LOSS') {
      autoDecisionDate = c.hearingLoss?.decisionReceivedAt?.toISOString() ?? null;
    } else if (c.caseType === 'COPD') {
      const latest = c.copd?.applications[0];
      autoDecisionDate = (latest?.disabilityDispositionDate ?? latest?.disposalDate)?.toISOString() ?? null;
    }
    return {
    id: `auto_${c.id}`,
    tfName: c.tfName ?? '',
    patientName: c.patient.name,
    caseType: c.caseType,
    approvalStatus: '불승인',
    progressStatus: '진행중',
    decisionDate: autoDecisionDate,
    examClaimDate: null,
    examResult: null,
    examResultDate: null,
    reExamClaimDate: null,
    reExamResult: null,
    reExamResultDate: null,
    isQualityReview: false,
    managerId: null,
    manager: null,
    memo: null,
    litigationHandover: false,
    litigationMemo: null,
    needsReDecision: false,
    litigationStatus: null,
    wageCorrectStatus: null,
    reviewId: null,
    caseId: c.id,
    isAutoFilled: true,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    };
  });

  return NextResponse.json([...autoItems, ...items]);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const item = await prisma.objectionCase.create({
    data: {
      tfName: body.tfName || "",
      patientName: body.patientName || "",
      caseType: body.caseType || "",
      approvalStatus: body.approvalStatus || "불승인",
      progressStatus: body.progressStatus || "진행중",
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
      litigationStatus: body.litigationStatus || null,
      wageCorrectStatus: body.wageCorrectStatus || null,
      reviewId: body.reviewId || null,
      caseId: body.caseId || null,
    },
    include: { manager: { select: { id: true, name: true } } },
  });

  return NextResponse.json(item, { status: 201 });
}
