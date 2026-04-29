import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 단일 AvgWageNotice 조회 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await prisma.avgWageNotice.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

/** AvgWageNotice 일부 필드 수정 (verifyStatus, verifyNote, caseId 등) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  // 허용 필드만
  const allowed: Record<string, unknown> = {};
  for (const k of [
    "caseId", "patientId", "wageReviewId",
    "verifyStatus", "verifyNote",
    "workerName", "workplaceName",
    "baseAvgWage", "statWageBase", "finalAvgWage",
    "needsCorrection", "correctionReason",
  ] as const) {
    if (k in body) allowed[k] = body[k];
  }
  const updated = await prisma.avgWageNotice.update({
    where: { id },
    data: allowed,
  });
  return NextResponse.json({ item: updated });
}
