export const REGION_BRANCHES: Record<string, string[]> = {
  '부울경남권역': [
    '노무법인 더보상 울산지사',
    '노무법인 더보상 울산동부지사',
    '노무법인 더보상 부산경남지사',
    '노무법인 더보상 부산중부지사',
    '노무법인 더보상 경남창원지사',
    '노무법인 더보상 경북포항지사',
  ],
  '대구경북권역': [
    '노무법인 더보상 경북구미지사',
    '노무법인 더보상 대구지사',
  ],
  '전라권역': [
    '노무법인 더보상 전북익산지사',
    '노무법인 더보상 전남여수지사',
    '노무법인 더보상 전남순천지사',
  ],
  '충청권역': [
    '노무법인 더보상 대전지사',
  ],
}
// 수도권역: 위에 포함되지 않은 나머지 지사

export function getRegionBranches(regionName: string, allBranches?: string[]): string[] | 'ALL' {
  if (regionName === '수도권역' && allBranches) {
    const assignedBranches = Object.values(REGION_BRANCHES).flat()
    return allBranches.filter(b => !assignedBranches.includes(b))
  }
  return REGION_BRANCHES[regionName] || []
}

// DB에서 권역-지사 매핑 로드 (서버 컴포넌트/API용) — 실패 시 하드코딩 fallback
export async function loadRegionBranches(): Promise<Record<string, string[]>> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const branches = await (prisma as any).branch.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    })
    const map: Record<string, string[]> = {}
    branches.forEach((b: any) => {
      if (b.region) {
        if (!map[b.region]) map[b.region] = []
        map[b.region].push(b.name)
      }
    })
    return Object.keys(map).length > 0 ? map : REGION_BRANCHES
  } catch {
    return REGION_BRANCHES
  }
}

export function canAccessBranch(userRole: string, userBranch: string | null, userRegion: string | null, targetBranch: string): boolean {
  if (userRole === 'ADMIN') return true
  if (userRole === 'SENIOR_MANAGER' && userRegion) {
    if (userRegion === '수도권역') {
      const assignedBranches = Object.values(REGION_BRANCHES).flat()
      return !assignedBranches.includes(targetBranch)
    }
    return (REGION_BRANCHES[userRegion] || []).includes(targetBranch)
  }
  if (userRole === 'SITE_MANAGER' && userBranch) {
    return targetBranch === userBranch || targetBranch.includes(userBranch) || userBranch.includes(targetBranch)
  }
  return false
}
