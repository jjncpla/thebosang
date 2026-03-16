import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        cases: {
          orderBy: { createdAt: "desc" },
          include: {
            hearingLoss: {
              include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } }
            },
            copd: true,
            pneumoconiosis: true,
            musculoskeletal: { select: { id: true } },
            occupationalAccident: { select: { id: true } },
            occupationalCancer: { select: { id: true } },
            bereaved: { select: { id: true } },
          },
        },
      },
    });
    if (!patient) return NextResponse.json({ error: "없음" }, { status: 404 });
    return NextResponse.json(patient);
  } catch (err) {
    console.error("[GET /api/patients/[patientId]]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  try {
    const body = await req.json();
    const { name, ssn, phone, address, memo } = body;
    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        ...(name !== undefined && { name }),
        ...(ssn !== undefined && { ssn }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(memo !== undefined && { memo }),
      },
    });
    return NextResponse.json(patient);
  } catch (err) {
    console.error("[PATCH /api/patients/[patientId]]", err);
    return NextResponse.json({ error: "수정 오류" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  try {
    const cases = await prisma.case.findMany({ where: { patientId }, select: { id: true } });
    const caseIds = cases.map(c => c.id);

    if (caseIds.length > 0) {
      await prisma.hearingLossDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.copdDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.pneumoconiosisDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.musculoskeletalDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.occupationalAccidentDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.occupationalCancerDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.bereavedDetail.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.case.deleteMany({ where: { patientId } });
    }

    await prisma.patient.delete({ where: { id: patientId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/patients/[patientId]]", err);
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
