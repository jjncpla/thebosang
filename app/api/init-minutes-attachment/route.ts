import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Minutes" ADD COLUMN IF NOT EXISTS "attachmentData" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Minutes" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Minutes" ADD COLUMN IF NOT EXISTS "attachmentType" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Minutes" ADD COLUMN IF NOT EXISTS "attachmentSize" INTEGER`)
    return NextResponse.json({ ok: true, message: '회의록 첨부파일 컬럼 추가 완료' })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
