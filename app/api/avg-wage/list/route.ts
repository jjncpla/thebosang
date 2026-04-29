import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const caseId = url.searchParams.get("caseId");
  const workerName = url.searchParams.get("workerName");
  const needsCorrectionParam = url.searchParams.get("needsCorrection");

  const where: Record<string, unknown> = {};
  if (caseId) where.caseId = caseId;
  if (workerName) where.workerName = workerName;
  if (needsCorrectionParam === "true") where.needsCorrection = true;
  if (needsCorrectionParam === "false") where.needsCorrection = false;

  const items = await prisma.avgWageNotice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      caseId: true,
      patientId: true,
      wageReviewId: true,
      fileName: true,
      managementNo: true,
      diagnosisDate: true,
      workplaceName: true,
      businessType: true,
      workerName: true,
      hireDate: true,
      wageCalcType: true,
      baseAvgWage: true,
      statWageBase: true,
      finalAvgWage: true,
      finalApplyDate: true,
      needsCorrection: true,
      correctionReason: true,
      verifyStatus: true,
      verifyNote: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ items, count: items.length });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.avgWageNotice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
