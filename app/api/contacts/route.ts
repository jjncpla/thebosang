import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authPrisma } from '@/lib/auth-db'
import { auth } from '@/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const firmType = searchParams.get('firmType')
  const search = searchParams.get('search') || ''
  const branch = searchParams.get('branch') || ''
  const type = searchParams.get('type')

  // 지사 목록만 요청
  if (type === 'branches') {
    const contacts = await prisma.contact.findMany({
      select: { branch: true, firmType: true, officePhone: true },
      where: firmType ? { firmType } : {},
      orderBy: { branch: 'asc' },
    })
    const branches = Array.from(
      new Map(contacts.map(c => [c.branch, c])).values()
    ).filter(c => c.branch)
    return NextResponse.json({ branches })
  }

  // namesOnly=true: 더보상 인원 이름 목록만 반환 (담당자 검색용)
  if (searchParams.get('namesOnly') === 'true') {
    const names = await prisma.contact.findMany({
      where: { firmType: firmType || 'TBOSANG', name: { not: null } },
      select: { name: true },
      orderBy: { displayOrder: 'asc' },
    })
    return NextResponse.json(names.map(c => c.name).filter(Boolean))
  }

  const jobGrade = searchParams.get('jobGrade') || ''

  const where: any = {}
  if (firmType) where.firmType = firmType
  if (branch) where.branch = branch
  if (jobGrade) where.jobGrade = jobGrade
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

  // userId가 있는 Contact에 대해 User 정보 병합
  const contactsArr = contacts as any[]
  const userIds = contactsArr.map((c: any) => c.userId).filter(Boolean) as string[]
  let userMap: Record<string, any> = {}
  if (userIds.length > 0) {
    const users = await authPrisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
    userMap = Object.fromEntries((users as any[]).map((u: any) => [u.id, u]))
  }
  const enrichedContacts = contactsArr.map((c: any) => ({
    ...c,
    user: c.userId ? (userMap[c.userId] || null) : null,
  }))

  return NextResponse.json({ contacts: enrichedContacts, offices })
}

export async function POST(request: Request) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const body = await request.json()
  const { hireDate, leaveDate, ...rest } = body
  const contact = await prisma.contact.create({
    data: {
      ...rest,
      hireDate: hireDate && hireDate !== '' ? new Date(hireDate.slice(0, 10) + 'T12:00:00.000Z') : null,
      leaveDate: leaveDate && leaveDate !== '' ? new Date(leaveDate.slice(0, 10) + 'T12:00:00.000Z') : null,
    },
  })
  return NextResponse.json(contact)
}
