import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string }).role
  const status = req.nextUrl.searchParams.get('status')

  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.status = status

  // ADMIN은 전체 조회, 그 외에는 본인 요청만
  if (role !== 'ADMIN') {
    where.requestedByEmail = session.user.email
  }

  const items = await prisma.formRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, description, formType } = body as {
    title?: string
    description?: string
    formType?: string | null
  }

  if (!title || !title.trim()) {
    return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
  }

  const user = session.user as { name?: string | null; email?: string | null; branch?: string | null }

  const created = await prisma.formRequest.create({
    data: {
      title: title.trim(),
      description: (description ?? '').trim(),
      formType: formType ?? null,
      requestedBy: user.name ?? user.email ?? '익명',
      requestedByEmail: user.email ?? null,
      branch: user.branch ?? null,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
