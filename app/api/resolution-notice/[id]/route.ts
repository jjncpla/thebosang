import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 단일 ResolutionNotice 조회 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await prisma.resolutionNotice.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ item });
}

/** ResolutionNotice 일부 필드 수정 (사용자 검토 후 — MEDIUM 필드 보정) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "";
  if (role === "이산계정") {
    return NextResponse.json({ error: "권한 부족" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowed: Record<string, unknown> = {};
  for (const k of [
    "caseId",
    "patientId",
    "recipientName",
    "medicalInstitution",
    "medicalInstNo",
    "injuryName",
    "icdCode",
    "decisionType",
    "rejectionReason",
    "calculationDetail",
    "kwcOfficeName",
    "noticeNumber",
    "diseaseCategory",
    "requiresUserReview",
  ] as const) {
    if (k in body) allowed[k] = body[k];
  }

  // 날짜 필드 (string → Date 변환)
  for (const k of ["resolutionDate", "treatmentPeriodStart", "treatmentPeriodEnd"] as const) {
    if (k in body) {
      const v = body[k];
      if (v === null || v === "") {
        allowed[k] = null;
      } else {
        const d = new Date(v);
        if (!isNaN(d.getTime())) allowed[k] = d;
      }
    }
  }

  const updated = await prisma.resolutionNotice.update({
    where: { id },
    data: allowed,
  });
  return NextResponse.json({ item: updated });
}
