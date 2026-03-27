import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const chapterId = searchParams.get('chapterId')

  const where = chapterId ? { chapterId, isActive: true } : { isActive: true }
  const data = await prisma.regulationContent.findMany({
    where,
    orderBy: [{ chapterId: 'asc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { role?: string }
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { chapterId, sectionId, sectionNum, title, body: bodyText, sortOrder } = body

  const record = await prisma.regulationContent.upsert({
    where: { chapterId_sectionId: { chapterId, sectionId } },
    update: { sectionNum, title, body: bodyText, sortOrder: sortOrder ?? 0 },
    create: { chapterId, sectionId, sectionNum, title, body: bodyText, sortOrder: sortOrder ?? 0 },
  })
  return NextResponse.json(record)
}
