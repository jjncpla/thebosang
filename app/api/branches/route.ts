import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const firmType = searchParams.get('firmType')
  const region = searchParams.get('region')
  const includeStaff = searchParams.get('includeStaff') === 'true'

  const where: any = { isActive: true }
  if (firmType) where.firmType = firmType
  if (region) where.region = region

  const branches = await (prisma as any).branch.findMany({
    where,
    orderBy: { displayOrder: 'asc' },
  })

  if (includeStaff) {
    const enriched = await Promise.all(
      branches.map(async (b: any) => {
        const staffCount = await (prisma as any).contact.count({ where: { branch: b.name } })
        return { ...b, staffCount }
      })
    )
    return NextResponse.json({ branches: enriched })
  }

  return NextResponse.json({ branches })
}

export async function POST(request: Request) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const body = await request.json()
  const branch = await (prisma as any).branch.create({ data: body })
  return NextResponse.json(branch)
}
