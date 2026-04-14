import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') return null
  return session
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const branch = await (prisma as any).branch.findUnique({ where: { id } })
  if (!branch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const staff = await (prisma as any).contact.findMany({
    where: { branch: branch.name },
    orderBy: [{ jobGrade: 'asc' }, { displayOrder: 'asc' }],
    select: { id: true, name: true, title: true, jobGrade: true, mobile: true, email: true, hireDate: true, leaveDate: true, userId: true },
  })

  return NextResponse.json({ branch, staff })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { id } = await params
  const body = await request.json()
  const branch = await (prisma as any).branch.update({ where: { id }, data: body })
  return NextResponse.json(branch)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { id } = await params
  await (prisma as any).branch.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
