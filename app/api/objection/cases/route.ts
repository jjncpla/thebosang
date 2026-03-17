import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tfName = searchParams.get("tfName");
  const progressStatus = searchParams.get("progressStatus");
  const search = searchParams.get("search");

  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (type === "litigation") {
    where.OR = [{ litigationHandover: true }, { progressStatus: "송무인계" }];
  } else {
    if (progressStatus) where.progressStatus = progressStatus;
  }
  if (tfName) where.tfName = tfName;
  if (search) where.patientName = { contains: search, mode: "insensitive" };

  const items = await prisma.objectionCase.findMany({
    where,
    include: { manager: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
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
