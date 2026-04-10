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
