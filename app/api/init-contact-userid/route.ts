import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "userId" TEXT;
    `)
    return NextResponse.json({ ok: true, message: 'Contact.userId 컬럼 추가 완료' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
