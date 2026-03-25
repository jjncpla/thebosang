import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ═══════════════════════════════════════════════════════════════
   GET /api/telegram/cron-notify
   — 크론/외부 스케줄러에서 매일 오전 9시 호출
   — 오늘 기한인 미완료 Todo를 텔레그램 채널로 알림 발송
   호출 예: GET https://thebosang-production.up.railway.app/api/telegram/cron-notify
           헤더: Authorization: Bearer {CRON_SECRET}
   ═══════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  // 크론 시크릿 검증
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN 미설정" }, { status: 500 });
  }

  const chatId = process.env.TBSS_NOTIFY_CHAT_ID;
  if (!chatId) {
    return NextResponse.json({ error: "TBSS_NOTIFY_CHAT_ID 미설정" }, { status: 500 });
  }

  // 오늘 기한인 미완료 Todo 조회 (KST 기준)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayStart = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstOffset
  );
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const dueTodos = await prisma.todo.findMany({
    where: {
      isDone: false,
      dueDate: { gte: todayStart, lt: tomorrowStart },
    },
    include: {
      user: { select: { name: true } },
    },
  });

  if (dueTodos.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const dateStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;
  const messageLines = [`📋 <b>오늘의 TBSS 할일 (${dueTodos.length}건)</b> — ${dateStr}\n`];
  for (const todo of dueTodos) {
    messageLines.push(`• ${todo.title} (${todo.user?.name ?? "담당자 미지정"})`);
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: messageLines.join("\n"),
      parse_mode: "HTML",
    }),
  });

  return NextResponse.json({ ok: true, sent: dueTodos.length });
}
