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
            hearingLoss: true,
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
