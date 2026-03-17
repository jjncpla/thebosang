import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { tfName, patientName, caseType, approvalStatus, progressStatus, decisionDate, hasInfoDisclosure, memo, caseId } = body;

  const item = await prisma.objectionReview.update({
    where: { id },
    data: {
      tfName,
      patientName,
      caseType,
      approvalStatus,
      progressStatus,
      decisionDate: decisionDate ? new Date(decisionDate) : null,
      hasInfoDisclosure: !!hasInfoDisclosure,
      memo: memo || null,
      caseId: caseId || null,
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.objectionReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
