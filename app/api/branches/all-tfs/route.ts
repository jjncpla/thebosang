import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const branches = await (prisma as any).branch.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: { name: true, shortName: true, region: true, assignedTFs: true },
  })

  const tfByBranch: Record<string, string[]> = {}
  const regionBranches: Record<string, string[]> = {}

  branches.forEach((b: any) => {
    tfByBranch[b.name] = (b.assignedTFs as string[]) || []
    if (b.region) {
      if (!regionBranches[b.region]) regionBranches[b.region] = []
      regionBranches[b.region].push(b.name)
    }
  })

  return NextResponse.json({ tfByBranch, regionBranches, branches })
}
