import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  try {
    // ObjectionCase.reviewId → ObjectionReview FK 제약 해제 후 삭제
    await prisma.objectionCase.updateMany({ data: { reviewId: null } });
    const result = await prisma.objectionReview.deleteMany({});
    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `처분검토 ${result.count}건이 삭제되었습니다.`,
    });
  } catch (err) {
    console.error("[DELETE /api/admin/delete-objection-reviews]", err);
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
