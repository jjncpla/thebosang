import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  try {
    const result = await prisma.consultation.deleteMany({});
    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `상담내역 ${result.count}건이 삭제되었습니다.`,
    });
  } catch (err) {
    console.error("[DELETE /api/admin/delete-consultations]", err);
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
