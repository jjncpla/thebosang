import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCopdCaseStatus } from "@/lib/copd-status";

/**
 * COPD Case 상태 자동 재계산 cron.
 *
 * 배경:
 *   - reExamPossibleDate(재진행가능일)가 입력되어 있고 examResult="수치미달"인 회차는
 *     deriveCopdStatus 룰에 따라 도래일(date <= today) 시점에 "수치미달" → "재진행가능"
 *     으로 자동 전이되어야 한다.
 *   - 그러나 deriveCopdStatus는 회차 PUT/POST/DELETE 시점에만 호출되므로,
 *     사용자가 회차 화면을 1년간 안 열면 status가 영원히 "수치미달"로 박제된다.
 *
 * 동작:
 *   - status="수치미달" 인 모든 Case 또는 reExamPossibleDate가 미래/오늘인 회차를 가진 모든 Case
 *     를 대상으로 syncCopdCaseStatus 호출.
 *   - 안전을 위해 폭넓게 수치미달 + 보류 + 접수대기/접수완료 등 정체 가능한 상태도 대상에 포함
 *     (재계산은 멱등이므로 비용은 적음).
 *
 * 호출:
 *   - Railway Cron 매일 00:15 KST 권장 (objection-deadline 00:10 다음).
 *   - Header: { "x-cron-secret": process.env.CRON_SECRET } 또는
 *             "Authorization: Bearer <CRON_SECRET>" 둘 다 허용.
 */

const TARGET_STATUSES = [
  "수치미달",
  "재진행가능", // 재계산 시 다른 회차에서 더 진행된 상태로 갱신될 가능성
  "보류",
  "접수대기",
  "접수완료",
  "특진중",
  "특진완료",
  "전문의뢰",
  "전문완료",
];

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === secret) return true;
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // COPD 사건만 대상 (caseType 필드가 표준)
    const cases = await prisma.case.findMany({
      where: {
        caseType: "COPD",
        status: { in: TARGET_STATUSES },
      },
      select: { id: true, status: true },
    });

    let processed = 0;
    let changed = 0;
    let unchanged = 0;
    let errored = 0;
    const transitions: Array<{ caseId: string; from: string | null; to: string | null }> = [];

    for (const c of cases) {
      try {
        const next = await syncCopdCaseStatus(c.id);
        processed++;
        if (next && next !== c.status) {
          changed++;
          transitions.push({ caseId: c.id, from: c.status, to: next });
        } else {
          unchanged++;
        }
      } catch (e) {
        errored++;
        console.error("[cron/recalculate-copd-status] case error:", c.id, e);
      }
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      stats: {
        targetCount: cases.length,
        processed,
        changed,
        unchanged,
        errored,
      },
      transitions: transitions.slice(0, 100), // 응답 폭주 방지
    });
  } catch (error) {
    console.error("[cron/recalculate-copd-status] fatal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 로컬 테스트용 GET (개발환경 한정)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  return POST(req);
}
