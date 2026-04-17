import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const chatrooms = await prisma.telegramChatRoom.findMany({
    orderBy: { registeredAt: "desc" },
    include: {
      messages: {
        select: { sentAt: true },
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
  });

  const result = chatrooms.map((room) => ({
    chatId: room.chatId,
    chatName: room.chatName,
    roomType: room.roomType,
    tfName: room.tfName,
    isActive: room.isActive,
    registeredAt: room.registeredAt,
    note: room.note,
    lastMessageAt: room.messages[0]?.sentAt ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { chatId, chatName, roomType, tfName, note } = body;

  if (!chatId || !chatName || !roomType) {
    return NextResponse.json({ error: "chatId, chatName, roomType은 필수입니다." }, { status: 400 });
  }
  if (!["schedule", "tf_work", "company_notice"].includes(roomType)) {
    return NextResponse.json({ error: "roomType이 유효하지 않습니다." }, { status: 400 });
  }
  if (roomType === "tf_work" && !tfName) {
    return NextResponse.json({ error: "TF 업무방은 tfName이 필수입니다." }, { status: 400 });
  }

  const existing = await prisma.telegramChatRoom.findUnique({ where: { chatId } });
  if (existing) {
    return NextResponse.json({ error: "이미 등록된 chatId입니다." }, { status: 409 });
  }

  const chatroom = await prisma.telegramChatRoom.create({
    data: {
      chatId,
      chatName,
      roomType,
      tfName: roomType === "tf_work" ? tfName : null,
      note: note ?? null,
    },
  });

  return NextResponse.json(chatroom, { status: 201 });
}
