import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chatId } = await params;

  const existing = await prisma.telegramChatRoom.findUnique({ where: { chatId } });
  if (!existing) {
    return NextResponse.json({ error: "채팅방을 찾을 수 없습니다." }, { status: 404 });
  }

  const messageCount = await prisma.telegramMessage.count({ where: { chatId } });
  if (messageCount > 0) {
    return NextResponse.json({
      success: false,
      error: "MESSAGES_EXIST",
      message: "이미 메시지가 수신된 채팅방은 삭제할 수 없습니다. 비활성화를 사용해주세요.",
      messageCount,
    }, { status: 409 });
  }

  await prisma.telegramChatRoom.delete({ where: { chatId } });
  return NextResponse.json({ success: true, deletedChatId: chatId });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chatId } = await params;
  const body = await req.json();

  const existing = await prisma.telegramChatRoom.findUnique({ where: { chatId } });
  if (!existing) {
    return NextResponse.json({ error: "채팅방을 찾을 수 없습니다." }, { status: 404 });
  }

  const { chatName, roomType, tfName, isActive, note } = body;
  const updateData: Record<string, unknown> = {};

  if (chatName !== undefined) updateData.chatName = chatName;
  if (roomType !== undefined) {
    if (!["schedule", "tf_work", "company_notice"].includes(roomType)) {
      return NextResponse.json({ error: "roomType이 유효하지 않습니다." }, { status: 400 });
    }
    updateData.roomType = roomType;
  }
  if (tfName !== undefined) updateData.tfName = tfName;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (note !== undefined) updateData.note = note;

  const updated = await prisma.telegramChatRoom.update({
    where: { chatId },
    data: updateData,
  });

  return NextResponse.json(updated);
}
