import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { syncFromObjectionReview } from "@/lib/case-sync";

/**
 * POST /api/objection/review/bulk-update
 * body: { ids: string[], progressStatus?: string, approvalStatus?: string, infoDisclosureStatus?: string }
 *
 * 처분검토 레코드 여러 건을 한 번에 업데이트. 상태 매핑에 따라 Case/HL도 싱크.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids 필요" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.progressStatus === "string") data.progressStatus = body.progressStatus;
  if (typeof body.approvalStatus === "string") data.approvalStatus = body.approvalStatus;
  if (body.infoDisclosureStatus !== undefined) {
    data.infoDisclosureStatus = body.infoDisclosureStatus || null;
    data.hasInfoDisclosure = body.infoDisclosureStatus === "확보" || body.infoDisclosureStatus === "평임확보";
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 필드 없음" }, { status: 400 });
  }

  // 1) updateMany로 일괄 업데이트
  const result = await prisma.objectionReview.updateMany({
    where: { id: { in: ids } },
    data,
  });

  // 2) 소음성 난청 & caseId 있는 건은 Case/HL 싱크 (순차 처리로 충돌 방지)
  if (data.progressStatus || data.approvalStatus) {
    const affected = await prisma.objectionReview.findMany({
      where: { id: { in: ids }, caseType: "HEARING_LOSS", caseId: { not: null } },
      select: { id: true },
    });
    for (const r of affected) {
      await syncFromObjectionReview(r.id).catch((e) => {
        console.error("[bulk-update sync]", r.id, e);
      });
    }
  }

  return NextResponse.json({ ok: true, count: result.count });
}
