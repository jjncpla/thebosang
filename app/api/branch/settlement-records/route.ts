import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = searchParams.get('month')
  const branchName = searchParams.get('branchName')

  const data = await prisma.settlementRecord.findMany({
    where: {
      year,
      ...(month ? { month: parseInt(month) } : {}),
      ...(branchName ? { branchName } : {}),
    },
    include: { allocations: true },
    orderBy: [{ month: 'asc' }, { paymentDate: 'asc' }],
  })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { allocations, ...recordData } = body

  const record = await prisma.settlementRecord.create({
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

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const branchName = searchParams.get('branchName')
  const year = searchParams.get('year')

  if (!branchName || !year) {
    return NextResponse.json({ error: 'branchName, year 필수' }, { status: 400 })
  }

  const result = await prisma.settlementRecord.deleteMany({
    where: {
      branchName,
      year: parseInt(year),
    },
  })

  return NextResponse.json({ deleted: result.count })
}
