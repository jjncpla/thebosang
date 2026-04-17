import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: 해당 기간·지사의 더보상 사건 정산 데이터 + 배분 내역 조회
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchName = searchParams.get('branchName') || ''
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const quarter = parseInt(searchParams.get('quarter') || '1')

  const startMonth = (quarter - 1) * 3 + 1
  const months = [startMonth, startMonth + 1, startMonth + 2]

  // 더보상 TF 사건 = tfName이 '더보상' 시작 OR isBranchOwned=true
  // (FILE2 임포트 후엔 isBranchOwned로 정확히 판단 가능. FILE1만 임포트된 상태에선 tfName 기반)
  const records = await prisma.settlementRecord.findMany({
    where: {
      branchName,
      year,
      month: { in: months },
      OR: [
        { tfName: { startsWith: '더보상' } },
        { isBranchOwned: true },
      ],
    },
    include: {
      allocations: true,
    },
    orderBy: [{ month: 'asc' }, { paymentDate: 'asc' }],
  })

  return NextResponse.json(records)
}
