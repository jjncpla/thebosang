import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tfName, patientName, caseType, approvalStatus, progressStatus, decisionDate, hasInfoDisclosure, memo, caseId } = body;

  const item = await prisma.objectionReview.update({
    where: { id: params.id },
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.objectionReview.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
