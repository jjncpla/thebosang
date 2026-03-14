import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.pneumoconiosisDetail.findUnique({ where: { caseId } });
    return NextResponse.json(detail ?? {});
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/pneumoconiosis]", err);
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

    const data = {
      firstClinic: body.firstClinic ?? null,
      firstExamDate: parseDate(body.firstExamDate),
      isNoticeReceived: body.isNoticeReceived === true,
      precisionExamDate: parseDate(body.precisionExamDate),
      precisionResult: body.precisionResult ?? null,
      precisionHospital: body.precisionHospital ?? null,
      precisionPossibleDate: parseDate(body.precisionPossibleDate),
      reExamPossibleDate: parseDate(body.reExamPossibleDate),
      disposalType: body.disposalType ?? null,
      disposalDate: parseDate(body.disposalDate),
    };

    const detail = await prisma.pneumoconiosisDetail.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });

    return NextResponse.json(detail);
  } catch (err) {
    console.error("[PUT /api/cases/[caseId]/pneumoconiosis]", err);
    return NextResponse.json({ error: "저장 오류" }, { status: 500 });
  }
}
