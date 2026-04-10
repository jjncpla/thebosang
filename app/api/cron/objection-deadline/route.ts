import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Railway cron job이 매일 00:10 KST에 호출
// Header: { "x-cron-secret": process.env.CRON_SECRET }
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const DEADLINE_DAYS = 90; // 이의신청 제척기간
  const ALERT_DAYS = [30, 14, 7]; // 임박 알림 기준

  let created = 0;
  let skipped = 0;

  try {
    // ObjectionCase에서 decisionDate 있는 건 전체 조회
    const objectionCases = await prisma.objectionCase.findMany({
      where: {
        decisionDate: { not: null },
      },
      include: {
        case: {
          select: {
            id: true,
            caseManagerId: true,
          },
        },
      },
    });

    for (const obj of objectionCases) {
      if (!obj.decisionDate || !obj.case) continue;

      const expiryDate = new Date(obj.decisionDate);
      expiryDate.setDate(expiryDate.getDate() + DEADLINE_DAYS);
      expiryDate.setHours(0, 0, 0, 0);

      const daysLeft = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // D-30, D-14, D-7 해당 여부 확인
      if (!ALERT_DAYS.includes(daysLeft)) continue;

      const assignedTo = obj.case.caseManagerId ?? null;
      const caseId = obj.case.id;
      const dueDateStr = expiryDate.toISOString().split("T")[0];

      // 중복 체크: 동일 caseId + OBJECTION_DEADLINE + dueDate 조합
      const existing = await prisma.todo.findFirst({
        where: {
          caseId,
          type: "OBJECTION_DEADLINE",
          dueDate: expiryDate,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Todo 생성
      await prisma.todo.create({
        data: {
          title: `[제척 D-${daysLeft}] ${obj.patientName ?? ""} — 이의신청 제척기간 임박`,
          type: "OBJECTION_DEADLINE",
          dueDate: expiryDate,
          caseId,
          patientName: obj.patientName ?? null,
          assignedTo,
          isDone: false,
          memo: `처분일: ${obj.decisionDate.toISOString().split("T")[0]} / 제척기간 만료: ${dueDateStr}`,
        },
      });
      created++;
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      checkedAt: today.toISOString(),
    });
  } catch (error) {
    console.error("[cron/objection-deadline] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 로컬 테스트용 GET (개발환경에서만)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  return POST(req);
}
