import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SettlementRecord" ADD COLUMN IF NOT EXISTS "settlementStaffId" TEXT REFERENCES "User"(id)`
    );
    return NextResponse.json({ ok: true, message: "settlementStaffId 컬럼 추가 완료" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
