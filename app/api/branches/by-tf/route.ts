import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tfName = searchParams.get('tfName')
  if (!tfName) return NextResponse.json({ error: 'tfName required' }, { status: 400 })

  const branches = await (prisma as any).branch.findMany({ where: { isActive: true } })
  const matched = branches.find((b: any) => {
    const tfs = (b.assignedTFs as string[]) || []
    return tfs.includes(tfName)
  })

  return NextResponse.json({ branch: matched || null })
}
