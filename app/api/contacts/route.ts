import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const firmType = searchParams.get('firmType')
  const search = searchParams.get('search') || ''
  const branch = searchParams.get('branch') || ''

  const where: any = {}
  if (firmType) where.firmType = firmType
  if (branch) where.branch = branch
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { title: { contains: search } },
      { branch: { contains: search } },
      { mobile: { contains: search } },
    ]
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: [{ firmType: 'asc' }, { displayOrder: 'asc' }],
  })
  const offices = firmType === 'ISAN' || !firmType
    ? await prisma.isanOffice.findMany({ orderBy: { name: 'asc' } })
    : []

  return NextResponse.json({ contacts, offices })
}

export async function POST(request: Request) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const body = await request.json()
  const contact = await prisma.contact.create({ data: body })
  return NextResponse.json(contact)
}
