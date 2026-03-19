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
        salesManager: { select: { id: true, name: true } },
        caseManager: { select: { id: true, name: true } },
        branchManager: { select: { id: true, name: true } },
        hearingLoss: {
          include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } },
        },
        copd: { select: { id: true } },
        pneumoconiosis: { select: { id: true } },
        musculoskeletal: { select: { id: true } },
        occupationalAccident: { select: { id: true } },
        occupationalCancer: { select: { id: true } },
        bereaved: { select: { id: true } },
      },
    });
    if (!c) return NextResponse.json({ error: "없음" }, { status: 404 });

    // BasicInfoTab 호환을 위해 manager 이름을 flat string으로 변환
    return NextResponse.json({
      ...c,
      salesManager: c.salesManager?.name ?? null,
      caseManager: c.caseManager?.name ?? null,
      branchManager: c.branchManager?.name ?? null,
    });
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
      caseType: newCaseType, tfName, branch, subAgent,
      salesRoute, contractDate, receptionDate, isOneStop, status, memo,
    } = body;

    const workHistoryData: Record<string, unknown> = {}
    if (body.workHistory !== undefined) workHistoryData.workHistory = body.workHistory
    if (body.workHistoryDaily !== undefined) workHistoryData.workHistoryDaily = body.workHistoryDaily
    if (body.workHistoryRaw !== undefined) workHistoryData.workHistoryRaw = body.workHistoryRaw
    if (body.workHistoryMemo !== undefined) workHistoryData.workHistoryMemo = body.workHistoryMemo
    if (body.lastNoiseWorkEndDate !== undefined) {
      workHistoryData.lastNoiseWorkEndDate = body.lastNoiseWorkEndDate ? new Date(body.lastNoiseWorkEndDate) : null
    }

    const updated = await prisma.case.update({
      where: { id: caseId },
      data: {
        ...(newCaseType !== undefined && { caseType: newCaseType }),
        ...(tfName !== undefined && { tfName }),
        ...(branch !== undefined && { branch }),
        ...(subAgent !== undefined && { subAgent }),
        ...(salesRoute !== undefined && { salesRoute }),
        ...(contractDate !== undefined && { contractDate: contractDate ? new Date(contractDate) : null }),
        ...(receptionDate !== undefined && { receptionDate: receptionDate ? new Date(receptionDate) : null }),
        ...(isOneStop !== undefined && { isOneStop }),
        ...(status !== undefined && { status }),
        ...(memo !== undefined && { memo }),
        ...workHistoryData,
      },
      include: {
        patient: true,
        salesManager: { select: { id: true, name: true } },
        caseManager: { select: { id: true, name: true } },
        branchManager: { select: { id: true, name: true } },
        hearingLoss: {
          include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } },
        },
        copd: { select: { id: true } },
        pneumoconiosis: { select: { id: true } },
        musculoskeletal: { select: { id: true } },
        occupationalAccident: { select: { id: true } },
        occupationalCancer: { select: { id: true } },
        bereaved: { select: { id: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      salesManager: updated.salesManager?.name ?? null,
      caseManager: updated.caseManager?.name ?? null,
      branchManager: updated.branchManager?.name ?? null,
    });
  } catch (err) {
    console.error("[PATCH /api/cases/[caseId]]", err);
    return NextResponse.json({ error: "수정 오류" }, { status: 500 });
  }
}
