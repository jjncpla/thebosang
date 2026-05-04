import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCopdCaseStatus, syncCopdCaseEvents } from "@/lib/copd-status";

// COPD 회차별 신청 목록 조회 / 신규 회차 추가
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.copdDetail.findUnique({
      where: { caseId },
      include: { applications: { orderBy: { applicationRound: "asc" } } },
    });
    return NextResponse.json(detail?.applications ?? []);
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/copd/applications]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

// 새 신청 회차 생성 (다음 회차 번호 자동)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    // CopdDetail 보장 (없으면 생성)
    const detail = await prisma.copdDetail.upsert({
      where: { caseId },
      create: { caseId },
      update: {},
      include: { applications: { orderBy: { applicationRound: "desc" }, take: 1 } },
    });

    const lastRound = detail.applications[0]?.applicationRound ?? 0;

    const created = await prisma.copdApplication.create({
      data: {
        copdDetailId: detail.id,
        applicationRound: lastRound + 1,
      },
    });

    await syncCopdCaseStatus(caseId);
    await syncCopdCaseEvents(caseId);

    return NextResponse.json(created);
  } catch (err) {
    console.error("[POST /api/cases/[caseId]/copd/applications]", err);
    const msg = err instanceof Error ? err.message : "생성 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
