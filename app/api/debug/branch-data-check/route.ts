import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const [
    salesTotal,
    settlementTotal,
    staffRosterTotal,
    salesByBranch,
    settlementByBranch,
    staffByBranch,
  ] = await Promise.all([
    prisma.salesContract.count(),
    prisma.settlementRecord.count(),
    prisma.staffRoster.count(),
    prisma.salesContract.groupBy({ by: ['branchName'], _count: true }),
    prisma.settlementRecord.groupBy({ by: ['branchName'], _count: true }),
    prisma.staffRoster.groupBy({ by: ['branchName'], _count: true }),
  ])

  return NextResponse.json({
    총계: { salesContract: salesTotal, settlementRecord: settlementTotal, staffRoster: staffRosterTotal },
    지사별_약정건수: salesByBranch,
    지사별_정산내역: settlementByBranch,
    지사별_직원명단: staffByBranch,
  })
}
