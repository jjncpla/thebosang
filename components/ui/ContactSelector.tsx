'use client'

import { useState, useEffect, useRef } from 'react'

interface Contact {
  id: string
  firmType: string
  branch: string
  name: string
  title: string
  mobile: string
  officePhone: string
  email: string
}

interface ContactSelectorProps {
  value: string
  phoneValue?: string
  onChange: (name: string, mobile: string) => void
  placeholder?: string
  firmType?: 'TBOSANG' | 'ISAN'
  branch?: string
  label?: string
  required?: boolean
}

export default function ContactSelector({
  value, phoneValue, onChange, placeholder = '이름 검색',
  firmType, branch, label, required
}: ContactSelectorProps) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState<Contact[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query || query.length < 1) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams({ search: query })
      if (firmType) params.set('firmType', firmType)
      if (branch) params.set('branch', branch)
      const res = await fetch(`/api/contacts?${params}`)
      const data = await res.json()
      setResults(data.contacts || [])
      setLoading(false)
      setOpen(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, firmType, branch])

  const select = (c: Contact) => {
    onChange(c.name, c.mobile)
    setQuery(c.name)
    setOpen(false)
  }

  const inputStyle = {
    width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1',
    borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
      )}
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); if (!e.target.value) onChange('', '') }}
        onFocus={() => query && results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 240, overflowY: 'auto',
        }}>
          {results.map(c => (
            <div key={c.id}
              onClick={() => select(c)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                borderBottom: '1px solid #f1f5f9',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
            >
              <span>
                <strong>{c.name}</strong>
                <span style={{ marginLeft: 6, color: '#94a3b8', fontSize: 11 }}>{c.title}</span>
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{c.branch}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
