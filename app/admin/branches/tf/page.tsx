'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTFColor } from '@/lib/tf-colors'

interface TfItem {
  tfName: string
  memo: string | null
  memoUpdatedAt: string | null
  usageCount: number
}

interface BranchWithTfs {
  id: string
  name: string
  shortName: string | null
  region: string | null
  colorBase: string | null
  isActive: boolean
  displayOrder: number
  tfs: TfItem[]
}

interface Overview {
  branches: BranchWithTfs[]
  orphanTfs: { tfName: string; usageCount: number; memo: string | null }[]
  totalBranches: number
  totalTfs: number
}

export default function TfManagementPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedTfs, setExpandedTfs] = useState<Set<string>>(new Set())
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())
  const [editingTf, setEditingTf] = useState<string | null>(null)
  const [memoDraft, setMemoDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [editingBranch, setEditingBranch] = useState<string | null>(null)
  const [tfListDraft, setTfListDraft] = useState<string[]>([])
  const [newTfInput, setNewTfInput] = useState('')
  const [editingColorBranch, setEditingColorBranch] = useState<string | null>(null)
  const [colorDraft, setColorDraft] = useState('#006838')

  // DB 색상 맵 (Branch.colorBase)
  const [branchColorMap, setBranchColorMap] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [res, colorRes] = await Promise.all([
      fetch('/api/admin/tf-overview'),
      fetch('/api/tf-color-map'),
    ])
    if (res.ok) setData(await res.json())
    if (colorRes.ok) setBranchColorMap(await colorRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function toggleTf(tfName: string) {
    setExpandedTfs(prev => {
      const next = new Set(prev)
      next.has(tfName) ? next.delete(tfName) : next.add(tfName)
      return next
    })
  }

  function toggleBranch(branchId: string) {
    setExpandedBranches(prev => {
      const next = new Set(prev)
      next.has(branchId) ? next.delete(branchId) : next.add(branchId)
      return next
    })
  }

  function openMemoEdit(tfName: string, currentMemo: string | null) {
    setEditingTf(tfName)
    setMemoDraft(currentMemo ?? '')
  }

  async function saveMemo() {
    if (!editingTf) return
    setSaving(true)
    const res = await fetch(`/api/admin/tf-meta/${encodeURIComponent(editingTf)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo: memoDraft || null }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingTf(null)
      await load()
    } else {
      alert('저장 실패')
    }
  }

  function openBranchEdit(branch: BranchWithTfs) {
    setEditingBranch(branch.id)
    setTfListDraft(branch.tfs.map(t => t.tfName))
    setNewTfInput('')
  }

  function openColorEdit(branch: BranchWithTfs) {
    setEditingColorBranch(branch.id)
    setColorDraft(branch.colorBase ?? '#006838')
  }

  async function saveBranchColor() {
    if (!editingColorBranch) return
    setSaving(true)
    const res = await fetch(`/api/admin/branches/${editingColorBranch}/color`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorBase: colorDraft }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingColorBranch(null)
      await load()
    } else {
      const err = await res.text().catch(() => '')
      alert('저장 실패: ' + err)
    }
  }

  async function saveBranchTfs() {
    if (!editingBranch) return
    setSaving(true)
    const res = await fetch(`/api/admin/branches/${editingBranch}/tfs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tfs: tfListDraft }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingBranch(null)
      await load()
    } else {
      alert('저장 실패')
    }
  }

  function addTfToDraft() {
    const trimmed = newTfInput.trim()
    if (!trimmed) return
    if (!trimmed.endsWith('TF') && !trimmed.toLowerCase().endsWith('tf')) {
      if (!confirm(`"${trimmed}" 는 'TF'로 끝나지 않아. 그래도 추가?`)) return
    }
    if (tfListDraft.includes(trimmed)) return
    setTfListDraft(prev => [...prev, trimmed])
    setNewTfInput('')
  }

  function removeTfFromDraft(tf: string) {
    setTfListDraft(prev => prev.filter(t => t !== tf))
  }

  function moveTfInDraft(tf: string, delta: number) {
    setTfListDraft(prev => {
      const idx = prev.indexOf(tf)
      if (idx < 0) return prev
      const next = [...prev]
      const swapIdx = idx + delta
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  // 검색 필터
  const filteredBranches = data?.branches.filter(b => {
    if (!query) return true
    const q = query.toLowerCase()
    return b.name.toLowerCase().includes(q) || b.tfs.some(t => t.tfName.toLowerCase().includes(q))
  }) ?? []

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">TF 관리</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            지사별 관할 TF · 메모 편집. 이 내용은 통합캘린더 등 전 시스템에 반영됩니다.
          </p>
        </div>
        {data && (
          <div className="text-xs text-gray-500">
            지사 <b>{data.totalBranches}</b>개 · TF <b>{data.totalTfs}</b>개
            {data.orphanTfs.length > 0 && <span className="text-amber-600"> · 미배정 <b>{data.orphanTfs.length}</b>개</span>}
          </div>
        )}
      </div>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="지사명 또는 TF명으로 검색..."
        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-sky-400"
      />

      {loading && <div className="text-sm text-gray-400 py-8 text-center">로딩 중...</div>}

      {/* 지사별 섹션 */}
      {!loading && filteredBranches.map(branch => {
        const branchOpen = expandedBranches.has(branch.id) || query.length > 0
        const memosCount = branch.tfs.filter(t => t.memo).length
        return (
          <div key={branch.id} className="border rounded-lg bg-white">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 hover:bg-gray-100">
              <button
                onClick={() => toggleBranch(branch.id)}
                className="flex items-center gap-2 text-left flex-1"
              >
                <span className="text-xs text-gray-400">{branchOpen ? '▼' : '▶'}</span>
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-300"
                  style={{ backgroundColor: branch.colorBase ?? '#D1D5DB' }}
                  title={`지사 대표 색: ${branch.colorBase ?? '(미설정)'}`}
                />
                <span className="text-sm font-semibold text-gray-800">{branch.name}</span>
                {branch.region && <span className="text-[10px] text-gray-400">({branch.region})</span>}
                {!branch.isActive && <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">비활성</span>}
              </button>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>TF {branch.tfs.length}개</span>
                {memosCount > 0 && <span className="text-sky-600">메모 {memosCount}</span>}
                <button
                  onClick={() => openColorEdit(branch)}
                  className="text-[11px] text-gray-400 hover:text-sky-600 hover:underline"
                  title="지사 대표 색 변경"
                >
                  🎨 색상
                </button>
              </div>
            </div>
            {branchOpen && (
              <div className="p-2 space-y-1">
                {branch.tfs.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3 text-center">관할 TF 없음</div>
                ) : (
                  branch.tfs.map(tf => {
                    const isExpanded = expandedTfs.has(tf.tfName)
                    const hasMemo = !!tf.memo
                    return (
                      <div key={tf.tfName} className="border rounded">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50">
                          <span
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: getTFColor(tf.tfName, branchColorMap) }}
                          />
                          <button
                            onClick={() => hasMemo && toggleTf(tf.tfName)}
                            className={`text-sm text-gray-800 flex-1 text-left ${hasMemo ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            {tf.tfName}
                            {hasMemo && (
                              <span className="ml-2 text-[10px] text-sky-500">
                                {isExpanded ? '▼ 메모 접기' : '▶ 메모 보기'}
                              </span>
                            )}
                          </button>
                          <span className="text-[11px] text-gray-400">
                            사용 {tf.usageCount.toLocaleString()}건
                          </span>
                          <button
                            onClick={() => openMemoEdit(tf.tfName, tf.memo)}
                            className="text-[11px] text-gray-400 hover:text-sky-600 hover:underline ml-2"
                          >
                            {hasMemo ? '메모 편집' : '메모 추가'}
                          </button>
                        </div>
                        {isExpanded && tf.memo && (
                          <div className="px-2.5 pb-2 pl-7">
                            <div className="text-xs text-gray-600 bg-amber-50 border-l-2 border-amber-300 px-2 py-1.5 whitespace-pre-wrap rounded-r">
                              {tf.memo}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                <div className="pt-2 border-t">
                  <button
                    onClick={() => openBranchEdit(branch)}
                    className="text-xs text-gray-500 hover:text-sky-600 hover:underline"
                  >
                    ✎ 관할 TF 편집 (추가 / 삭제 / 순서)
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* 미배정 TF 섹션 */}
      {!loading && data && data.orphanTfs.length > 0 && (
        <div className="border border-amber-200 rounded-lg bg-amber-50/50">
          <div className="px-3 py-2 border-b border-amber-200 text-sm font-semibold text-amber-700">
            ⚠ 어느 지사에도 배정되지 않은 TF ({data.orphanTfs.length}개)
            <span className="ml-2 text-[11px] font-normal text-gray-500">
              캘린더에는 저장되어 있으나 TF_BY_BRANCH에 없음 — 지사 배정 필요
            </span>
          </div>
          <div className="p-2 space-y-1">
            {data.orphanTfs.map(tf => (
              <div key={tf.tfName} className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded border">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getTFColor(tf.tfName, branchColorMap) }} />
                <span className="text-sm text-gray-800 flex-1">{tf.tfName}</span>
                <span className="text-[11px] text-gray-400">사용 {tf.usageCount.toLocaleString()}건</span>
                <button
                  onClick={() => openMemoEdit(tf.tfName, tf.memo)}
                  className="text-[11px] text-gray-500 hover:text-sky-600 hover:underline"
                >
                  메모
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메모 편집 모달 */}
      {editingTf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingTf(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">메모 편집: <span className="text-sky-600">{editingTf}</span></h2>
              <button onClick={() => setEditingTf(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <textarea
              value={memoDraft}
              onChange={e => setMemoDraft(e.target.value)}
              placeholder="이 TF의 배경·용도·특이사항을 기록하세요. (비워두면 메모 제거)"
              className="w-full border rounded px-2 py-1.5 text-sm h-32 focus:outline-none focus:border-sky-400"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingTf(null)} className="px-3 py-1.5 text-sm text-gray-500 border rounded hover:bg-gray-50">
                취소
              </button>
              <button onClick={saveMemo} disabled={saving} className="px-4 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지사 색상 편집 모달 */}
      {editingColorBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingColorBranch(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                지사 대표 색: <span className="text-sky-600">{data?.branches.find(b => b.id === editingColorBranch)?.name}</span>
              </h2>
              <button onClick={() => setEditingColorBranch(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colorDraft}
                onChange={e => setColorDraft(e.target.value.toUpperCase())}
                className="w-14 h-14 cursor-pointer border rounded"
              />
              <input
                type="text"
                value={colorDraft}
                onChange={e => setColorDraft(e.target.value)}
                placeholder="#006838"
                className="flex-1 border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-sky-400"
              />
            </div>

            {/* 미리보기 — 이 지사 소속 TF들이 이 색을 베이스로 어떻게 변형되는지 */}
            {(() => {
              const branch = data?.branches.find(b => b.id === editingColorBranch)
              if (!branch) return null
              const previewMap = { ...branchColorMap, [branch.name]: colorDraft }
              return (
                <div className="border rounded p-2 space-y-1">
                  <div className="text-[10px] text-gray-400 mb-1">미리보기 (소속 TF 색상 변형)</div>
                  {branch.tfs.length === 0 && <div className="text-xs text-gray-400">소속 TF 없음</div>}
                  {branch.tfs.map(tf => (
                    <div key={tf.tfName} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: getTFColor(tf.tfName, previewMap) }} />
                      <span>{tf.tfName}</span>
                    </div>
                  ))}
                </div>
              )
            })()}

            <div className="text-[11px] text-gray-500 bg-gray-50 rounded p-2">
              💡 지사 대표 색을 정하면, 소속 TF들은 명도만 다른 같은 계열 색으로 자동 배정됩니다.
              <br />통합캘린더의 모든 TF 색상이 여기서 관리된 값으로 통일됩니다.
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button onClick={() => setEditingColorBranch(null)} className="px-3 py-1.5 text-sm text-gray-500 border rounded hover:bg-gray-50">
                취소
              </button>
              <button onClick={saveBranchColor} disabled={saving} className="px-4 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지사 TF 편집 모달 */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingBranch(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                관할 TF 편집: <span className="text-sky-600">{data?.branches.find(b => b.id === editingBranch)?.name}</span>
              </h2>
              <button onClick={() => setEditingBranch(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto border rounded p-2">
              {tfListDraft.length === 0 && (
                <div className="text-xs text-gray-400 py-3 text-center">관할 TF 없음</div>
              )}
              {tfListDraft.map((tf, idx) => (
                <div key={tf} className="flex items-center gap-2 px-2 py-1 border rounded bg-gray-50">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getTFColor(tf, branchColorMap) }} />
                  <span className="text-sm flex-1">{tf}</span>
                  <button
                    onClick={() => moveTfInDraft(tf, -1)}
                    disabled={idx === 0}
                    className="text-[11px] text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >▲</button>
                  <button
                    onClick={() => moveTfInDraft(tf, 1)}
                    disabled={idx === tfListDraft.length - 1}
                    className="text-[11px] text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >▼</button>
                  <button
                    onClick={() => removeTfFromDraft(tf)}
                    className="text-[11px] text-red-400 hover:text-red-600"
                  >제거</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTfInput}
                onChange={e => setNewTfInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTfToDraft()}
                placeholder="신규 TF명 입력 (예: 이산XXX TF)"
                className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-sky-400"
              />
              <button onClick={addTfToDraft} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded">
                추가
              </button>
            </div>

            <div className="text-[11px] text-gray-500 bg-gray-50 rounded p-2">
              💡 TF를 다른 지사로 <b>이동</b>하려면: 먼저 여기서 제거 후 대상 지사 편집 모달에서 추가하면 됩니다.
              <br />이름 오기가 있는 TF는 자동으로 통합캘린더에서도 해당 지사 색으로 묶여 표시됩니다.
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button onClick={() => setEditingBranch(null)} className="px-3 py-1.5 text-sm text-gray-500 border rounded hover:bg-gray-50">
                취소
              </button>
              <button onClick={saveBranchTfs} disabled={saving} className="px-4 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
