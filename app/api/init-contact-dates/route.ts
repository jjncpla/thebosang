import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMP(3)`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leaveDate" TIMESTAMP(3)`)
    return NextResponse.json({ ok: true, message: '입사일/퇴사일 컬럼 추가 완료' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
