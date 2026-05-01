import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/resolution-notice/list
 * 쿼리: ?caseId=&recipientName=&requiresUserReview=true|false&applied=true|false&limit=50
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200);
  const caseId = url.searchParams.get("caseId");
  const recipientName = url.searchParams.get("recipientName");
  const requiresReviewParam = url.searchParams.get("requiresUserReview");
  const appliedParam = url.searchParams.get("applied");
  const decisionType = url.searchParams.get("decisionType");

  const where: Record<string, unknown> = {};
  if (caseId) where.caseId = caseId;
  if (recipientName) where.recipientName = recipientName;
  if (decisionType) where.decisionType = decisionType;
  if (requiresReviewParam === "true") where.requiresUserReview = true;
  if (requiresReviewParam === "false") where.requiresUserReview = false;
  if (appliedParam === "true") where.appliedToCase = true;
  if (appliedParam === "false") where.appliedToCase = false;

  const items = await prisma.resolutionNotice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      caseId: true,
      patientId: true,
      originalFileName: true,
      pageCount: true,
      resolutionDate: true,
      noticeNumber: true,
      kwcOfficeName: true,
      decisionType: true,
      recipientName: true,
      medicalInstitution: true,
      injuryName: true,
      icdCode: true,
      treatmentPeriodStart: true,
      treatmentPeriodEnd: true,
      diseaseCategory: true,
      autoIngestConfidence: true,
      requiresUserReview: true,
      appliedToCase: true,
      appliedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ items, count: items.length });
}

/**
 * DELETE /api/resolution-notice/list?id=xxx
 * ADMIN 전용
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "ADMIN 권한 필요" }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.resolutionNotice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
