import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getMatchCandidates,
  type ParsedResolutionNotice,
} from "@/lib/decision-notice-parser";

export const dynamic = "force-dynamic";

/**
 * GET /api/resolution-notice/[id]/match-case
 * 매칭 후보 목록 조회 (DB의 ResolutionNotice 기준).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "";
  if (role === "이산계정") {
    return NextResponse.json({ error: "권한 부족" }, { status: 403 });
  }

  const { id } = await params;
  const notice = await prisma.resolutionNotice.findUnique({ where: { id } });
  if (!notice) return NextResponse.json({ error: "not found" }, { status: 404 });

  // parsedData에서 ParsedResolutionNotice 복원
  const parsed = notice.parsedData as unknown as ParsedResolutionNotice;
  const candidates = await getMatchCandidates(parsed, prisma);

  return NextResponse.json({ candidates, count: candidates.length });
}

/**
 * POST /api/resolution-notice/[id]/match-case
 * body: { caseId: string }
 * → ResolutionNotice.caseId/patientId 설정 (적용은 별도 /apply 호출)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "";
  if (role === "이산계정") {
    return NextResponse.json({ error: "권한 부족" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { caseId } = body as { caseId: string };

  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  // Case 존재 확인 + patientId 가져오기
  const targetCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, patientId: true },
  });
  if (!targetCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const updated = await prisma.resolutionNotice.update({
    where: { id },
    data: {
      caseId: targetCase.id,
      patientId: targetCase.patientId,
    },
  });

  return NextResponse.json({ item: updated });
}
