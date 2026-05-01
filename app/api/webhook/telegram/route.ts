import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  recordWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
} from "@/lib/webhook-idempotency";

const WEBHOOK_SOURCE = "telegram" as const;

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tfName = searchParams.get("tf");

  if (!tfName) {
    return NextResponse.json({ error: "tf 파라미터가 필요합니다." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message as Record<string, unknown> | undefined;
  if (!message) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const messageId = String(message.message_id ?? "");
  const chat = message.chat as Record<string, unknown> | undefined;
  const chatId = chat ? String(chat.id ?? "") : "";
  const from = message.from as Record<string, unknown> | undefined;
  const senderName = from
    ? [from.first_name, from.last_name].filter(Boolean).join(" ") || (from.username as string | undefined) || null
    : null;

  const text = (message.text as string | undefined) ?? null;
  const caption = (message.caption as string | undefined) ?? null;
  const content = text ?? caption ?? null;

  // 미디어 타입 판별
  let mediaType: string | null = null;
  if (message.photo) mediaType = "photo";
  else if (message.document) mediaType = "document";
  else if (message.video) mediaType = "video";

  const date = message.date as number | undefined;
  const sentAt = date ? new Date(date * 1000) : new Date();

  // Idempotency: WebhookEvent 기록 (중복 webhook 시 중단)
  // tfName 별로 동일 message_id 가 들어올 수도 있으므로 tf를 externalId에 포함
  const externalId = `${tfName}:${chatId}:${messageId}`;
  const recorded = await recordWebhookEvent(
    WEBHOOK_SOURCE,
    externalId,
    body,
    "tf_message",
  );
  if (recorded.status === "duplicate_skipped") {
    return NextResponse.json({ ok: true, status: "duplicate_skipped" });
  }

  try {
    const saved = await prisma.tfMessage.upsert({
      where: { tfName_messageId: { tfName, messageId } },
      update: {},
      create: {
        tfName,
        messageId,
        senderName,
        content,
        mediaType,
        sentAt,
      },
    });
    await markWebhookProcessed(WEBHOOK_SOURCE, externalId, "webhook");
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[Telegram Webhook]", errMsg);
    await markWebhookFailed(WEBHOOK_SOURCE, externalId, errMsg);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
