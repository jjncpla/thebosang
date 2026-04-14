import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formKey = req.nextUrl.searchParams.get('type')
  if (!formKey) return NextResponse.json({ error: 'type 필요' }, { status: 400 })

  const config = await prisma.systemConfig.findUnique({
    where: { key: `form_coords_${formKey}` },
  })

  if (!config) return NextResponse.json({ fields: null })
  return NextResponse.json({ fields: JSON.parse(config.value) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { formKey, fields } = await req.json()
  if (!formKey || !fields) {
    return NextResponse.json({ error: 'formKey, fields 필요' }, { status: 400 })
  }

  await prisma.systemConfig.upsert({
    where: { key: `form_coords_${formKey}` },
    create: { key: `form_coords_${formKey}`, value: JSON.stringify(fields) },
    update: { value: JSON.stringify(fields) },
  })

  return NextResponse.json({ ok: true })
}
