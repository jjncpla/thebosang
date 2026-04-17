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
  const paymentDate = recordData.paymentDate ? new Date(recordData.paymentDate) : null

  // FILE1 재임포트 보호: (branchName + victimName + paymentDate + grossAmount)로 기존 행 탐지
  // 이미 있으면 salesStaff/settlementStaff/tfName/caseType 등 원본 필드는 덮지 않고 반환만
  // (FILE2 임포트가 이후에 reportAssignee·isBranchOwned·allocations만 갱신)
  const existing = paymentDate && recordData.grossAmount
    ? await prisma.settlementRecord.findFirst({
        where: {
          branchName: recordData.branchName,
          victimName: recordData.victimName,
          paymentDate,
          grossAmount: recordData.grossAmount,
        },
        include: { allocations: true },
      })
    : null

  if (existing) {
    return NextResponse.json(existing)
  }

  const record = await prisma.settlementRecord.create({
    data: {
      ...recordData,
      paymentDate,
      allocations: allocations?.length > 0
        ? { create: allocations }
        : undefined,
    },
    include: { allocations: true },
  })

  // 정산 담당자 지정 시 Todo 자동 생성
  if (recordData.settlementStaffId) {
    const existing = await prisma.todo.findFirst({
      where: {
        assignedTo: recordData.settlementStaffId,
        type: "WAGE_REQUEST",
        isDone: false,
        title: { contains: record.victimName ?? "" },
      },
    })
    if (!existing) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      await prisma.todo.create({
        data: {
          title: `[정산요청] ${record.victimName ?? ""} — ${record.branchName} ${record.year}년 ${record.month}월`,
          type: "WAGE_REQUEST",
          dueDate,
          patientName: record.victimName ?? null,
          assignedTo: recordData.settlementStaffId,
          isDone: false,
          memo: `TF: ${record.tfName ?? ""} / 총액: ${record.grossAmount?.toLocaleString() ?? ""}원`,
        },
      })
    }
  }

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
