import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { branchName, year } = await req.json()
  const where: Record<string, unknown> = {}
  if (branchName) where.branchName = branchName
  if (year) where.year = year
  const result = await prisma.salesContract.deleteMany({ where })
  return NextResponse.json({ ok: true, deleted: result.count })
}
