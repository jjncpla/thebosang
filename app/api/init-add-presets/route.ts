import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/** User에 calendarPresets JSONB 컬럼 추가 (멱등) */
export async function GET() {
  try {
    await prisma.$executeRaw`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "calendarPresets" JSONB
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
