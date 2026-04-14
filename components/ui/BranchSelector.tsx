'use client'

import { useState, useEffect } from 'react'

interface BranchInfo {
  branch: string
  firmType: string
  officePhone: string
  region?: string
}

interface BranchSelectorProps {
  value: string
  officePhoneValue?: string
  onChange: (branch: string, officePhone: string) => void
  firmType?: 'TBOSANG' | 'ISAN'
  label?: string
  required?: boolean
}

function groupByRegion(branches: BranchInfo[]) {
  const groups: Record<string, BranchInfo[]> = {}
  const noRegion: BranchInfo[] = []
  for (const b of branches) {
    if (b.region) {
      if (!groups[b.region]) groups[b.region] = []
      groups[b.region].push(b)
    } else {
      noRegion.push(b)
    }
  }
  return { groups, noRegion }
}

export default function BranchSelector({
  value, officePhoneValue, onChange, firmType, label, required
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([])

  useEffect(() => {
    // Branch DB 우선, 실패 시 Contact 기반 fallback
    const params = new URLSearchParams()
    if (firmType) params.set('firmType', firmType)
    fetch(`/api/branches?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.branches?.length > 0) {
          setBranches(d.branches.map((b: any) => ({
            branch: b.name,
            firmType: b.firmType,
            officePhone: b.phone || '',
            region: b.region || '',
          })))
        } else {
          return fetch(`/api/contacts?type=branches${firmType ? '&firmType=' + firmType : ''}`)
            .then(r => r.json())
            .then(d => setBranches(d.branches || []))
        }
      })
      .catch(() => {
        fetch(`/api/contacts?type=branches${firmType ? '&firmType=' + firmType : ''}`)
          .then(r => r.json())
          .then(d => setBranches(d.branches || []))
      })
  }, [firmType])

  const handleChange = (branchName: string) => {
    const found = branches.find(b => b.branch === branchName)
    onChange(branchName, found?.officePhone || '')
  }

  const { groups, noRegion } = groupByRegion(branches)
  const hasRegions = Object.keys(groups).length > 0

  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
      )}
      <select
        value={value || ''}
        onChange={e => handleChange(e.target.value)}
        style={{
          width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1',
          borderRadius: 6, fontSize: 13, outline: 'none',
          color: value ? '#1e293b' : '#94a3b8',
        }}
      >
        <option value="">지사 선택</option>
        {hasRegions ? (
          <>
            {Object.entries(groups).map(([region, list]) => (
              <optgroup key={region} label={region}>
                {list.map(b => (
                  <option key={b.branch} value={b.branch}>{b.branch}</option>
                ))}
              </optgroup>
            ))}
            {noRegion.map(b => (
              <option key={b.branch} value={b.branch}>{b.branch}</option>
            ))}
          </>
        ) : (
          branches.map(b => (
            <option key={b.branch} value={b.branch}>{b.branch}</option>
          ))
        )}
      </select>
    </div>
  )
}
