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
    const { exams, id, caseId: _cId, createdAt, updatedAt, ...rawData } = body;

    // 숫자 타입 필드 강제 변환 (UI에서 string으로 올 수 있음)
    const FLOAT_FIELDS = ["firstExamRight","firstExamLeft","firstExamSpeech"];
    const INT_FIELDS = ["lumpSumAmount","avgWage"];
    const data: Record<string, unknown> = { ...rawData };
    for (const f of FLOAT_FIELDS) {
      if (data[f] !== null && data[f] !== undefined && data[f] !== "") {
        const n = parseFloat(String(data[f]));
        data[f] = isNaN(n) ? null : n;
      } else if (data[f] === "") {
        data[f] = null;
      }
    }
    for (const f of INT_FIELDS) {
      if (data[f] !== null && data[f] !== undefined && data[f] !== "") {
        const n = parseInt(String(data[f]), 10);
        data[f] = isNaN(n) ? null : n;
      } else if (data[f] === "") {
        data[f] = null;
      }
    }

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const body = await req.json();

  // lastNoiseWorkEndDate is now on Case model — update there
  if (body.lastNoiseWorkEndDate !== undefined) {
    const updated = await prisma.case.update({
      where: { id: caseId },
      data: { lastNoiseWorkEndDate: body.lastNoiseWorkEndDate ? new Date(body.lastNoiseWorkEndDate) : null },
    });
    return NextResponse.json({ success: true, updated });
  }

  // General HearingLossDetail field patch
  const { id: _id, caseId: _cId, createdAt: _ca, updatedAt: _ua, exams: _ex, ...fields } = body;
  if (Object.keys(fields).length > 0) {
    const updated = await prisma.hearingLossDetail.upsert({
      where: { caseId },
      create: { caseId, ...fields },
      update: fields,
    });
    return NextResponse.json({ success: true, updated });
  }

  return NextResponse.json({ success: true });
}
