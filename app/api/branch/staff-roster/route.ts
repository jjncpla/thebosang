import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// jobGrade → staffType 매핑
function mapStaffType(jobGrade: string | null): string {
  if (jobGrade === '노무사') return 'ATTORNEY'
  if (jobGrade === '내근직') return 'INTERNAL'
  return 'EXTERNAL'
}

// GET: 특정 year/month에 재직 중인 직원 목록
// StaffRoster + 인사카드(Contact) 통합 반환 — 인사카드 등록만으로도 집계에 포함
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchName = searchParams.get('branchName') || ''
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || '1')

  const yearMonth = year * 100 + month

  // ── 1. StaffRoster 조회 (기존)
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

  // ── 2. 인사카드(Contact)에서 해당 기간 재직 중인 직원 조회
  const targetDate    = new Date(year, month - 1, 1)      // 해당 월 1일
  const targetDateEnd = new Date(year, month, 0)           // 해당 월 말일

  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { branch: branchName },
        { branch: `노무법인 더보상 ${branchName}` },
      ],
      NOT: { branch: { contains: '이산' } },
      AND: [
        { OR: [{ hireDate: null }, { hireDate: { lte: targetDateEnd } }] },
        { OR: [{ leaveDate: null }, { leaveDate: { gte: targetDate } }] },
      ],
    },
    select: { name: true, jobGrade: true, hireDate: true, leaveDate: true },
    orderBy: { displayOrder: 'asc' },
  })

  // ── 3. StaffRoster에 없는 인사카드 직원 병합
  const rosterNames = new Set(active.map(r => r.staffName))
  const contactItems = contacts
    .filter(c => c.name && !rosterNames.has(c.name))
    .map(c => ({
      id: `contact_${c.name}`,
      staffName: c.name,
      staffType: mapStaffType(c.jobGrade),
      startYear: c.hireDate ? new Date(c.hireDate).getUTCFullYear() : year,
      startMonth: c.hireDate ? new Date(c.hireDate).getUTCMonth() + 1 : 1,
      endYear: c.leaveDate ? new Date(c.leaveDate).getUTCFullYear() : null,
      endMonth: c.leaveDate ? new Date(c.leaveDate).getUTCMonth() + 1 : null,
    }))

  // ── 4. 중복 제거 후 반환 (StaffRoster 우선)
  const seen = new Set<string>()
  const unique = [...active, ...contactItems].filter(r => {
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
