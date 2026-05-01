import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const WRITE_ROLES = ['ADMIN', '조직관리자']

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orders = await prisma.workOrder.findMany({
    where: { isActive: true },
    include: { author: { select: { name: true } } },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !WRITE_ROLES.includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, content, dueDate, priority } = await req.json()

  const order = await prisma.workOrder.create({
    data: {
      title,
      content,
      authorId: session.user.id,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority ?? 'NORMAL',
    },
  })

  return NextResponse.json(order)
}
