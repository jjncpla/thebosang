import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const tfName = req.nextUrl.searchParams.get("tfName") ?? "";
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
    const patients = await prisma.patient.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { cases: true } },
        cases: {
          select: { id: true, caseType: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return NextResponse.json(patients);
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
