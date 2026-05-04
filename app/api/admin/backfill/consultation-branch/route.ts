import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * 일회성 백필 API: 모든 Consultation 레코드의 branchName이 비어있으면
 * "더보상 울산지사"로 일괄 설정.
 *
 * 사용법: ADMIN 계정으로 로그인 후 브라우저에서 다음 URL 호출
 *   https://thebosang-production.up.railway.app/api/admin/backfill/consultation-branch
 *
 * idempotent — 이미 채워진 레코드는 건드리지 않음. 여러 번 호출해도 안전.
 */

const TARGET_BRANCH = "더보상 울산지사";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // role이 ADMIN인지 확인
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — ADMIN only" }, { status: 403 });
  }

  // 현재 상태 조회
  const total = await prisma.consultation.count();
  const empty = await prisma.consultation.count({
    where: { OR: [{ branchName: null }, { branchName: "" }] },
  });
  const filled = total - empty;

  if (empty === 0) {
    return NextResponse.json({
      ok: true,
      status: "no_target",
      total,
      filled,
      empty: 0,
      message: "백필 대상 없음 (모든 레코드의 branchName이 이미 채워져 있음)",
    });
  }

  // 백필 실행
  const result = await prisma.consultation.updateMany({
    where: { OR: [{ branchName: null }, { branchName: "" }] },
    data: { branchName: TARGET_BRANCH },
  });

  // 검증
  const remaining = await prisma.consultation.count({
    where: { OR: [{ branchName: null }, { branchName: "" }] },
  });

  return NextResponse.json({
    ok: true,
    status: "done",
    targetBranch: TARGET_BRANCH,
    total,
    beforeFilled: filled,
    beforeEmpty: empty,
    updated: result.count,
    remaining,
    message: `${result.count}건이 "${TARGET_BRANCH}"로 업데이트됨`,
  });
}
