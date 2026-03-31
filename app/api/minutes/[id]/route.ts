import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const minutes = await prisma.minutes.findUnique({ where: { id } })
  if (!minutes) return NextResponse.json({ error: '없음' }, { status: 404 })
  return NextResponse.json(minutes)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  await prisma.minutes.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
