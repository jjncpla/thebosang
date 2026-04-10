import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ObjectionCase" ADD COLUMN IF NOT EXISTS "examClaimDeadline" TIMESTAMP(3)`
    );
    return NextResponse.json({ ok: true, message: "Phase 3-B schema migration complete: examClaimDeadline 추가" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
