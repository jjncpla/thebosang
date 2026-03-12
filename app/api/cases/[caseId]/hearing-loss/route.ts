import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.hearingLossDetail.findUnique({ where: { caseId } });
    return NextResponse.json(detail ?? {});
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

    const parseDate = (v: unknown) => (v ? new Date(v as string) : null);
    const parseFloat_ = (v: unknown) => (v !== undefined && v !== null && v !== "" ? Number(v) : null);
    const parseInt_ = (v: unknown) => (v !== undefined && v !== null && v !== "" ? parseInt(String(v), 10) : null);

    const data = {
      firstClinic: body.firstClinic ?? null,
      firstExamDate: parseDate(body.firstExamDate),
      firstExamRight: parseFloat_(body.firstExamRight),
      firstExamLeft: parseFloat_(body.firstExamLeft),
      specialClinic: body.specialClinic ?? null,
      preExamDate: parseDate(body.preExamDate),
      exam1Date: parseDate(body.exam1Date),
      exam2Date: parseDate(body.exam2Date),
      exam3Date: parseDate(body.exam3Date),
      airRight1: parseFloat_(body.airRight1),
      airLeft1: parseFloat_(body.airLeft1),
      boneRight1: parseFloat_(body.boneRight1),
      boneLeft1: parseFloat_(body.boneLeft1),
      speechScore1: parseFloat_(body.speechScore1),
      abrRight1: parseFloat_(body.abrRight1),
      abrLeft1: parseFloat_(body.abrLeft1),
      impedanceRight1: body.impedanceRight1 ?? null,
      impedanceLeft1: body.impedanceLeft1 ?? null,
      reExamClinic: body.reExamClinic ?? null,
      reExam1Date: parseDate(body.reExam1Date),
      reExam2Date: parseDate(body.reExam2Date),
      reExam3Date: parseDate(body.reExam3Date),
      airRight2: parseFloat_(body.airRight2),
      airLeft2: parseFloat_(body.airLeft2),
      boneRight2: parseFloat_(body.boneRight2),
      boneLeft2: parseFloat_(body.boneLeft2),
      speechScore2: parseFloat_(body.speechScore2),
      abrRight2: parseFloat_(body.abrRight2),
      abrLeft2: parseFloat_(body.abrLeft2),
      impedanceRight2: body.impedanceRight2 ?? null,
      impedanceLeft2: body.impedanceLeft2 ?? null,
      reReExamClinic: body.reReExamClinic ?? null,
      reReExam1Date: parseDate(body.reReExam1Date),
      reReExam2Date: parseDate(body.reReExam2Date),
      reReExam3Date: parseDate(body.reReExam3Date),
      airRight3: parseFloat_(body.airRight3),
      airLeft3: parseFloat_(body.airLeft3),
      boneRight3: parseFloat_(body.boneRight3),
      boneLeft3: parseFloat_(body.boneLeft3),
      speechScore3: parseFloat_(body.speechScore3),
      abrRight3: parseFloat_(body.abrRight3),
      abrLeft3: parseFloat_(body.abrLeft3),
      impedanceRight3: body.impedanceRight3 ?? null,
      impedanceLeft3: body.impedanceLeft3 ?? null,
      expertOrg: body.expertOrg ?? null,
      expertDate: parseDate(body.expertDate),
      disposalType: body.disposalType ?? null,
      disposalDecidedAt: parseDate(body.disposalDecidedAt),
      disposalReceivedAt: parseDate(body.disposalReceivedAt),
      gradeType: body.gradeType ?? null,
      grade: parseInt_(body.grade),
    };

    const detail = await prisma.hearingLossDetail.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });

    return NextResponse.json(detail);
  } catch (err) {
    console.error("[PUT /api/cases/[caseId]/hearing-loss]", err);
    return NextResponse.json({ error: "저장 오류" }, { status: 500 });
  }
}
