import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { authPrisma } from "@/lib/auth-db";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type) {
      const notice = await authPrisma.notice.findFirst({
        where: { type, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json(notice ?? null);
    }

    const notices = await authPrisma.notice.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(notices);
  } catch (err) {
    console.error("GET /api/admin/notices error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { type, title, content } = await req.json();
    if (!type || !content) {
      return NextResponse.json({ error: "type과 content는 필수입니다." }, { status: 400 });
    }

    const existing = await authPrisma.notice.findFirst({ where: { type } });
    let notice;
    if (existing) {
      notice = await authPrisma.notice.update({
        where: { id: existing.id },
        data: { title, content, isActive: true },
      });
    } else {
      notice = await authPrisma.notice.create({
        data: { type, title, content },
      });
    }
    return NextResponse.json(notice);
  } catch (err) {
    console.error("POST /api/admin/notices error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
