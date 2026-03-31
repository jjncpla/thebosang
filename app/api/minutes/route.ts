import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || ''
  const where = category ? { category } : {}
  const minutes = await prisma.minutes.findMany({
    where,
    orderBy: { meetingDate: 'desc' },
    select: {
      id: true, category: true, title: true, meetingDate: true,
      content: true, authorName: true,
      attachmentName: true, attachmentType: true, attachmentSize: true,
      createdAt: true, updatedAt: true,
    },
  })
  return NextResponse.json({ minutes })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (!['ADMIN', 'MANAGER'].includes(role || '')) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const body = await request.json()
  const minutes = await prisma.minutes.create({
    data: {
      category: body.category,
      title: body.title,
      meetingDate: new Date(body.meetingDate + 'T12:00:00.000Z'),
      content: body.content || '',
      authorName: (session.user as { name?: string }).name || '',
      attachmentData: body.attachmentData || null,
      attachmentName: body.attachmentName || null,
      attachmentType: body.attachmentType || null,
      attachmentSize: body.attachmentSize || null,
    }
  })
  return NextResponse.json(minutes)
}
