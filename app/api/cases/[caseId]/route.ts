import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inferNextStatus, CASE_FIELD_RULES } from "@/lib/status-transition";

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

    // BasicInfoTab 호환: manager 이름 flat + ID도 포함
    return NextResponse.json({
      ...c,
      salesManager: c.salesManager?.name ?? null,
      caseManager: c.caseManager?.name ?? null,
      branchManager: c.branchManager?.name ?? null,
      salesManagerUserId: c.salesManager?.id ?? null,
      caseManagerUserId: c.caseManager?.id ?? null,
      branchManagerUserId: c.branchManager?.id ?? null,
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
      salesManagerId, caseManagerId, branchManagerId,
    } = body;

    // 자동 전이: 사용자가 직접 status를 보내지 않은 경우만
    let autoStatus: string | null = null;
    if (status === undefined) {
      const current = await prisma.case.findUnique({ where: { id: caseId }, select: { status: true } });
      if (current) {
        autoStatus = inferNextStatus(current.status, body, CASE_FIELD_RULES);
      }
    }

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
        ...(status !== undefined ? { status } : autoStatus ? { status: autoStatus } : {}),
        ...(memo !== undefined && { memo }),
        ...(body.kwcOfficeName !== undefined && { kwcOfficeName: body.kwcOfficeName || null }),
        ...(salesManagerId !== undefined && { salesManagerId: salesManagerId || null }),
        ...(caseManagerId !== undefined && { caseManagerId: caseManagerId || null }),
        ...(branchManagerId !== undefined && { branchManagerId: branchManagerId || null }),
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
      salesManagerUserId: updated.salesManager?.id ?? null,
      caseManagerUserId: updated.caseManager?.id ?? null,
      branchManagerUserId: updated.branchManager?.id ?? null,
    });
  } catch (err) {
    console.error("[PATCH /api/cases/[caseId]]", err);
    return NextResponse.json({ error: "수정 오류" }, { status: 500 });
  }
}
