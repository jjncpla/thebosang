import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateAndStoreLaborAttorneyRecord } from "@/lib/pdf/labor-attorney-record";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/backfill-labor-attorney-records
 *
 * 처분 결정 완료된 Case들에 대해 공인노무사 업무처리부 PDF를 일괄 생성/저장
 * query: skipExisting=true|false (default true) — 이미 첨부된 건 스킵
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const skipExisting = req.nextUrl.searchParams.get("skipExisting") !== "false";

  const targets = await prisma.case.findMany({
    where: {
      OR: [
        { status: { in: ["APPROVED", "REJECTED"] } },
        { closedReason: { in: ["반려", "파기"] } },
        { objectionReviews: { some: { approvalStatus: { in: ["승인", "불승인", "일부승인"] } } } },
      ],
    },
    select: { id: true },
  });

  const existing = skipExisting
    ? await prisma.caseAttachment.findMany({
        where: { category: "LABOR_ATTORNEY_RECORD", caseId: { in: targets.map(t => t.id) } },
        select: { caseId: true },
      })
    : [];
  const existingSet = new Set(existing.map(e => e.caseId));

  let done = 0, skipped = 0, failed = 0;
  const errors: string[] = [];
  for (const c of targets) {
    if (existingSet.has(c.id)) { skipped++; continue; }
    try {
      const res = await generateAndStoreLaborAttorneyRecord(c.id);
      if (res.created) done++;
      else failed++;
    } catch (e) {
      failed++;
      errors.push(`${c.id}: ${String(e).slice(0, 100)}`);
    }
  }

  return NextResponse.json({
    total: targets.length,
    created: done,
    skipped,
    failed,
    errorsSample: errors.slice(0, 5),
  });
}
