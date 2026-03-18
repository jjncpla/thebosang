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
  const { tfName, patientName, caseType, approvalStatus, progressStatus, decisionDate, hasInfoDisclosure, memo, caseId } = body;

  if (!tfName || !patientName || !approvalStatus || !progressStatus) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
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
