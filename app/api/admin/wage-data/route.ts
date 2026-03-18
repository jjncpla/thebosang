import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const items = await prisma.wageReviewData.findMany({
      select: { id: true, tfName: true, patientName: true, caseType: true, decisionDate: true },
      orderBy: { patientName: "asc" },
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error("[GET /api/admin/wage-data]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = body.ids;

  try {
    if (Array.isArray(ids) && ids.length > 0) {
      const result = await prisma.wageReviewData.deleteMany({ where: { id: { in: ids } } });
      return NextResponse.json({ success: true, deleted: result.count, message: `평균임금 데이터 ${result.count}건이 삭제되었습니다.` });
    } else {
      const result = await prisma.wageReviewData.deleteMany({});
      return NextResponse.json({ success: true, deleted: result.count, message: `평균임금 데이터 ${result.count}건이 삭제되었습니다.` });
    }
  } catch (err) {
    console.error("[DELETE /api/admin/wage-data]", err);
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
