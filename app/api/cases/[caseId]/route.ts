import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

/* Prisma 싱글톤 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/* ─────────────────────────────────────
   GET /api/cases
   전체 케이스 조회
───────────────────────────────────── */
export async function GET(): Promise<NextResponse> {
  try {
    const cases = await prisma.case.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        persons: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json(cases, { status: 200 });
  } catch (err) {
    console.error("[GET /api/cases] DB error:", err);
    return NextResponse.json(
      { error: "케이스 조회 중 오류 발생" },
      { status: 500 }
    );
  }
}

/* ─────────────────────────────────────
   POST /api/cases
   케이스 생성
───────────────────────────────────── */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    const { title, persons } = body;

    // ── 유효성 검사 ──
    if (!title) {
      return NextResponse.json(
        { error: "title은 필수입니다" },
        { status: 400 }
      );
    }

    if (!persons || !Array.isArray(persons) || persons.length === 0) {
      return NextResponse.json(
        { error: "person 최소 1명 필요" },
        { status: 400 }
      );
    }

    // ── 생성 ──
    const newCase = await prisma.case.create({
      data: {
        title,
        status: "RECEIVED", // 기본값
        persons: {
          create: persons.map((p: any) => ({
            name: p.name,
            phone: p.phone ?? null,
          })),
        },
      },
      include: {
        persons: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json(newCase, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cases] DB error:", err);
    return NextResponse.json(
      { error: "케이스 생성 중 오류 발생" },
      { status: 500 }
    );
  }
}