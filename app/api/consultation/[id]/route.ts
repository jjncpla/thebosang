import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, ssn, address, caseTypes, managerId, routeMain, routeSub, routeDetail, visitDate, status, memo, progressNote, reminderDate, branchName, tfName, linkedCaseId } = body;

  const item = await prisma.consultation.update({
    where: { id: params.id },
    data: {
      name,
      phone,
      ssn: ssn || null,
      address: address || null,
      caseTypes: caseTypes || [],
      managerId: managerId || null,
      routeMain: routeMain || null,
      routeSub: routeSub || null,
      routeDetail: routeDetail || null,
      visitDate: visitDate ? new Date(visitDate) : null,
      status: status || "진행중",
      memo: memo || null,
      progressNote: progressNote || null,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      branchName: branchName || null,
      tfName: tfName || null,
      linkedCaseId: linkedCaseId || null,
    },
    include: { manager: { select: { id: true, name: true } } },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.consultation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
