import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/** SpecialClinicSchedule에 isPickup 컬럼 추가 (멱등) */
export async function GET() {
  try {
    await prisma.$executeRaw`
      ALTER TABLE "SpecialClinicSchedule"
      ADD COLUMN IF NOT EXISTS "isPickup" BOOLEAN DEFAULT false
    `
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
}
