import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * 지사별 관할 TF + 각 TF의 메모 + 현재 캘린더 저장 건수를 묶어 반환.
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Branch 목록
  const branches = await prisma.branch.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      shortName: true,
      region: true,
      assignedTFs: true,
      isActive: true,
      displayOrder: true,
    },
  })

  // TfMeta 전체 로드 — Prisma model 사용
  const metas = await (prisma as unknown as {
    tfMeta: { findMany: () => Promise<Array<{ tfName: string; memo: string | null; updatedAt: Date }>> }
  }).tfMeta.findMany()
  const metaMap = new Map<string, { memo: string | null; updatedAt: Date }>()
  for (const m of metas) metaMap.set(m.tfName, { memo: m.memo, updatedAt: m.updatedAt })

  // 각 TF 사용 건수 — 한 번에 groupBy
  const usage = await prisma.specialClinicSchedule.groupBy({
    by: ['tfName'],
    _count: { _all: true },
  })
  const usageMap = new Map<string, number>()
  for (const u of usage) {
    if (u.tfName) usageMap.set(u.tfName, u._count._all)
  }

  // branch별 tf 조립
  const branchesWithTfs = branches.map(b => {
    const tfs = Array.isArray(b.assignedTFs) ? (b.assignedTFs as string[]) : []
    return {
      ...b,
      tfs: tfs.map(tfName => ({
        tfName,
        memo: metaMap.get(tfName)?.memo ?? null,
        memoUpdatedAt: metaMap.get(tfName)?.updatedAt ?? null,
        usageCount: usageMap.get(tfName) ?? 0,
      })),
    }
  })

  // 어떤 지사에도 속하지 않지만 DB에 존재하는 TF (정리 대상)
  const assignedTfs = new Set<string>()
  for (const b of branches) {
    const tfs = Array.isArray(b.assignedTFs) ? (b.assignedTFs as string[]) : []
    for (const t of tfs) assignedTfs.add(t)
  }
  const orphanTfs: { tfName: string; usageCount: number; memo: string | null }[] = []
  for (const [tfName, count] of usageMap) {
    if (!assignedTfs.has(tfName)) {
      orphanTfs.push({
        tfName,
        usageCount: count,
        memo: metaMap.get(tfName)?.memo ?? null,
      })
    }
  }
  orphanTfs.sort((a, b) => b.usageCount - a.usageCount)

  return NextResponse.json({
    branches: branchesWithTfs,
    orphanTfs,
    totalBranches: branches.length,
    totalTfs: assignedTfs.size,
  })
}
