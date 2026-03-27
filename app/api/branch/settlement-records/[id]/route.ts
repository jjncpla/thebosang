import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { allocations, ...recordData } = body

  await prisma.settlementAllocation.deleteMany({ where: { settlementRecordId: id } })

  const record = await prisma.settlementRecord.update({
    where: { id },
    data: {
      ...recordData,
      paymentDate: recordData.paymentDate ? new Date(recordData.paymentDate) : null,
      allocations: allocations?.length > 0
        ? { create: allocations }
        : undefined,
    },
    include: { allocations: true },
  })
  return NextResponse.json(record)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.settlementRecord.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
