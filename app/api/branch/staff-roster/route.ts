import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: 특정 year/month에 재직 중인 직원 목록
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchName = searchParams.get('branchName') || ''
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || '1')

  const yearMonth = year * 100 + month

  const all = await prisma.staffRoster.findMany({
    where: { branchName },
    select: { id: true, staffName: true, staffType: true, startYear: true, startMonth: true, endYear: true, endMonth: true },
    orderBy: [{ startYear: 'asc' }, { startMonth: 'asc' }, { staffName: 'asc' }],
  })

  const active = all.filter(r => {
    const start = r.startYear * 100 + r.startMonth
    if (start > yearMonth) return false
    if (r.endYear !== null && r.endMonth !== null) {
      const end = r.endYear * 100 + r.endMonth
      if (end <= yearMonth) return false
    }
    return true
  })

  // 중복 제거 (같은 staffName 여러 번 등록된 경우)
  const seen = new Set<string>()
  const unique = active.filter(r => {
    if (seen.has(r.staffName)) return false
    seen.add(r.staffName)
    return true
  })

  return NextResponse.json(unique)
}

// POST: 직원 추가 (입사)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { branchName, staffName, startYear, startMonth } = body

  const record = await prisma.staffRoster.upsert({
    where: { branchName_staffName_startYear_startMonth: { branchName, staffName, startYear, startMonth } },
    update: {},
    create: { branchName, staffName, startYear, startMonth },
  })
  return NextResponse.json(record)
}
