import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const quarter = parseInt(searchParams.get('quarter') || '1')

  const startMonth = (quarter - 1) * 3 + 1
  const months = [startMonth, startMonth + 1, startMonth + 2]

  const data = await prisma.branchFinancial.findMany({
    where: { year, month: { in: months } },
    orderBy: [{ month: 'asc' }],
  })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { year, month, branchName, revenue, cost, memo } = body

  const record = await prisma.branchFinancial.upsert({
    where: { year_month_branchName: { year, month, branchName: branchName ?? null } },
    update: { revenue: revenue ?? 0, cost: cost ?? 0, memo: memo ?? null },
    create: { year, month, branchName: branchName ?? null, revenue: revenue ?? 0, cost: cost ?? 0, memo: memo ?? null },
  })

  return NextResponse.json(record)
}
