'use client'

import { useState, useEffect } from 'react'

interface BranchInfo {
  branch: string
  firmType: string
  officePhone: string
}

interface BranchSelectorProps {
  value: string
  officePhoneValue?: string
  onChange: (branch: string, officePhone: string) => void
  firmType?: 'TBOSANG' | 'ISAN'
  label?: string
  required?: boolean
}

export default function BranchSelector({
  value, officePhoneValue, onChange, firmType, label, required
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([])

  useEffect(() => {
    const params = new URLSearchParams({ type: 'branches' })
    if (firmType) params.set('firmType', firmType)
    fetch(`/api/contacts?${params}`)
      .then(r => r.json())
      .then(d => setBranches(d.branches || []))
  }, [firmType])

  const handleChange = (branchName: string) => {
    const found = branches.find(b => b.branch === branchName)
    onChange(branchName, found?.officePhone || '')
  }

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
        {branches.map(b => (
          <option key={b.branch} value={b.branch}>{b.branch}</option>
        ))}
      </select>
    </div>
  )
}
