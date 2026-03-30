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
      meetingDate: new Date(body.meetingDate),
      content: body.content || '',
      authorName: (session.user as { name?: string }).name || '',
    }
  })
  return NextResponse.json(minutes)
}
