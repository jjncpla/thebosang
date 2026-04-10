import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const result = await prisma.case.updateMany({
      where: { tfName: '더보상울산지사TF' },
      data: { tfName: '더보상울산TF' },
    })
    return NextResponse.json({ ok: true, updated: result.count })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
