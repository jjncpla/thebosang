import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; examId: string }> }
) {
  const { examId } = await params;
  try {
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, hearingLossDetailId, createdAt, updatedAt, ...data } = body;
    const exam = await prisma.hearingLossExam.update({
      where: { id: examId },
      data,
    });
    return NextResponse.json(exam);
  } catch (err) {
    console.error("[PUT /api/cases/[caseId]/hearing-loss/exams/[examId]]", err);
    return NextResponse.json({ error: "저장 오류" }, { status: 500 });
  }
}
