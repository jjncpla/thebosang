// 주민번호 배열을 받아 이미 Patient에 등록된 rrn 목록 반환
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "조직관리자"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { rrns?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 파싱 실패" }, { status: 400 });
  }

  const rrns = (body.rrns || []).filter((s) => typeof s === "string" && s.length > 0);
  if (rrns.length === 0) {
    return NextResponse.json({ duplicates: [] });
  }

  const found = await prisma.patient.findMany({
    where: { ssn: { in: rrns } },
    select: { ssn: true },
  });

  return NextResponse.json({ duplicates: found.map((p) => p.ssn) });
}
