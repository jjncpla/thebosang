import { NextRequest, NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/telegram/notify
   — 외부에서 텔레그램 알림 push용 엔드포인트
   body: { message: string, chatId?: string }
   chatId 미지정 시 TELEGRAM_ALLOWED_USER_IDS의 모든 유저에게 전송
   ═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" },
      { status: 500 }
    );
  }

  let body: { message?: string; chatId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const message = body.message;
  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { ok: false, error: "message field is required" },
      { status: 400 }
    );
  }

  // chatId가 지정되면 해당 유저에게만, 아니면 허용된 모든 유저에게 전송
  const targetIds: string[] = body.chatId
    ? [body.chatId]
    : (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (targetIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No target chat IDs" },
      { status: 400 }
    );
  }

  const results = await Promise.allSettled(
    targetIds.map(async (chatId) => {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
          }),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Telegram API error for ${chatId}: ${err}`);
      }
      return chatId;
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ ok: true, sent, failed });
}
