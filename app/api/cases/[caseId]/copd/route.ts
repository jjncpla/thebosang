import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// CopdDetail = 사건 단위 공통 정보 (흡연력, 진단, 초진).
// 회차별 신청은 /api/cases/[caseId]/copd/applications 에서 관리.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.copdDetail.findUnique({
      where: { caseId },
      include: {
        applications: { orderBy: { applicationRound: "asc" } },
      },
    });
    return NextResponse.json(detail ?? {});
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/copd]", err);
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

    const parseDate = (v: unknown) => (v ? new Date(v as string) : null);
    const parseNumber = (v: unknown) =>
      v !== undefined && v !== null && v !== "" ? Number(v) : null;
    const parseInt_ = (v: unknown) =>
      v !== undefined && v !== null && v !== "" ? parseInt(String(v), 10) : null;

    const data = {
      // 흡연력
      smokingStatus: body.smokingStatus ?? null,
      smokingPacks: parseInt_(body.smokingPacks),
      smokingYears: parseInt_(body.smokingYears),
      exSmokingYears: parseInt_(body.exSmokingYears),
      // 진단
      firstSymptomDate: parseDate(body.firstSymptomDate),
      diagnosisDate: parseDate(body.diagnosisDate),
      diagnosisHospital: body.diagnosisHospital ?? null,
      // 초진
      firstClinic: body.firstClinic ?? null,
      firstExamDate: parseDate(body.firstExamDate),
      fev1Rate: parseNumber(body.fev1Rate),
      fev1Volume: parseNumber(body.fev1Volume),
      // 메모
      copdMemo: body.copdMemo ?? null,
    };

    const detail = await prisma.copdDetail.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });

    return NextResponse.json(detail);
  } catch (err) {
    console.error("[PUT /api/cases/[caseId]/copd]", err);
    const msg = err instanceof Error ? err.message : "저장 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
