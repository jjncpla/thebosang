import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.copdDetail.findUnique({ where: { caseId } });
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
    const parseFloat_ = (v: unknown) =>
      v !== undefined && v !== null && v !== "" ? Number(v) : null;

    const data = {
      firstClinic: body.firstClinic ?? null,
      firstExamDate: parseDate(body.firstExamDate),
      fev1Rate: parseFloat_(body.fev1Rate),
      fev1Volume: parseFloat_(body.fev1Volume),
      specialClinic: body.specialClinic ?? null,
      exam1Date: parseDate(body.exam1Date),
      exam1Rate: parseFloat_(body.exam1Rate),
      exam1Volume: parseFloat_(body.exam1Volume),
      exam2Date: parseDate(body.exam2Date),
      exam2Rate: parseFloat_(body.exam2Rate),
      exam2Volume: parseFloat_(body.exam2Volume),
      examMemo: body.examMemo ?? null,
      expertOrgDate: parseDate(body.expertOrgDate),
      occDiseaseCommittee: body.occDiseaseCommittee ?? null,
      occReferralDate: parseDate(body.occReferralDate),
      occReviewDate: parseDate(body.occReviewDate),
      occAttendanceType: body.occAttendanceType ?? null,
      occAttendanceNote: body.occAttendanceNote ?? null,
      disposalType: body.disposalType ?? null,
      disposalDate: parseDate(body.disposalDate),
      reExamPossibleDate: parseDate(body.reExamPossibleDate),
      disabilityClaimDate: parseDate(body.disabilityClaimDate),
      disabilityDispositionType: body.disabilityDispositionType ?? null,
      disabilityGradeType: body.disabilityGradeType ?? null,
      disabilityDispositionGrade: body.disabilityDispositionGrade ?? null,
      disabilityDispositionDate: parseDate(body.disabilityDispositionDate),
      disabilityDispositionNoticeDate: parseDate(body.disabilityDispositionNoticeDate),
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
