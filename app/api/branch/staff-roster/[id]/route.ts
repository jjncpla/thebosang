import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// PUT: 퇴사 처리 (endYear/Month 설정)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { endYear, endMonth } = body

  const record = await prisma.staffRoster.update({
    where: { id },
    data: { endYear, endMonth },
  })
  return NextResponse.json(record)
}
