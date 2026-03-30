'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

type MinuteCategory =
  | 'executive'       // 간부회의
  | 'regional_chief'  // 권역지사장 회의록
  | 'branch_metro'    // 수도권역
  | 'branch_gyeongnam' // 경남권역
  | 'branch_gyeongbuk' // 경북권역
  | 'branch_jeolla'   // 전라권역

type MinutesRecord = {
  id: string
  category: string
  title: string
  meetingDate: string
  content: string
  authorName: string
  createdAt: string
}

const CATEGORIES: { id: MinuteCategory; label: string; sub?: boolean }[] = [
  { id: 'executive',       label: '간부회의' },
  { id: 'regional_chief',  label: '권역지사장 회의록' },
  { id: 'branch_metro',    label: '수도권역',   sub: true },
  { id: 'branch_gyeongnam', label: '경남권역',  sub: true },
  { id: 'branch_gyeongbuk', label: '경북권역',  sub: true },
  { id: 'branch_jeolla',   label: '전라권역',   sub: true },
]

export default function MinutesTab() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const canWrite = ['ADMIN', 'MANAGER'].includes(role || '')

  const [active, setActive] = useState<MinuteCategory>('executive')
  const [minutes, setMinutes] = useState<MinutesRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 추가 폼
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formContent, setFormContent] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchMinutes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/minutes?category=${active}`)
      if (res.ok) {
        const data = await res.json()
        setMinutes(data.minutes || [])
      }
    } catch (e) {
      console.error('회의록 조회 실패:', e)
    }
    setLoading(false)
  }, [active])

  useEffect(() => { fetchMinutes() }, [fetchMinutes])

  async function handleAdd() {
    if (!formTitle.trim() || !formDate) return
    setSaving(true)
    try {
      const res = await fetch('/api/minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: active,
          title: formTitle.trim(),
          meetingDate: formDate,
          content: formContent.trim(),
        }),
      })
      if (res.ok) {
        setModalOpen(false)
        setFormTitle('')
        setFormDate('')
        setFormContent('')
        await fetchMinutes()
      } else {
        const d = await res.json()
        alert(d.error || '저장 실패')
      }
    } catch {
      alert('저장 중 오류 발생')
    }
    setSaving(false)
  }

  return (
    <div className="p-4 space-y-4">
      {/* 카테고리 네비 */}
      <div className="flex flex-wrap gap-1 items-center">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setActive(cat.id); setExpandedId(null) }}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors border ${
              active === cat.id
                ? 'bg-sky-500 text-white border-sky-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-sky-400 hover:text-sky-600'
            } ${cat.sub ? 'ml-2' : ''}`}
          >
            {cat.sub ? `└ ${cat.label}` : cat.label}
          </button>
        ))}
        {canWrite && (
          <button
            onClick={() => setModalOpen(true)}
            className="ml-auto px-3 py-1.5 text-sm rounded-md font-medium bg-sky-500 text-white border border-sky-500 hover:bg-sky-600 transition-colors"
          >
            + 회의록 추가
          </button>
        )}
      </div>

      {/* 권역별 지사장 회의록 안내 */}
      {['branch_metro', 'branch_gyeongnam', 'branch_gyeongbuk', 'branch_jeolla'].includes(active) && (
        <p className="text-xs text-gray-400">
          권역별 지사장 회의록 — {CATEGORIES.find(c => c.id === active)?.label}
        </p>
      )}

      {/* 회의록 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : minutes.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg py-12 flex flex-col items-center justify-center gap-2">
          <span className="text-3xl">📋</span>
          <p className="text-sm text-gray-500 font-medium">등록된 회의록이 없습니다</p>
          {canWrite && (
            <p className="text-xs text-gray-400">&quot;+ 회의록 추가&quot; 버튼으로 등록할 수 있습니다</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {minutes.map(m => (
            <div key={m.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(m.meetingDate).toLocaleDateString('ko-KR')}
                  </span>
                  <span className="text-sm font-medium text-gray-800">{m.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{m.authorName}</span>
                  <span className="text-gray-400 text-xs">{expandedId === m.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {expandedId === m.id && m.content && (
                <div className="px-4 py-4 bg-white border-t border-gray-100 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {m.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 회의록 추가 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">회의록 추가 — {CATEGORIES.find(c => c.id === active)?.label}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">회의 제목 *</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-sky-400"
                  placeholder="회의 제목 입력"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">회의 일자 *</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-sky-400"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">회의 내용</label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-48 resize-y focus:outline-none focus:border-sky-400"
                  placeholder="회의 내용을 입력하세요"
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">취소</button>
              <button
                onClick={handleAdd}
                disabled={saving || !formTitle.trim() || !formDate}
                className="px-4 py-2 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
