import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: 해당 분기 지사 인센티브 사용 내역 조회
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchName = searchParams.get('branchName') || ''
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const quarter = parseInt(searchParams.get('quarter') || '1')

  const usages = await prisma.branchIncentiveUsage.findMany({
    where: { branchName, year, quarter },
    orderBy: { usageDate: 'asc' },
  })

  return NextResponse.json(usages)
}

// POST: 지사 인센티브 사용 내역 추가
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { branchName, year, quarter, usageDate, description, amount } = body

  if (!branchName || !year || !quarter || !usageDate || !description || !amount) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const usage = await prisma.branchIncentiveUsage.create({
    data: {
      branchName,
      year,
      quarter,
      usageDate: new Date(usageDate),
      description,
      amount: parseInt(amount),
    },
  })

  return NextResponse.json(usage)
}

// DELETE: 지사 인센티브 사용 내역 삭제
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  await prisma.branchIncentiveUsage.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
