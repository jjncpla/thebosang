import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const branchName = searchParams.get('branchName') || ''
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined

  const where: Record<string, unknown> = { year }
  if (branchName) where.branchName = branchName
  if (month) where.month = month

  const activities = await prisma.weeklyActivity.findMany({
    where,
    orderBy: [{ month: 'asc' }, { weekNumber: 'asc' }, { staffName: 'asc' }],
  })
  return NextResponse.json({ activities })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await request.json()
  const activity = await prisma.weeklyActivity.upsert({
    where: {
      branchName_staffName_year_month_weekNumber: {
        branchName: body.branchName,
        staffName: body.staffName,
        year: body.year,
        month: body.month,
        weekNumber: body.weekNumber,
      }
    },
    update: {
      weekLabel: body.weekLabel,
      initialVisit: body.initialVisit ?? 0,
      specialExam: body.specialExam ?? 0,
      docSupplementation: body.docSupplementation ?? 0,
      submission: body.submission ?? 0,
      sales: body.sales ?? 0,
    },
    create: body,
  })
  return NextResponse.json(activity)
}
