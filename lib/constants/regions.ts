export const REGION_BRANCHES: Record<string, string[]> = {
  '전라권역': ['전남순천지사', '전남여수지사', '전북익산지사', '순천지사', '여수지사', '익산지사',
               '노무법인 더보상 전남순천지사', '노무법인 더보상 전남여수지사', '노무법인 더보상 전북익산지사'],
  '대구경북권역': ['대구지사', '구미지사', '포항지사', '대구달서지사', '대구수성지사',
                   '노무법인 더보상 대구지사', '노무법인 더보상 경북구미지사', '노무법인 더보상 경북포항지사'],
  '부울경남권역': ['부산경남지사', '부산중부지사', '울산지사', '울산동부지사', '경남창원지사',
                   '부산북부지사', '부산서부지사', '양산지사', '김해지사', '창원지사',
                   '노무법인 더보상 부산경남지사', '노무법인 더보상 부산중부지사',
                   '노무법인 더보상 울산지사', '노무법인 더보상 울산동부지사', '노무법인 더보상 경남창원지사'],
}
// 수도권역: 위에 포함되지 않은 나머지 지사

export function getRegionBranches(regionName: string, allBranches?: string[]): string[] | 'ALL' {
  if (regionName === '수도권역' && allBranches) {
    const assignedBranches = Object.values(REGION_BRANCHES).flat()
    return allBranches.filter(b => !assignedBranches.includes(b))
  }
  return REGION_BRANCHES[regionName] || []
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
