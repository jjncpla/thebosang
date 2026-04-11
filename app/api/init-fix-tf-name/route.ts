import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // 실제 DB에 있는 tfName 값 목록 조회
    const tfNames = await prisma.case.groupBy({
      by: ['tfName'],
      _count: { tfName: true },
      orderBy: { _count: { tfName: 'desc' } },
    })

    return NextResponse.json({ ok: true, tfNames })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
