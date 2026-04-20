import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.hearingLossDetail.findUnique({ where: { caseId } });
    if (!detail) {
      return NextResponse.json({ error: "HearingLossDetail not found" }, { status: 404 });
    }
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, hearingLossDetailId, createdAt, updatedAt, ...data } = body;
    const exam = await prisma.hearingLossExam.create({
      data: { hearingLossDetailId: detail.id, ...data },
    });
    return NextResponse.json(exam);
  } catch (err) {
    console.error("[POST /api/cases/[caseId]/hearing-loss/exams]", err);
    const msg = err instanceof Error ? err.message : "저장 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
