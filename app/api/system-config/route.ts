import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 설정값 조회
export async function GET(req: NextRequest) {
  try {
    const keysParam = req.nextUrl.searchParams.get("keys");
    const keys = keysParam ? keysParam.split(",") : [];

    const configs = keys.length > 0
      ? await prisma.systemConfig.findMany({ where: { key: { in: keys } } })
      : await prisma.systemConfig.findMany();

    return NextResponse.json({ configs });
  } catch (err) {
    console.error("[GET /api/system-config]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

// POST: 설정값 저장 (upsert)
export async function POST(req: NextRequest) {
  try {
    const { configs } = await req.json();
    if (!configs?.length) {
      return NextResponse.json({ error: "configs 배열이 필요합니다." }, { status: 400 });
    }

    const results = await prisma.$transaction(
      configs.map((c: { key: string; value: string }) =>
        prisma.systemConfig.upsert({
          where: { key: c.key },
          update: { value: c.value },
          create: { key: c.key, value: c.value },
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (err) {
    console.error("[POST /api/system-config]", err);
    return NextResponse.json({ error: "저장 오류" }, { status: 500 });
  }
}
