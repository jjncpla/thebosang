/* app/api/telegram/webhook/route.ts */
import { NextRequest, NextResponse } from "next/server";
import { tfMessages } from "@/lib/tfstore";
import type { Message } from "@/lib/tfstore";

/* ═══════════════════════════════════════════════════════════════
   Telegram Update 타입 (필요한 필드만 선언)
   ═══════════════════════════════════════════════════════════════ */
interface TelegramDocument {
  file_id:   string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  text?:       string;
  date:        number;           // Unix timestamp (초 단위)
  document?:   TelegramDocument;
}

interface TelegramUpdate {
  update_id: number;
  message?:  TelegramMessage;
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/telegram/webhook
   — Telegram Bot API 웹훅 수신 엔드포인트
   ═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
    console.log("🔥 webhook hit");
  let body: TelegramUpdate;

  try {
    body = await req.json();
    console.log("📩 텔레그램 데이터:", body);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const tgMsg = body.message;

  // message 필드가 없으면 (편집, 채널 포스트 등) 그냥 200 반환
  if (!tgMsg) {
    return NextResponse.json({ ok: true });
  }

  /* ── 파일 URL 처리 ──
     실제 운영 시에는 Telegram Bot API를 호출해서
     file_id → file_path → download URL 을 얻어야 합니다.
     여기서는 file_id를 그대로 저장하고 필요 시 서버에서 처리합니다.  */
  let file_url  = "";
  let file_name = "";

  if (tgMsg.document) {
    const doc = tgMsg.document;
    file_name = doc.file_name ?? doc.file_id;
    // 실제 환경에서는 아래처럼 Bot API를 통해 URL 생성:
    // const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
    // const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${doc.file_id}`);
    // const fileData = await fileRes.json();
    // file_url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
    file_url = `https://api.telegram.org/file/bot__TOKEN__/${doc.file_id}`;
  }

  /* ── Message 객체 생성 ── */
  const newMessage: Message = {
    id:        tgMsg.message_id,
    text:      tgMsg.text,
    date:      tgMsg.date * 1000,   // Telegram은 초 단위 → ms로 변환
    file_url,
    file_name,
  };

  /* ── 인메모리 배열에 push (최대 100건 유지) ── */
  tfMessages.push(newMessage);
  if (tfMessages.length > 100) {
    tfMessages.splice(0, tfMessages.length - 100);
  }

  return NextResponse.json({ ok: true });
}

