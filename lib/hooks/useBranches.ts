'use client'

import { useState, useEffect, useMemo } from 'react'

export interface BranchData {
  name: string
  shortName: string | null
  region: string | null
  assignedTFs: string[]
}

interface UseBranchesResult {
  branches: BranchData[]
  branchNames: string[]
  shortBranchNames: string[]
  tfByBranch: Record<string, string[]>
  tfToBranch: Record<string, string>
  regionBranches: Record<string, string[]>
  allTFs: string[]
  loading: boolean
  error: string | null
}

type CachedData = { tfByBranch: Record<string, string[]>; regionBranches: Record<string, string[]>; branches: BranchData[] }
let cachedData: CachedData | null = null
let fetchPromise: Promise<CachedData | null> | null = null

function fetchBranches() {
  if (cachedData) return Promise.resolve(cachedData)
  if (fetchPromise) return fetchPromise
  fetchPromise = fetch('/api/branches/all-tfs')
    .then((res) => res.json())
    .then((data) => {
      const branches: BranchData[] = (data.branches || []).map((b: any) => ({
        name: b.name,
        shortName: b.shortName || null,
        region: b.region || null,
        assignedTFs: (b.assignedTFs as string[]) || [],
      }))
      cachedData = {
        tfByBranch: data.tfByBranch || {},
        regionBranches: data.regionBranches || {},
        branches,
      }
      return cachedData
    })
    .catch(() => {
      fetchPromise = null
      return null
    })
  return fetchPromise
}

export function useBranches(): UseBranchesResult {
  const [data, setData] = useState<CachedData | null>(cachedData)
  const [loading, setLoading] = useState(!cachedData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cachedData) { setData(cachedData); setLoading(false); return }
    fetchBranches().then((result) => {
      if (result) { setData(result); } else { setError('지사 정보를 불러올 수 없습니다.') }
      setLoading(false)
    })
  }, [])

  const branches = data?.branches || []
  const tfByBranch = data?.tfByBranch || {}
  const regionBranches = data?.regionBranches || {}

  const branchNames = useMemo(() => branches.map((b) => b.name), [branches])
  // "노무법인 더보상 울산지사" → "울산지사" (기존 하드코딩과 동일한 형태 유지)
  const shortBranchNames = useMemo(
    () => branches.map((b) => b.name.replace('노무법인 더보상 ', '').replace('노무법인 더보상', '본사')),
    [branches]
  )
  const allTFs = useMemo(() => Object.values(tfByBranch).flat(), [tfByBranch])
  const tfToBranch = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [branch, tfs] of Object.entries(tfByBranch)) {
      for (const tf of tfs) map[tf] = branch
    }
    return map
  }, [tfByBranch])

  return { branches, branchNames, shortBranchNames, tfByBranch, tfToBranch, regionBranches, allTFs, loading, error }
}
