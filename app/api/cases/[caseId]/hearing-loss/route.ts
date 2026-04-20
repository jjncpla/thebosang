import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFromHearingLossDecision } from "@/lib/case-sync";

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

    // datetime-local 입력값 "YYYY-MM-DDTHH:mm" → "YYYY-MM-DDTHH:mm:ss" (Prisma ISO-8601 요구)
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
        data[k] = v + ":00";
      }
    }

    // 기존 데이터 조회 (결정수령일 / 처분결과 변경 감지용)
    const existingDetail = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      select: { decisionReceivedAt: true, decisionType: true },
    });

    const detail = await prisma.hearingLossDetail.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
      include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } },
    });

    // 결정수령일이 새로 입력된 경우 → Case.status DECISION_RECEIVED
    if (detail.decisionReceivedAt && !existingDetail?.decisionReceivedAt) {
      await prisma.case.update({
        where: { id: caseId },
        data: { status: "DECISION_RECEIVED" },
      });
    }

    // 처분결과(decisionType) 변경 또는 신규 설정 시 → ObjectionReview + Case 싱크
    if (detail.decisionType && detail.decisionType !== existingDetail?.decisionType) {
      await syncFromHearingLossDecision(caseId, detail.decisionType, detail.decisionReceivedAt);
    }

    return NextResponse.json(detail);
  } catch (err) {
    console.error("[PUT /api/cases/[caseId]/hearing-loss]", err);
    const msg = err instanceof Error ? err.message : "저장 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
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
    // 기존 처분결과 조회 (변경 감지)
    const prev = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      select: { decisionType: true },
    });
    const updated = await prisma.hearingLossDetail.upsert({
      where: { caseId },
      create: { caseId, ...fields },
      update: fields,
    });
    // 처분결과가 바뀌었으면 싱크
    if (updated.decisionType && updated.decisionType !== prev?.decisionType) {
      await syncFromHearingLossDecision(caseId, updated.decisionType, updated.decisionReceivedAt);
    }
    return NextResponse.json({ success: true, updated });
  }

  return NextResponse.json({ success: true });
}
