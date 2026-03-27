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

  const data = await prisma.indoorWorkload.findMany({
    where: { year, month: { in: months } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ user: { name: 'asc' } }, { month: 'asc' }],
  })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { userId, year, month, docSentCount, docReceivedCount, caseRegisteredCount, tfManagedCount, adminTaskDone, memo } = body

  const record = await prisma.indoorWorkload.upsert({
    where: { userId_year_month: { userId, year, month } },
    update: {
      docSentCount: docSentCount ?? 0,
      docReceivedCount: docReceivedCount ?? 0,
      caseRegisteredCount: caseRegisteredCount ?? 0,
      tfManagedCount: tfManagedCount ?? 0,
      adminTaskDone: adminTaskDone ?? false,
      memo: memo ?? null,
    },
    create: {
      userId, year, month,
      docSentCount: docSentCount ?? 0,
      docReceivedCount: docReceivedCount ?? 0,
      caseRegisteredCount: caseRegisteredCount ?? 0,
      tfManagedCount: tfManagedCount ?? 0,
      adminTaskDone: adminTaskDone ?? false,
      memo: memo ?? null,
    },
  })

  return NextResponse.json(record)
}
