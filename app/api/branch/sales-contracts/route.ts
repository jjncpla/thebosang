import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const quarter = searchParams.get('quarter')
  const month = searchParams.get('month')
  const branchName = searchParams.get('branchName')

  let months: number[]
  if (month) {
    months = [parseInt(month)]
  } else if (quarter) {
    const q = parseInt(quarter)
    months = [(q-1)*3+1, (q-1)*3+2, (q-1)*3+3]
  } else {
    months = [1,2,3,4,5,6,7,8,9,10,11,12]
  }

  const data = await prisma.salesContract.findMany({
    where: {
      year,
      month: { in: months },
      ...(branchName ? { branchName } : {}),
    },
    orderBy: [{ staffName: 'asc' }, { month: 'asc' }],
  })

  // activeStaff 조회 (includeStaff=true 시)
  if (searchParams.get('includeStaff') === 'true' && branchName) {
    const refMonth = month ? parseInt(month) : (quarter ? parseInt(quarter) * 3 : new Date().getMonth() + 1)
    const targetDate = new Date(year, refMonth - 1, 1)
    const targetDateEnd = new Date(year, refMonth, 0)
    const activeStaff = await prisma.contact.findMany({
      where: {
        jobGrade: '외근직',
        branch: branchName,
        OR: [
          { hireDate: null },
          { hireDate: { lte: targetDateEnd } },
        ],
        AND: [{
          OR: [
            { leaveDate: null },
            { leaveDate: { gte: targetDate } },
          ]
        }]
      },
      select: { name: true, branch: true, hireDate: true, leaveDate: true },
      orderBy: { displayOrder: 'asc' },
    })
    return NextResponse.json({ contracts: data, activeStaff })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { branchName, staffName, year, month, project: _project, ...counts } = body

  const record = await prisma.salesContract.upsert({
    where: { staffName_year_month: { staffName, year, month } },
    update: { branchName, ...counts },
    create: { branchName, staffName, year, month, ...counts },
  })
  return NextResponse.json(record)
}
