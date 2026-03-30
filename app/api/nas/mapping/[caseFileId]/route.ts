import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ caseFileId: string }> }
) {
  try {
    const { caseFileId } = await params;
    await prisma.caseFile.delete({ where: { id: caseFileId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/nas/mapping/:id]", err);
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
