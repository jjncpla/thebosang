'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { QUARTER_MONTHS } from '../_constants/performance'

// ─── 타입 ────────────────────────────────────────────────────────
interface Allocation {
  id: string
  staffName: string
  ratio: number
  isExternal: boolean
}

interface SettlementWithAlloc {
  id: string
  month: number
  paymentDate: string | null
  victimName: string
  caseType: string | null
  tfName: string | null
  salesStaffName: string | null
  settlementStaffName: string | null
  grossAmount: number
  deduction: number
  memo: string | null
  allocations: Allocation[]
}

interface UsageRecord {
  id: string
  usageDate: string
  description: string
  amount: number
}

interface StaffRosterItem {
  id: string
  staffName: string
  staffType?: string
  startYear: number
  startMonth: number
  endYear: number | null
  endMonth: number | null
}

// ─── 유틸 ─────────────────────────────────────────────────────────
function fmt(n: number) {
  return n ? n.toLocaleString('ko-KR') : '0'
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

const ALL_BRANCHES = [
  '울산지사', '부산경남지사', '서울북부지사', '경기안산지사', '전북익산지사',
  '경북구미지사', '경기의정부지사', '강원동해지사', '전남여수지사', '대구지사',
  '부산중부지사', '경기수원지사',
]

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function IncentiveTab() {
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)

  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(currentQuarter)
  const [branch, setBranch] = useState('울산지사')

  const [records, setRecords] = useState<SettlementWithAlloc[]>([])
  const [staffRoster, setStaffRoster] = useState<StaffRosterItem[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [usages, setUsages] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(false)

  // 섹션 접기/펼치기
  const [openSections, setOpenSections] = useState({
    distribution: true,
    summary: true,
    branch: true,
  })
  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // 엑셀 임포트 상태
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState<any>(null)
  const [importResult, setImportResult] = useState<any>(null)

  // 인라인 편집 상태
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editAllocations, setEditAllocations] = useState<{ staffName: string; ratio: number }[]>([])

  // 사용 내역 추가 폼
  const [showAddUsage, setShowAddUsage] = useState(false)
  const [newUsage, setNewUsage] = useState({ usageDate: '', description: '', amount: '' })
  const [usageSaving, setUsageSaving] = useState(false)

  // ── 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 분기의 시작/끝 월 계산
      const startMonth = (quarter - 1) * 3 + 1
      const endMonth = startMonth + 2

      const [recordsRes, usagesRes, rosterRes] = await Promise.all([
        fetch(`/api/branch/incentive?branchName=${encodeURIComponent(branch)}&year=${year}&quarter=${quarter}`),
        fetch(`/api/branch/incentive/usage?branchName=${encodeURIComponent(branch)}&year=${year}&quarter=${quarter}`),
        fetch(`/api/branch/staff-roster?branchName=${encodeURIComponent(branch)}&year=${year}&month=${endMonth}`),
      ])

      const [recordsData, usagesData, rosterData] = await Promise.all([
        recordsRes.json(),
        usagesRes.json(),
        rosterRes.json(),
      ])

      if (Array.isArray(recordsData)) setRecords(recordsData)
      if (Array.isArray(usagesData)) setUsages(usagesData)
      if (Array.isArray(rosterData)) {
        setStaffRoster(rosterData)
        setStaffList(rosterData.map((r: StaffRosterItem) => r.staffName))
      }
    } catch (e) {
      console.error('데이터 로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }, [branch, year, quarter])

  useEffect(() => { loadData() }, [loadData])

  // ── 인센 대상액 계산
  const incentiveBase = (grossAmount: number) => Math.floor(grossAmount / 11)

  // ── 직원별 비율 가져오기
  const getStaffRatio = (record: SettlementWithAlloc, staffName: string): number => {
    const alloc = record.allocations.find(a => a.staffName === staffName)
    return alloc ? alloc.ratio : 0
  }

  // ── 비율 합계
  const getRatioSum = (record: SettlementWithAlloc): number => {
    return record.allocations.reduce((sum, a) => sum + a.ratio, 0)
  }

  // ── 직원별 인센 금액
  const getStaffIncentive = (grossAmount: number, ratio: number): number => {
    return Math.floor(grossAmount / 11 * ratio / 100)
  }

  // ── 편집 시작
  const startEditing = (record: SettlementWithAlloc) => {
    setEditingRecordId(record.id)
    setEditAllocations(
      record.allocations
        .filter(a => a.ratio > 0)
        .map(a => ({ staffName: a.staffName, ratio: a.ratio }))
    )
  }

  // ── 편집 취소
  const cancelEditing = () => {
    setEditingRecordId(null)
    setEditAllocations([])
  }

  // ── 편집 저장
  const saveAllocations = async (recordId: string) => {
    const totalRatio = editAllocations.reduce((sum, a) => sum + a.ratio, 0)
    if (totalRatio > 100) {
      alert(`비율 합계가 100%를 초과합니다(${totalRatio}%). 저장할 수 없습니다.`)
      return
    }

    try {
      const res = await fetch(`/api/branch/settlement-records/${recordId}/allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: editAllocations.filter(a => a.ratio > 0).map(a => ({
            staffName: a.staffName,
            ratio: a.ratio,
            isExternal: false,
          })),
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, allocations: updated.allocations } : r))
      } else {
        alert('저장 실패')
      }
    } catch (e) {
      console.error('배분 저장 실패:', e)
    }
    setEditingRecordId(null)
    setEditAllocations([])
  }

  // ── 사용 내역 추가
  const addUsage = async () => {
    if (!newUsage.usageDate || !newUsage.description || !newUsage.amount) {
      alert('모든 항목을 입력해주세요.')
      return
    }
    setUsageSaving(true)
    try {
      const res = await fetch('/api/branch/incentive/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName: branch,
          year,
          quarter,
          usageDate: newUsage.usageDate,
          description: newUsage.description,
          amount: parseInt(newUsage.amount),
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setUsages(prev => [...prev, created])
        setNewUsage({ usageDate: '', description: '', amount: '' })
        setShowAddUsage(false)
      }
    } catch (e) {
      console.error('사용 내역 추가 실패:', e)
    } finally {
      setUsageSaving(false)
    }
  }

  // ── 사용 내역 삭제
  const deleteUsage = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/branch/incentive/usage?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUsages(prev => prev.filter(u => u.id !== id))
      }
    } catch (e) {
      console.error('사용 내역 삭제 실패:', e)
    }
  }

  // ── 엑셀 임포트 미리보기
  const handleImportPreview = async () => {
    if (!importFile) return
    setImportLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('branchName', branch)
      fd.append('year', String(year))
      fd.append('quarter', String(quarter))
      fd.append('dryRun', 'true')
      const res = await fetch('/api/branch/incentive/import-excel', { method: 'POST', body: fd })
      setPreviewResult(await res.json())
    } finally { setImportLoading(false) }
  }

  // ── 엑셀 임포트 실행
  const handleImportConfirm = async () => {
    if (!importFile) return
    setImportLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('branchName', branch)
      fd.append('year', String(year))
      fd.append('quarter', String(quarter))
      fd.append('dryRun', 'false')
      const res = await fetch('/api/branch/incentive/import-excel', { method: 'POST', body: fd })
      const data = await res.json()
      setImportResult(data)
      if (data.ok) loadData()
    } finally { setImportLoading(false) }
  }

  // ── 직원별 인센티브 합계
  const staffIncentiveTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const s of staffList) totals[s] = 0
    for (const r of records) {
      for (const s of staffList) {
        const ratio = getStaffRatio(r, s)
        if (ratio > 0) {
          totals[s] += getStaffIncentive(r.grossAmount, ratio)
        }
      }
    }
    return totals
  }, [records, staffList])

  // ── 지사 인센 미배분액 계산
  const branchUnallocated = useMemo(() => {
    let total = 0
    for (const r of records) {
      // 지사 사건: salesStaffName 또는 settlementStaffName이 '더보상'으로 시작
      const isBranchCase = (r.salesStaffName && r.salesStaffName.startsWith('더보상')) ||
        (r.settlementStaffName && r.settlementStaffName.startsWith('더보상'))
      if (!isBranchCase) continue

      const ratioSum = getRatioSum(r)
      if (ratioSum < 100) {
        const unallocRatio = 100 - ratioSum
        total += Math.floor(r.grossAmount / 11 * unallocRatio / 100)
      }
    }
    return total
  }, [records])

  // ── 사용 내역 합계
  const usageTotal = useMemo(() => {
    return usages.reduce((sum, u) => sum + u.amount, 0)
  }, [usages])

  // ── 잔액
  const balance = branchUnallocated - usageTotal

  // ── 스타일
  const cellCls = 'border border-gray-200 px-2 py-1 text-sm'
  const thCls = `${cellCls} bg-gray-50 font-medium text-center whitespace-nowrap`

  return (
    <div className="p-4 space-y-6">
      {/* ── 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number" value={year} min={2020} max={2099}
          onChange={e => setYear(parseInt(e.target.value))}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
        />
        <span className="text-sm text-gray-400">년</span>
        {[1, 2, 3, 4].map(q => (
          <button key={q}
            onClick={() => setQuarter(q)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              quarter === q ? 'bg-sky-500 text-white border-sky-500' : 'border-gray-300 text-gray-600 hover:border-sky-400'
            }`}
          >
            {q}분기
          </button>
        ))}
        <span className="text-gray-300">|</span>
        <select value={branch} onChange={e => setBranch(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm">
          {ALL_BRANCHES.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => { setImportModalOpen(true); setPreviewResult(null); setImportResult(null); setImportFile(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
        >
          엑셀 임포트
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">데이터 로딩 중...</div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════
              섹션 1: 정산 인센티브 배분 내역 (메인 테이블)
          ══════════════════════════════════════════════════════════ */}
          <div>
            <button
              onClick={() => toggleSection('distribution')}
              className="flex items-center justify-between w-full text-left cursor-pointer select-none py-1 hover:opacity-70 transition-opacity mb-2"
            >
              <span className="text-sm font-bold text-gray-800">📊 정산 인센티브 배분 내역 ({year}년 {quarter}분기 · {branch})</span>
              <span className="ml-auto text-gray-400 text-sm">{openSections.distribution ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>
            {!openSections.distribution ? null : records.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border rounded">
                해당 기간 더보상 TF 정산 데이터가 없습니다.
              </div>
            ) : (
              <div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className={thCls}>연번</th>
                      <th className={thCls}>정산월</th>
                      <th className={thCls}>재해자</th>
                      <th className={thCls}>사건종류</th>
                      <th className={thCls}>담당자</th>
                      <th className={thCls}>정산액<br/>(VAT제외)</th>
                      <th className={thCls}>인센대상액<br/>(10%)</th>
                      <th className={thCls} style={{ minWidth: 220 }}>배분 내역</th>
                      <th className={thCls}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, idx) => {
                      const base = incentiveBase(r.grossAmount)
                      const ratioSum = getRatioSum(r)
                      const netAmt = Math.floor(r.grossAmount / 1.1)
                      const isBranchCase = (r.salesStaffName && r.salesStaffName.startsWith('더보상')) ||
                        (r.settlementStaffName && r.settlementStaffName.startsWith('더보상'))
                      const isEditing = editingRecordId === r.id
                      const activeAllocs = r.allocations.filter(a => a.ratio > 0)

                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className={`${cellCls} text-center`}>{idx + 1}</td>
                          <td className={`${cellCls} text-center`}>{r.month}월</td>
                          <td className={`${cellCls} text-center`}>{r.victimName}</td>
                          <td className={`${cellCls} text-center`}>{r.caseType || ''}</td>
                          <td className={`${cellCls} text-center whitespace-nowrap`}>
                            {r.settlementStaffName || r.salesStaffName || ''}
                          </td>
                          <td className={`${cellCls} text-right`}>{fmt(netAmt)}</td>
                          <td className={`${cellCls} text-right font-medium`} style={{ color: '#059669' }}>{fmt(base)}</td>

                          {/* 배분 내역 셀 */}
                          <td className={`${cellCls} text-left`} style={{ padding: '6px 8px' }}>
                            {isEditing ? (
                              /* === 편집 모드 === */
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 200 }}>
                                {editAllocations.map(a => (
                                  <div key={a.staffName} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 12, fontWeight: 500, minWidth: 45 }}>{a.staffName}</span>
                                    <input
                                      type="number"
                                      value={a.ratio}
                                      onChange={e => {
                                        const val = parseInt(e.target.value) || 0
                                        setEditAllocations(prev => prev.map(x =>
                                          x.staffName === a.staffName ? { ...x, ratio: val } : x
                                        ))
                                      }}
                                      min={0} max={100}
                                      style={{
                                        width: 48, padding: '1px 4px', border: '1px solid #93c5fd',
                                        borderRadius: 4, fontSize: 12, textAlign: 'right',
                                      }}
                                    />
                                    <span style={{ fontSize: 11, color: '#64748b' }}>%</span>
                                    <span style={{ fontSize: 11, color: '#059669', minWidth: 55, textAlign: 'right' }}>
                                      {fmt(Math.floor(base * (a.ratio || 0) / 100))}원
                                    </span>
                                    <button
                                      onClick={() => setEditAllocations(prev => prev.filter(x => x.staffName !== a.staffName))}
                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
                                    >✕</button>
                                  </div>
                                ))}

                                {/* 직원 추가 드롭다운 */}
                                {(() => {
                                  const assignedNames = editAllocations.map(a => a.staffName)
                                  const availableExternal = staffRoster.filter(r => (!r.staffType || r.staffType === 'EXTERNAL') && !assignedNames.includes(r.staffName))
                                  const availableInternal = staffRoster.filter(r => r.staffType === 'INTERNAL' && !assignedNames.includes(r.staffName))
                                  const availableAttorney = staffRoster.filter(r => r.staffType === 'ATTORNEY' && !assignedNames.includes(r.staffName))
                                  if (availableExternal.length === 0 && availableInternal.length === 0 && availableAttorney.length === 0) return null
                                  return (
                                    <select
                                      key={`add-staff-${editAllocations.length}`}
                                      onChange={e => {
                                        const name = e.target.value
                                        if (!name) return
                                        setEditAllocations(prev => [...prev, { staffName: name, ratio: 0 }])
                                      }}
                                      defaultValue=""
                                      style={{ fontSize: 11, padding: '2px 4px', border: '1px solid #e2e8f0', borderRadius: 4, color: '#64748b' }}
                                    >
                                      <option value="" disabled>+ 직원 추가</option>
                                      {availableExternal.length > 0 && (
                                        <optgroup label="외근직">
                                          {availableExternal.map(r => <option key={r.staffName} value={r.staffName}>{r.staffName}</option>)}
                                        </optgroup>
                                      )}
                                      {availableInternal.length > 0 && (
                                        <optgroup label="내근직">
                                          {availableInternal.map(r => <option key={r.staffName} value={r.staffName}>{r.staffName}</option>)}
                                        </optgroup>
                                      )}
                                      {availableAttorney.length > 0 && (
                                        <optgroup label="노무사">
                                          {availableAttorney.map(r => <option key={r.staffName} value={r.staffName}>{r.staffName} (노무사)</option>)}
                                        </optgroup>
                                      )}
                                    </select>
                                  )
                                })()}

                                {/* 합계 + 버튼 */}
                                {(() => {
                                  const editSum = editAllocations.reduce((s, a) => s + a.ratio, 0)
                                  return (
                                    <div style={{
                                      borderTop: '1px solid #e2e8f0', paddingTop: 4, marginTop: 2,
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                      <span style={{
                                        fontSize: 11, fontWeight: 600,
                                        color: editSum > 100 ? '#ef4444' : editSum === 100 ? '#059669' : '#f59e0b',
                                      }}>
                                        합계 {editSum}% {editSum === 100 ? '✅' : editSum > 100 ? '⚠️' : ''}
                                      </span>
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                          onClick={() => saveAllocations(r.id)}
                                          disabled={editSum > 100}
                                          style={{
                                            padding: '2px 10px', fontSize: 11, borderRadius: 4, border: 'none',
                                            background: editSum > 100 ? '#e2e8f0' : '#29ABE2', color: '#fff',
                                            cursor: editSum > 100 ? 'not-allowed' : 'pointer',
                                          }}
                                        >저장</button>
                                        <button
                                          onClick={cancelEditing}
                                          style={{
                                            padding: '2px 10px', fontSize: 11, borderRadius: 4,
                                            border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer',
                                          }}
                                        >취소</button>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            ) : (
                              /* === 표시 모드 === */
                              <div
                                onClick={() => startEditing(r)}
                                style={{ cursor: 'pointer' }}
                                title="클릭하여 배분 편집"
                              >
                                {activeAllocs.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                      {activeAllocs.map(a => (
                                        <span key={a.id} style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 3,
                                          padding: '1px 7px', borderRadius: 10,
                                          background: '#f0f9ff', border: '1px solid #bae6fd',
                                          fontSize: 11, whiteSpace: 'nowrap',
                                        }}>
                                          <span style={{ fontWeight: 600, color: '#0369a1' }}>{a.staffName}</span>
                                          <span style={{ color: '#64748b' }}>{a.ratio}%</span>
                                          <span style={{ color: '#059669', fontWeight: 500 }}>
                                            {fmt(getStaffIncentive(r.grossAmount, a.ratio))}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                    <div style={{
                                      fontSize: 10,
                                      color: ratioSum === 100 ? '#64748b' : '#ef4444',
                                      fontWeight: ratioSum !== 100 ? 600 : 400,
                                    }}>
                                      합계 {ratioSum}%
                                      {ratioSum < 100 && isBranchCase && ` (지사인센 ${100 - ratioSum}%)`}
                                      {ratioSum < 100 && !isBranchCase && ` (미배분 ${100 - ratioSum}%)`}
                                      {ratioSum > 100 && ' ⚠️ 초과'}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: 11 }}>미배정</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className={`${cellCls} text-xs text-gray-500`}>
                            {r.memo || ''}
                          </td>
                        </tr>
                      )
                    })}
                    {/* 합계 행 */}
                    <tr className="bg-gray-100 font-medium">
                      <td className={`${cellCls} text-center`} colSpan={5}>합계</td>
                      <td className={`${cellCls} text-right`}>
                        {fmt(records.reduce((s, r) => s + Math.floor(r.grossAmount / 1.1), 0))}
                      </td>
                      <td className={`${cellCls} text-right`}>
                        {fmt(records.reduce((s, r) => s + incentiveBase(r.grossAmount), 0))}
                      </td>
                      <td className={`${cellCls} text-left`}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {staffList.filter(s => (staffIncentiveTotals[s] || 0) > 0).map(s => (
                            <span key={s} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '1px 7px', borderRadius: 10,
                              background: '#ecfdf5', border: '1px solid #a7f3d0',
                              fontSize: 11, fontWeight: 600,
                            }}>
                              <span style={{ color: '#065f46' }}>{s}</span>
                              <span style={{ color: '#059669' }}>{fmt(staffIncentiveTotals[s])}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={cellCls}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════
              섹션 2: 인센티브 합계 요약
          ══════════════════════════════════════════════════════════ */}
          <div>
            <button
              onClick={() => toggleSection('summary')}
              className="flex items-center justify-between w-full text-left cursor-pointer select-none py-1 hover:opacity-70 transition-opacity mb-2"
            >
              <span className="text-sm font-bold text-gray-800">📋 인센티브 합계 요약</span>
              <span className="ml-auto text-gray-400 text-sm">{openSections.summary ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>
            {openSections.summary && <><div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={thCls}>직원명</th>
                    <th className={thCls}>개인 인센티브 합계</th>
                    <th className={thCls}>자차보조금</th>
                    <th className={thCls}>합계</th>
                    <th className={thCls}>절사 (십만원 단위)</th>
                    <th className={thCls}>분기평가</th>
                    <th className={thCls}>반기평가</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRoster.filter(r => !r.staffType || r.staffType === 'EXTERNAL').map(r => {
                    const s = r.staffName
                    const personalTotal = staffIncentiveTotals[s] || 0
                    const total = personalTotal
                    const rounded = Math.ceil(total / 100000) * 100000

                    return (
                      <tr key={s} className="hover:bg-gray-50">
                        <td className={`${cellCls} text-center font-medium`}>{s}</td>
                        <td className={`${cellCls} text-right`}>{fmt(personalTotal)}</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                        <td className={`${cellCls} text-right`}>{fmt(total)}</td>
                        <td className={`${cellCls} text-right font-bold text-sky-700`}>{fmt(rounded)}</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                      </tr>
                    )
                  })}
                  {staffRoster.filter(r => r.staffType === 'INTERNAL' && (staffIncentiveTotals[r.staffName] || 0) > 0).map(r => {
                    const s = r.staffName
                    const personalTotal = staffIncentiveTotals[s] || 0
                    const total = personalTotal
                    const rounded = Math.ceil(total / 100000) * 100000

                    return (
                      <tr key={s} className="hover:bg-gray-50 bg-blue-50/40">
                        <td className={`${cellCls} text-center font-medium`}>
                          {s}<span className="ml-1 text-xs text-blue-500 font-normal">(내근)</span>
                        </td>
                        <td className={`${cellCls} text-right`}>{fmt(personalTotal)}</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                        <td className={`${cellCls} text-right`}>{fmt(total)}</td>
                        <td className={`${cellCls} text-right font-bold text-blue-600`}>{fmt(rounded)}</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                      </tr>
                    )
                  })}
                  {staffRoster.filter(r => r.staffType === 'ATTORNEY').map(r => {
                    const s = r.staffName
                    const personalTotal = staffIncentiveTotals[s] || 0
                    const total = personalTotal
                    const rounded = Math.ceil(total / 100000) * 100000

                    return (
                      <tr key={s} className="hover:bg-gray-50 bg-purple-50/30">
                        <td className={`${cellCls} text-center font-medium`}>
                          {s}<span className="ml-1 text-xs text-purple-500 font-normal">(노무사)</span>
                        </td>
                        <td className={`${cellCls} text-right`}>{fmt(personalTotal)}</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                        <td className={`${cellCls} text-right`}>{fmt(total)}</td>
                        <td className={`${cellCls} text-right font-bold text-purple-600`}>{fmt(rounded)}</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                        <td className={`${cellCls} text-center text-gray-300`}>-</td>
                      </tr>
                    )
                  })}
                  {/* 합계 행 */}
                  <tr className="bg-gray-100 font-medium">
                    <td className={`${cellCls} text-center`}>합계</td>
                    <td className={`${cellCls} text-right`}>
                      {fmt(Object.values(staffIncentiveTotals).reduce((s, v) => s + v, 0))}
                    </td>
                    <td className={cellCls}></td>
                    <td className={`${cellCls} text-right`}>
                      {fmt(Object.values(staffIncentiveTotals).reduce((s, v) => s + v, 0))}
                    </td>
                    <td className={`${cellCls} text-right font-bold`}>
                      {fmt(staffList.reduce((sum, s) => {
                        const t = staffIncentiveTotals[s] || 0
                        return sum + Math.ceil(t / 100000) * 100000
                      }, 0))}
                    </td>
                    <td className={cellCls}></td>
                    <td className={cellCls}></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              * 자차보조금, 분기평가, 반기평가 항목은 향후 업데이트 예정
            </p>
            </>}
          </div>

          {/* ══════════════════════════════════════════════════════════
              섹션 3: 지사 인센티브 관리
          ══════════════════════════════════════════════════════════ */}
          <div>
            <button
              onClick={() => toggleSection('branch')}
              className="flex items-center justify-between w-full text-left cursor-pointer select-none py-1 hover:opacity-70 transition-opacity mb-2"
            >
              <span className="text-sm font-bold text-gray-800">🏢 지사 인센티브 관리</span>
              <span className="ml-auto text-gray-400 text-sm">{openSections.branch ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>
            {openSections.branch && <><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 좌측: 미배분액 */}
              <div className="border rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">지사인센 미배분액 누적</div>
                <div className="text-2xl font-bold text-sky-700">{fmt(branchUnallocated)}원</div>
                <div className="text-[10px] text-gray-400 mt-1">
                  지사 사건(담당자명 '더보상~') 중 비율합계 &lt; 100% 인 건의 미배분 인센티브 합산
                </div>
              </div>

              {/* 우측: 사용 내역 */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">사용 내역</span>
                  <button
                    onClick={() => setShowAddUsage(true)}
                    className="text-xs text-sky-600 border border-sky-300 px-2 py-0.5 rounded hover:bg-sky-50"
                  >
                    + 추가
                  </button>
                </div>

                {usages.length === 0 && !showAddUsage ? (
                  <div className="text-center py-3 text-gray-300 text-xs">사용 내역 없음</div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className={thCls}>사용일</th>
                        <th className={thCls}>사용내역</th>
                        <th className={thCls}>금액</th>
                        <th className={thCls} style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usages.map(u => (
                        <tr key={u.id}>
                          <td className={`${cellCls} text-center`}>
                            {new Date(u.usageDate).toLocaleDateString('ko-KR')}
                          </td>
                          <td className={cellCls}>{u.description}</td>
                          <td className={`${cellCls} text-right`}>{fmt(u.amount)}</td>
                          <td className={`${cellCls} text-center`}>
                            <button
                              onClick={() => deleteUsage(u.id)}
                              className="text-red-400 hover:text-red-600"
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                      {showAddUsage && (
                        <tr>
                          <td className={cellCls}>
                            <input type="date" value={newUsage.usageDate}
                              onChange={e => setNewUsage(p => ({ ...p, usageDate: e.target.value }))}
                              className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                            />
                          </td>
                          <td className={cellCls}>
                            <input type="text" value={newUsage.description}
                              onChange={e => setNewUsage(p => ({ ...p, description: e.target.value }))}
                              placeholder="사용 내역"
                              className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                            />
                          </td>
                          <td className={cellCls}>
                            <input type="number" value={newUsage.amount}
                              onChange={e => setNewUsage(p => ({ ...p, amount: e.target.value }))}
                              placeholder="금액"
                              className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs text-right"
                            />
                          </td>
                          <td className={`${cellCls} text-center`}>
                            <div className="flex gap-1">
                              <button onClick={addUsage} disabled={usageSaving}
                                className="text-green-600 hover:text-green-800 text-xs">✓</button>
                              <button onClick={() => { setShowAddUsage(false); setNewUsage({ usageDate: '', description: '', amount: '' }) }}
                                className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                <div className="mt-2 text-xs text-gray-500">
                  사용 합계: <span className="font-medium text-gray-700">{fmt(usageTotal)}원</span>
                </div>
              </div>
            </div>

            {/* 잔액 */}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-center">
              <span className="text-sm text-gray-600">지사 인센티브 잔액 = </span>
              <span className="text-sm text-gray-500">{fmt(branchUnallocated)}원 (미배분)</span>
              <span className="text-sm text-gray-500"> - </span>
              <span className="text-sm text-gray-500">{fmt(usageTotal)}원 (사용)</span>
              <span className="text-sm text-gray-500"> = </span>
              <span className={`text-lg font-bold ${balance >= 0 ? 'text-sky-700' : 'text-red-600'}`}>
                {fmt(balance)}원
              </span>
            </div>
            </>}
          </div>
        </>
      )}

      {/* ── 엑셀 임포트 모달 */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">월말보고 엑셀 임포트</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">엑셀 파일 선택</label>
                <input type="file" accept=".xlsx,.xls"
                  onChange={e => { setImportFile(e.target.files?.[0] || null); setPreviewResult(null); setImportResult(null) }}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
              <div className="text-xs text-gray-500">
                대상: <strong>{branch}</strong> · {year}년 {quarter}분기 (<strong>{quarter}분기</strong> 시트 사용)
              </div>

              {previewResult && !previewResult.error && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-semibold">미리보기 결과</p>
                  <p>파싱 건수: <strong>{previewResult.parsedCount}건</strong></p>
                  <p>배분 직원: {previewResult.allStaff?.join(', ')}</p>
                </div>
              )}
              {previewResult?.error && (
                <div className="bg-red-50 rounded-lg p-3 text-sm text-red-600">{previewResult.error}</div>
              )}
              {importResult && (
                <div className={`rounded-lg p-3 text-sm ${importResult.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-600'}`}>
                  {importResult.ok ? (
                    <div className="space-y-0.5">
                      <p className="font-semibold">임포트 완료</p>
                      <p>신규 생성: {importResult.created}건 / 업데이트: {importResult.updated}건</p>
                      {importResult.errors?.length > 0 && <p className="text-red-500">오류: {importResult.errors[0]}</p>}
                    </div>
                  ) : <p>{importResult.error}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={handleImportPreview} disabled={!importFile || importLoading}
                className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium disabled:opacity-40">
                {importLoading && !importResult ? '파싱 중...' : '미리보기'}
              </button>
              <button onClick={handleImportConfirm} disabled={!previewResult || previewResult?.error || importLoading || !!importResult}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-40">
                {importLoading && importResult === null ? '임포트 중...' : '임포트 실행'}
              </button>
              <button onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
