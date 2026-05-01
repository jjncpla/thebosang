import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const KWC_LAW_ID = "kwc-guideline";

// DELETE /api/kwc-guideline/[id] (ADMIN 전용)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

  const { id } = await params;
  try {
    // KWC 지침에 한해서만 삭제 허용 (다른 lawId 지키기)
    const target = await prisma.lawAttachment.findUnique({ where: { id }, select: { lawId: true } });
    if (!target || target.lawId !== KWC_LAW_ID) {
      return NextResponse.json({ error: "찾을 수 없음" }, { status: 404 });
    }
    await prisma.lawAttachment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/kwc-guideline/[id]]", err);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}

// PATCH /api/kwc-guideline/[id] (ADMIN 전용 — 메타데이터 수정)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const target = await prisma.lawAttachment.findUnique({ where: { id }, select: { lawId: true } });
    if (!target || target.lawId !== KWC_LAW_ID) {
      return NextResponse.json({ error: "찾을 수 없음" }, { status: 404 });
    }
    const body = await req.json();
    const { cat1, cat2, title, description } = body;
    const updated = await prisma.lawAttachment.update({
      where: { id },
      data: {
        ...(typeof cat1 !== "undefined" && { attachmentType: cat1 }),
        ...(typeof cat2 !== "undefined" && { number: cat2 }),
        ...(typeof title !== "undefined" && { title }),
        ...(typeof description !== "undefined" && { description }),
      },
      select: {
        id: true, attachmentType: true, number: true,
        title: true, description: true, fileName: true, contentType: true,
        fileSize: true, createdAt: true, updatedAt: true,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/kwc-guideline/[id]]", err);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
