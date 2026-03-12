import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { authPrisma } from "@/lib/auth-db";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requests = await authPrisma.signupRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const { name, email, department, jobTitle, message } = await req.json();
  if (!name || !email) {
    return NextResponse.json({ error: "이름과 이메일은 필수입니다." }, { status: 400 });
  }
  const existing = await authPrisma.signupRequest.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "이미 가입 요청이 접수된 이메일입니다." }, { status: 400 });
  }
  await authPrisma.signupRequest.create({
    data: { name, email, department, jobTitle, message },
  });
  return NextResponse.json({ message: "가입 요청이 접수되었습니다." }, { status: 201 });
}
