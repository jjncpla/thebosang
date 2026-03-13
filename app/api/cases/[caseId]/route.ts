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
        copd: { select: { id: true, status: true, reExamPossibleDate: true } },
        pneumoconiosis: { select: { status: true } },
        musculoskeletal: { select: { status: true } },
        occupationalAccident: { select: { status: true } },
        occupationalCancer: { select: { status: true } },
        bereaved: { select: { status: true } },
      },
    });
    if (!c) return NextResponse.json({ error: "없음" }, { status: 404 });

    // COPD 수치미달 → 재진행가능 자동 업데이트
    if (
      c.caseType === "COPD" &&
      c.copd?.status === "수치미달" &&
      c.copd.reExamPossibleDate != null &&
      c.copd.reExamPossibleDate <= new Date()
    ) {
      await prisma.copdDetail.update({ where: { id: c.copd.id }, data: { status: "재진행가능" } });
      return NextResponse.json({ ...c, copd: { ...c.copd, status: "재진행가능" } });
    }

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
      caseType: newCaseType, caseNumber, tfName, branch, subAgent,
      branchManager, salesManager, caseManager, salesRoute,
      contractDate, receptionDate, isOneStop, status, memo,
    } = body;

    // Upsert status to the appropriate Detail first
    if (status !== undefined) {
      const existing = await prisma.case.findUnique({ where: { id: caseId }, select: { caseType: true } });
      const ct = existing?.caseType ?? "HEARING_LOSS";
      const detailArgs = { where: { caseId }, create: { caseId, status }, update: { status } };
      if (ct === "HEARING_LOSS") await prisma.hearingLossDetail.upsert(detailArgs);
      else if (ct === "COPD") await prisma.copdDetail.upsert(detailArgs);
      else if (ct === "PNEUMOCONIOSIS") await prisma.pneumoconiosisDetail.upsert(detailArgs);
      else if (ct === "MUSCULOSKELETAL") await prisma.musculoskeletalDetail.upsert(detailArgs);
      else if (ct === "OCCUPATIONAL_ACCIDENT") await prisma.occupationalAccidentDetail.upsert(detailArgs);
      else if (ct === "OCCUPATIONAL_CANCER") await prisma.occupationalCancerDetail.upsert(detailArgs);
      else if (ct === "BEREAVED") await prisma.bereavedDetail.upsert(detailArgs);
    }

    const updated = await prisma.case.update({
      where: { id: caseId },
      data: {
        ...(newCaseType !== undefined && { caseType: newCaseType }),
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
        ...(memo !== undefined && { memo }),
      },
      include: {
        patient: true,
        hearingLoss: true,
        copd: { select: { id: true, status: true, reExamPossibleDate: true } },
        pneumoconiosis: { select: { status: true } },
        musculoskeletal: { select: { status: true } },
        occupationalAccident: { select: { status: true } },
        occupationalCancer: { select: { status: true } },
        bereaved: { select: { status: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/cases/[caseId]]", err);
    return NextResponse.json({ error: "수정 오류" }, { status: 500 });
  }
}
