import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const search = sp.get("search") ?? "";
  const tfName = sp.get("tfName") ?? "";

  // 페이지네이션 (paginate=true): { items, nextCursor, total? }
  const limitRaw = Number(sp.get("limit") ?? "0");
  const limit = limitRaw > 0 && limitRaw <= 1000 ? limitRaw : 0;
  const paginateMode = sp.get("paginate") === "true";
  const cursor = sp.get("cursor") ?? "";
  const includeCount = sp.get("count") === "true";

  try {
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { ssn: { contains: search } },
        { phone: { endsWith: search } },
      ];
    }
    if (tfName) where.cases = { some: { tfName } };

    const t0 = Date.now();
    const patients = await prisma.patient.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      ...(limit > 0 && { take: limit }),
      ...(limit > 0 && cursor && { skip: 1, cursor: { id: cursor } }),
      // 목록 표시 필드만 select (cases 배열 → 사건유형 요약만)
      select: {
        id: true,
        name: true,
        ssn: true,
        phone: true,
        address: true,
        createdAt: true,
        _count: { select: { cases: true } },
        cases: {
          select: { id: true, caseType: true },
          orderBy: { createdAt: "desc" },
          take: 8, // 목록에서 상병 칩 표시용 — 8개면 충분, 나머지는 "+N"으로
        },
      },
    });
    const queryMs = Date.now() - t0;

    if (paginateMode) {
      const nextCursor = limit > 0 && patients.length === limit ? patients[patients.length - 1].id : null;
      const total = includeCount
        ? await prisma.patient.count({ where: Object.keys(where).length > 0 ? where : undefined })
        : undefined;
      const headers = new Headers({ "Server-Timing": `db;dur=${queryMs}` });
      return NextResponse.json({ items: patients, nextCursor, ...(total !== undefined && { total }) }, { headers });
    }
    return NextResponse.json(patients, { headers: { "Server-Timing": `db;dur=${queryMs}` } });
  } catch (err) {
    console.error("[GET /api/patients]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ssn, phone, address, memo } = body;
    if (!name || !ssn) {
      return NextResponse.json({ error: "name, ssn 필수" }, { status: 400 });
    }
    const patient = await prisma.patient.create({
      data: { name, ssn, phone: phone ?? null, address: address ?? null, memo: memo ?? null },
    });
    return NextResponse.json(patient, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "이미 등록된 주민번호입니다" }, { status: 409 });
    }
    console.error("[POST /api/patients]", err);
    return NextResponse.json({ error: "생성 오류" }, { status: 500 });
  }
}
