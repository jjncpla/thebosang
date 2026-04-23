import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * 지사별 관할 TF 맵 (읽기 전용, 인증 불필요).
 * 통합캘린더·TF 필터 드롭다운·사이드바 등에서 단일 진실의 원천으로 사용.
 *
 * 응답:
 *   {
 *     branches: [
 *       { name, shortName, region, tfs: ["...TF", ...] },
 *       ...
 *     ],
 *     tfToBranch: { "...TF": "지사명", ... },
 *     allTfs: ["...TF", ...],
 *   }
 */
export async function GET() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      name: true,
      shortName: true,
      region: true,
      assignedTFs: true,
    },
  })

  const branchEntries = branches.map(b => ({
    name: b.name,
    shortName: b.shortName ?? null,
    region: b.region ?? null,
    tfs: Array.isArray(b.assignedTFs) ? (b.assignedTFs as string[]) : [],
  }))

  const tfToBranch: Record<string, string> = {}
  const allTfs = new Set<string>()
  for (const b of branchEntries) {
    for (const tf of b.tfs) {
      tfToBranch[tf] = b.name
      allTfs.add(tf)
    }
  }

  return NextResponse.json(
    {
      branches: branchEntries,
      tfToBranch,
      allTfs: [...allTfs].sort(),
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
