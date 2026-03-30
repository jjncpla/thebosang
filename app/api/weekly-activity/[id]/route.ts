import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  await prisma.weeklyActivity.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
