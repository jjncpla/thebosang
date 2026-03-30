import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WeeklyActivity" (
        "id" TEXT NOT NULL,
        "branchName" TEXT NOT NULL,
        "staffName" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "month" INTEGER NOT NULL,
        "weekNumber" INTEGER NOT NULL,
        "weekLabel" TEXT NOT NULL,
        "initialVisit" INTEGER NOT NULL DEFAULT 0,
        "specialExam" INTEGER NOT NULL DEFAULT 0,
        "docSupplementation" INTEGER NOT NULL DEFAULT 0,
        "submission" INTEGER NOT NULL DEFAULT 0,
        "sales" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "WeeklyActivity_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyActivity_branchName_staffName_year_month_weekNumber_key"
        ON "WeeklyActivity"("branchName", "staffName", "year", "month", "weekNumber")
    `)
    return NextResponse.json({ ok: true, message: 'WeeklyActivity 테이블 생성 완료' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
