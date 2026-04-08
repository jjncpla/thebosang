import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // HearingLossExam 신규 컬럼 추가
    await prisma.$executeRawUnsafe(`
      ALTER TABLE hearing_loss_exams
        ADD COLUMN IF NOT EXISTS "ptaAvgR"   DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "ptaAvgL"   DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "boneAvgR"  DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "boneAvgL"  DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "assrRight" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "assrLeft"  DOUBLE PRECISION
    `)

    // HearingLossDetail 신규 컬럼 추가
    await prisma.$executeRawUnsafe(`
      ALTER TABLE hearing_loss_details
        ADD COLUMN IF NOT EXISTS "reSpecialClinic" TEXT
    `)

    return NextResponse.json({ ok: true, message: 'HearingLossExam + HearingLossDetail 컬럼 추가 완료' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
