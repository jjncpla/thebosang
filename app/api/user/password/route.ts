import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { authPrisma } from "@/lib/auth-db";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password-policy";

/**
 * 로그인한 사용자 본인의 비밀번호 변경
 * - 현재 비밀번호 확인 필수
 * - 새 비밀번호는 정책(8자+, 영문+숫자) 충족 필요
 * - 현재 비밀번호와 동일한 비밀번호로 변경 불가
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return NextResponse.json({ error: "현재 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const policy = validatePassword(newPassword);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.error }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "새 비밀번호는 현재 비밀번호와 달라야 합니다." },
      { status: 400 },
    );
  }

  const user = await authPrisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json(
      { error: "현재 비밀번호가 일치하지 않습니다." },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(newPassword as string, 12);
  await authPrisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  });

  return NextResponse.json({ ok: true });
}
