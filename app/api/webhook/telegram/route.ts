import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (e) {
    console.error("[Telegram Webhook]", e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
