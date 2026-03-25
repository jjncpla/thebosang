import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_ROLES = ['ADMIN', '조직관리자']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const docs = await prisma.policyDocument.findMany({
    where: {
      isLatest: true,
      ...(category ? { category } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, category, version, content } = body

  // 기존 최신 문서 isLatest=false 처리
  if (category) {
    await prisma.policyDocument.updateMany({
      where: { category, isLatest: true },
      data: { isLatest: false },
    })
  }

  const doc = await prisma.policyDocument.create({
    data: {
      title,
      category: category ?? 'OTHER',
      version,
      content,
      isLatest: true,
      createdBy: session.user.id,
    },
  })

  return NextResponse.json(doc)
}
