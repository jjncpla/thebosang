import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: 분기별 지사 인센티브 요약 (월말보고 합계 시트 재현)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchName = searchParams.get('branchName') || ''
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const quarter = parseInt(searchParams.get('quarter') || '1')

  const summary = await prisma.branchIncentiveSummary.findUnique({
    where: { branchName_year_quarter: { branchName, year, quarter } },
    include: { staffSummaries: { orderBy: { staffName: 'asc' } } },
  })
  return NextResponse.json(summary)
}

// PUT: 합계 행·지사 단위 값 수동 수정 (ADMIN 전용)
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const { branchName, year, quarter, carryOverAmount, staffSummaries } = body
  if (!branchName || !year || !quarter) {
    return NextResponse.json({ error: 'branchName, year, quarter 필수' }, { status: 400 })
  }

  const existing = await prisma.branchIncentiveSummary.findUnique({
    where: { branchName_year_quarter: { branchName, year, quarter } },
  })
  const summary = existing
    ? await prisma.branchIncentiveSummary.update({
        where: { id: existing.id },
        data: { carryOverAmount: carryOverAmount ?? existing.carryOverAmount },
      })
    : await prisma.branchIncentiveSummary.create({
        data: { branchName, year, quarter, carryOverAmount: carryOverAmount ?? 0 },
      })

  if (Array.isArray(staffSummaries)) {
    for (const s of staffSummaries) {
      if (!s.staffName) continue
      await prisma.branchIncentiveStaffSummary.upsert({
        where: { summaryId_staffName: { summaryId: summary.id, staffName: s.staffName } },
        create: {
          summaryId: summary.id,
          staffName: s.staffName,
          personalIncentive: s.personalIncentive ?? 0,
          branchIncentive:   s.branchIncentive   ?? 0,
          carAllowance:      s.carAllowance      ?? 0,
          totalIncentive:    s.totalIncentive    ?? 0,
          roundedIncentive:  s.roundedIncentive  ?? 0,
          quarterlyGrade:    s.quarterlyGrade    ?? null,
          semiAnnualGrade:   s.semiAnnualGrade   ?? null,
          gradeReason:       s.gradeReason       ?? null,
          memo:              s.memo              ?? null,
        },
        update: {
          personalIncentive: s.personalIncentive ?? 0,
          branchIncentive:   s.branchIncentive   ?? 0,
          carAllowance:      s.carAllowance      ?? 0,
          totalIncentive:    s.totalIncentive    ?? 0,
          roundedIncentive:  s.roundedIncentive  ?? 0,
          quarterlyGrade:    s.quarterlyGrade    ?? null,
          semiAnnualGrade:   s.semiAnnualGrade   ?? null,
          gradeReason:       s.gradeReason       ?? null,
          memo:              s.memo              ?? null,
        },
      })
    }
  }

  const refreshed = await prisma.branchIncentiveSummary.findUnique({
    where: { id: summary.id },
    include: { staffSummaries: { orderBy: { staffName: 'asc' } } },
  })
  return NextResponse.json(refreshed)
}
