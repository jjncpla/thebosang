// 근로복지공단 지사 부서 담당자 — 사용자 입력 정보 (이름·직책)
//
// GET ?branchKey=부산지역본부 → 해당 지사의 KwcBranchStaff 레코드 목록
// PATCH body { branchKey, departmentName, phone, name?, position? } → upsert
//
// 권한: 로그인된 사용자 누구나 (편집 결과는 모든 사용자에게 공유됨)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const branchKey = searchParams.get("branchKey");
  if (!branchKey) {
    return NextResponse.json({ error: "branchKey 필수" }, { status: 400 });
  }

  try {
    const records = await prisma.kwcBranchStaff.findMany({
      where: { branchKey },
      select: {
        departmentName: true,
        phone: true,
        name: true,
        position: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ records });
  } catch (e) {
    console.error("[kwc-branch-staff GET]", e);
    return NextResponse.json({ records: [] });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    branchKey?: string;
    departmentName?: string;
    phone?: string;
    name?: string | null;
    position?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
  }

  const { branchKey, departmentName, phone } = body;
  if (!branchKey || !departmentName || !phone) {
    return NextResponse.json(
      { error: "branchKey, departmentName, phone 필수" },
      { status: 400 }
    );
  }

  // 빈 문자열은 null 처리 (삭제)
  const name = body.name?.trim() || null;
  const position = body.position?.trim() || null;
  const userId = (session.user as { id?: string })?.id ?? null;

  try {
    const record = await prisma.kwcBranchStaff.upsert({
      where: {
        branchKey_departmentName_phone: { branchKey, departmentName, phone },
      },
      create: {
        branchKey,
        departmentName,
        phone,
        name,
        position,
        updatedBy: userId,
      },
      update: {
        name,
        position,
        updatedBy: userId,
      },
      select: {
        departmentName: true,
        phone: true,
        name: true,
        position: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ record });
  } catch (e) {
    console.error("[kwc-branch-staff PATCH]", e);
    return NextResponse.json(
      { error: "저장 실패. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
