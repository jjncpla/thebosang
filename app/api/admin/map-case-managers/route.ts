import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * GET: 담당자 미매핑 현황 조회
 * - salesManagerId 또는 caseManagerId가 null인 Case 수
 * - 이름 기반 자동 매핑 가능한 건수 (Contact.userId를 활용)
 */
export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  try {
    const [totalCases, unmappedSales, unmappedCase_] = await Promise.all([
      prisma.case.count(),
      prisma.case.count({ where: { salesManagerId: null } }),
      prisma.case.count({ where: { caseManagerId: null } }),
    ]);

    // User 목록 (이름 → id 매핑용)
    const users = await prisma.user.findMany({ select: { id: true, name: true } });
    const userMap = new Map<string, string>();
    for (const u of users) {
      userMap.set(u.name.trim(), u.id);
    }

    return NextResponse.json({
      totalCases,
      unmappedSalesManager: unmappedSales,
      unmappedCaseManager: unmappedCase_,
      totalUsers: users.length,
      userNames: users.map((u) => u.name),
    });
  } catch (err) {
    console.error("[GET /api/admin/map-case-managers]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

/**
 * POST: 이름 기반 담당자 일괄 매핑
 * body: { mappings: [{ caseName?: string, tfName?: string, salesManagerName?: string, caseManagerName?: string }] }
 *
 * 또는 자동 모드:
 * body: { auto: true }
 * → 같은 TF 내에서 가장 많이 등장하는 담당자를 매핑
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // User 이름 → id 매핑
    const users = await prisma.user.findMany({ select: { id: true, name: true } });
    const userMap = new Map<string, string>();
    for (const u of users) {
      userMap.set(u.name.trim(), u.id);
    }

    if (body.auto) {
      // 자동 모드: TF별 가장 빈번한 salesManager/caseManager 패턴으로 빈 FK 채우기
      const allCases = await prisma.case.findMany({
        select: {
          id: true,
          tfName: true,
          salesManagerId: true,
          caseManagerId: true,
        },
      });

      // TF별로 가장 많이 배정된 담당자 찾기
      const tfSalesCount: Record<string, Record<string, number>> = {};
      const tfCaseCount: Record<string, Record<string, number>> = {};

      for (const c of allCases) {
        const tf = c.tfName ?? "__NONE__";
        if (c.salesManagerId) {
          tfSalesCount[tf] = tfSalesCount[tf] ?? {};
          tfSalesCount[tf][c.salesManagerId] = (tfSalesCount[tf][c.salesManagerId] ?? 0) + 1;
        }
        if (c.caseManagerId) {
          tfCaseCount[tf] = tfCaseCount[tf] ?? {};
          tfCaseCount[tf][c.caseManagerId] = (tfCaseCount[tf][c.caseManagerId] ?? 0) + 1;
        }
      }

      // TF별 최빈 담당자
      function mostFrequent(counts: Record<string, number>): string | null {
        let best: string | null = null;
        let bestN = 0;
        for (const [id, n] of Object.entries(counts)) {
          if (n > bestN) { best = id; bestN = n; }
        }
        return best;
      }

      let updatedSales = 0;
      let updatedCase_ = 0;

      for (const c of allCases) {
        const tf = c.tfName ?? "__NONE__";
        const updates: Record<string, string> = {};

        if (!c.salesManagerId && tfSalesCount[tf]) {
          const bestSales = mostFrequent(tfSalesCount[tf]);
          if (bestSales) updates.salesManagerId = bestSales;
        }
        if (!c.caseManagerId && tfCaseCount[tf]) {
          const bestCase = mostFrequent(tfCaseCount[tf]);
          if (bestCase) updates.caseManagerId = bestCase;
        }

        if (Object.keys(updates).length > 0) {
          await prisma.case.update({ where: { id: c.id }, data: updates });
          if (updates.salesManagerId) updatedSales++;
          if (updates.caseManagerId) updatedCase_++;
        }
      }

      return NextResponse.json({
        ok: true,
        mode: "auto",
        updatedSalesManager: updatedSales,
        updatedCaseManager: updatedCase_,
      });
    }

    // 수동 매핑 모드: { mappings: [{ caseId, salesManagerName, caseManagerName }] }
    if (body.mappings && Array.isArray(body.mappings)) {
      let updated = 0;
      for (const m of body.mappings) {
        const data: Record<string, string | null> = {};
        if (m.salesManagerName) {
          data.salesManagerId = userMap.get(m.salesManagerName.trim()) ?? null;
        }
        if (m.caseManagerName) {
          data.caseManagerId = userMap.get(m.caseManagerName.trim()) ?? null;
        }
        if (Object.values(data).some((v) => v !== null)) {
          await prisma.case.update({ where: { id: m.caseId }, data });
          updated++;
        }
      }
      return NextResponse.json({ ok: true, mode: "manual", updated });
    }

    return NextResponse.json({ error: "auto 또는 mappings 파라미터 필요" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/admin/map-case-managers]", err);
    return NextResponse.json({ error: "매핑 오류" }, { status: 500 });
  }
}
