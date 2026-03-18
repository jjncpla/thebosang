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

  const where: Record<string, unknown> = {};
  if (tfName) where.tfName = tfName;
  if (progressStatus) where.progressStatus = progressStatus;
  if (caseType) where.caseType = caseType;
  if (search) where.patientName = { contains: search, mode: "insensitive" };

  const items = await prisma.objectionReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  let { tfName, patientName, caseType, approvalStatus, progressStatus, decisionDate, hasInfoDisclosure, memo, caseId } = body;

  // caseId 제공 시 케이스 데이터 자동 조회 (처분검토 자동 반영용)
  if (caseId && (!tfName || !patientName)) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { patient: { select: { name: true } } },
    });
    if (caseData) {
      tfName = tfName || caseData.tfName || "";
      patientName = patientName || caseData.patient?.name || "";
      caseType = caseType || caseData.caseType || "";
      progressStatus = progressStatus || "검토중";
    }
  }

  if (!tfName || !patientName || !approvalStatus || !progressStatus) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  // caseId가 있으면 upsert (기존 레코드 업데이트, 없으면 생성)
  if (caseId) {
    const existing = await prisma.objectionReview.findFirst({ where: { caseId } });
    if (existing) {
      const updated = await prisma.objectionReview.update({
        where: { id: existing.id },
        data: { approvalStatus, ...(progressStatus && { progressStatus }) },
      });
      return NextResponse.json(updated);
    }
  }

  const item = await prisma.objectionReview.create({
    data: {
      tfName,
      patientName,
      caseType: caseType || "",
      approvalStatus,
      progressStatus,
      decisionDate: decisionDate ? new Date(decisionDate) : null,
      hasInfoDisclosure: !!hasInfoDisclosure,
      memo: memo || null,
      caseId: caseId || null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
