import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/law/attachments/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.lawAttachment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/law/attachments/[id]]", err);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}

// PATCH /api/law/attachments/[id] (메타데이터 수정 — 파일 미변경)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { number, title, description, attachmentType } = body;
    const updated = await prisma.lawAttachment.update({
      where: { id },
      data: {
        ...(typeof number !== "undefined" && { number }),
        ...(typeof title !== "undefined" && { title }),
        ...(typeof description !== "undefined" && { description }),
        ...(typeof attachmentType !== "undefined" && { attachmentType }),
      },
      select: {
        id: true, lawId: true, attachmentType: true, number: true,
        title: true, description: true, fileName: true, contentType: true,
        fileSize: true, createdAt: true, updatedAt: true,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/law/attachments/[id]]", err);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
