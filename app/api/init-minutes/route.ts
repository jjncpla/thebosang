import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Minutes" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "meetingDate" TIMESTAMP(3) NOT NULL,
        "content" TEXT NOT NULL DEFAULT '',
        "authorName" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    const count = await prisma.minutes.count()
    return NextResponse.json({ ok: true, message: 'Minutes 테이블 생성 완료', count })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
