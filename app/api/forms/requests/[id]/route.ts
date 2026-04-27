import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status, resolution } = body as { status?: string; resolution?: string }

  const data: Record<string, unknown> = {}
  if (status !== undefined) {
    data.status = status
    if (status === 'done' || status === 'rejected') {
      data.resolvedAt = new Date()
      data.resolvedBy = session.user.name ?? session.user.email ?? null
    }
  }
  if (resolution !== undefined) data.resolution = resolution

  const updated = await prisma.formRequest.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  await prisma.formRequest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
