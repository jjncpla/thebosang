import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        patient: true,
        hearingLoss: true,
      },
    });
    if (!c) return NextResponse.json({ error: "없음" }, { status: 404 });
    return NextResponse.json(c);
  } catch (err) {
    console.error("[GET /api/cases/[caseId]]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const body = await req.json();
    const {
      caseType, caseNumber, tfName, branch, subAgent,
      branchManager, salesManager, caseManager, salesRoute,
      contractDate, receptionDate, isOneStop, status, memo,
    } = body;

    const updated = await prisma.case.update({
      where: { id: caseId },
      data: {
        ...(caseType !== undefined && { caseType }),
        ...(caseNumber !== undefined && { caseNumber }),
        ...(tfName !== undefined && { tfName }),
        ...(branch !== undefined && { branch }),
        ...(subAgent !== undefined && { subAgent }),
        ...(branchManager !== undefined && { branchManager }),
        ...(salesManager !== undefined && { salesManager }),
        ...(caseManager !== undefined && { caseManager }),
        ...(salesRoute !== undefined && { salesRoute }),
        ...(contractDate !== undefined && { contractDate: contractDate ? new Date(contractDate) : null }),
        ...(receptionDate !== undefined && { receptionDate: receptionDate ? new Date(receptionDate) : null }),
        ...(isOneStop !== undefined && { isOneStop }),
        ...(status !== undefined && { status }),
        ...(memo !== undefined && { memo }),
      },
      include: {
        patient: true,
        hearingLoss: true,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/cases/[caseId]]", err);
    return NextResponse.json({ error: "수정 오류" }, { status: 500 });
  }
}
