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

  const existing = await prisma.outdoorPerformance.findMany({
    where: { year, month: { in: months } },
    select: { userId: true, user: { select: { id: true, name: true } } },
    distinct: ['userId'],
  })

  const users = [...new Map(existing.map(r => [r.userId, r.user])).values()]
  return NextResponse.json(users)
}
