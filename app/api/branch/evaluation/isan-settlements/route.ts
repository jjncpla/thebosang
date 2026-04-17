import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// 외근직 평가용 이산TF 정산 집계
// - 지사 소속 직원들이 정산한 '이산 TF' 사건을 전체 지사에서 수집
//   (다른 지사에서 담당중인 이산 TF를 이 지사 인원이 정산한 경우 포함)
// - staffNames: 평가 대상 직원명 배열 (쉼표 구분)
// - months: 대상 월 배열 (쉼표 구분)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const staffNamesParam = searchParams.get('staffNames') || ''
  const monthsParam = searchParams.get('months') || ''
  const staffNames = staffNamesParam.split(',').map(s => s.trim()).filter(Boolean)
  const months = monthsParam.split(',').map(s => parseInt(s)).filter(n => n >= 1 && n <= 12)
  if (staffNames.length === 0) return NextResponse.json({})

  const records = await prisma.settlementRecord.findMany({
    where: {
      year,
      ...(months.length > 0 ? { month: { in: months } } : {}),
      settlementStaffName: { in: staffNames },
      NOT: [
        { tfName: { startsWith: '더보상' } },
      ],
      tfName: { not: null },
    },
    select: { settlementStaffName: true, grossAmount: true, branchName: true },
  })

  const agg: Record<string, { count: number; gross: number }> = {}
  for (const r of records) {
    const name = r.settlementStaffName || '(미지정)'
    if (!agg[name]) agg[name] = { count: 0, gross: 0 }
    agg[name].count += 1
    agg[name].gross += r.grossAmount
  }
  return NextResponse.json(agg)
}
