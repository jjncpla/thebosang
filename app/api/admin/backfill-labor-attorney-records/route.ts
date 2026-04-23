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
 * Railway 요청 타임아웃(~30초) 회피를 위해 배치로 제한 — 반복 호출 필요
 *
 * query:
 *   limit=20         — 한 번에 처리할 건수 (default 20)
 *   skipExisting=true — 이미 첨부된 건 스킵 (default true)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? "20")));
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

  // 이미 생성된 것 제외
  const existingSet = new Set<string>();
  if (skipExisting) {
    const existing = await prisma.caseAttachment.findMany({
      where: { category: "LABOR_ATTORNEY_RECORD", caseId: { in: targets.map(t => t.id) } },
      select: { caseId: true },
    });
    existing.forEach(e => existingSet.add(e.caseId));
  }

  const pending = targets.filter(t => !existingSet.has(t.id));
  const batch = pending.slice(0, limit);

  let done = 0, failed = 0;
  const errors: string[] = [];
  for (const c of batch) {
    try {
      const res = await generateAndStoreLaborAttorneyRecord(c.id);
      if (res.created) done++;
      else failed++;
    } catch (e) {
      failed++;
      errors.push(`${c.id}: ${String(e).slice(0, 80)}`);
    }
  }

  return NextResponse.json({
    totalTargets: targets.length,
    alreadyStored: existingSet.size,
    remaining: Math.max(0, pending.length - done - failed),
    processedThisCall: batch.length,
    created: done,
    failed,
    errorsSample: errors.slice(0, 3),
    hasMore: pending.length > limit,
  });
}
