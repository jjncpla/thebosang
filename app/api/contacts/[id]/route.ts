import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()
  const { hireDate, leaveDate, ...rest } = body
  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...rest,
      hireDate: hireDate ? new Date(hireDate + 'T12:00:00.000Z') : null,
      leaveDate: leaveDate ? new Date(leaveDate + 'T12:00:00.000Z') : null,
    },
  })
  return NextResponse.json(contact)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  await prisma.contact.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
