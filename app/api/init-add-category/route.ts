import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    await prisma.$executeRaw`
      ALTER TABLE "SpecialClinicSchedule"
      ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '특진'
    `
    return NextResponse.json({ ok: true, message: "category 컬럼 추가 완료" })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg })
  }
}
