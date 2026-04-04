import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// PUT: 특정 SettlementRecord의 allocations 일괄 교체
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { allocations } = body // [{ staffName, ratio, isExternal }]

  // 기존 allocation 전체 삭제 후 재생성
  await prisma.settlementAllocation.deleteMany({
    where: { settlementRecordId: id },
  })

  if (allocations && allocations.length > 0) {
    await prisma.settlementAllocation.createMany({
      data: allocations.map((a: { staffName: string; ratio: number; isExternal?: boolean }) => ({
        settlementRecordId: id,
        staffName: a.staffName,
        ratio: parseInt(String(a.ratio)) || 0,
        isExternal: a.isExternal || false,
      })),
    })
  }

  // 업데이트된 전체 데이터 반환
  const updated = await prisma.settlementRecord.findUnique({
    where: { id },
    include: { allocations: true },
  })

  return NextResponse.json(updated)
}
