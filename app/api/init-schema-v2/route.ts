import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "SettlementRecord" ADD COLUMN IF NOT EXISTS "isInstallment" BOOLEAN NOT NULL DEFAULT false`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "SettlementRecord" ADD COLUMN IF NOT EXISTS "totalInstallmentAmount" INTEGER NOT NULL DEFAULT 0`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "SettlementRecord" ADD COLUMN IF NOT EXISTS "paidInstallmentAmount" INTEGER NOT NULL DEFAULT 0`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "regionName" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "SalesContract" DROP COLUMN IF EXISTS "project"`)
    return NextResponse.json({ ok: true, message: '스키마 업데이트 완료' })
  } catch(e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
