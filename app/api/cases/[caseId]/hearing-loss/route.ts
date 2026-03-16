import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } },
    });
    return NextResponse.json(detail);
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/hearing-loss]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const body = await req.json();
    // exams 및 메타 필드는 별도 처리
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { exams, id, caseId: _cId, createdAt, updatedAt, ...data } = body;

    const detail = await prisma.hearingLossDetail.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
      include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } },
    });
    return NextResponse.json(detail);
  } catch (err) {
    console.error("[PUT /api/cases/[caseId]/hearing-loss]", err);
    return NextResponse.json({ error: "저장 오류" }, { status: 500 });
  }
}
