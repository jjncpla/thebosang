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
  const [staffList, setStaffList] = useState<string[]>([])
  const [usages, setUsages] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(false)

  // 인라인 편집 상태: { recordId: { staffName: ratio } }
  const [editingCell, setEditingCell] = useState<{ recordId: string; staffName: string } | null>(null)
  const [editValue, setEditValue] = useState('')

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

  // ── 비율 편집 저장
  const saveAllocation = async (recordId: string, staffName: string, newRatio: number) => {
    const record = records.find(r => r.id === recordId)
    if (!record) return

    // 기존 allocations 복사 후 해당 직원 비율 업데이트
    const existingAllocations = record.allocations.map(a => ({
      staffName: a.staffName,
      ratio: a.ratio,
      isExternal: a.isExternal,
    }))

    const existingIdx = existingAllocations.findIndex(a => a.staffName === staffName)
    if (newRatio === 0) {
      // 0이면 해당 직원 allocation 제거
      if (existingIdx >= 0) existingAllocations.splice(existingIdx, 1)
    } else if (existingIdx >= 0) {
      existingAllocations[existingIdx].ratio = newRatio
    } else {
      existingAllocations.push({ staffName, ratio: newRatio, isExternal: false })
    }

    // 비율합계 검증
    const totalRatio = existingAllocations.reduce((sum, a) => sum + a.ratio, 0)
    if (totalRatio > 100) {
      alert(`비율 합계가 100%를 초과합니다 (${totalRatio}%). 저장할 수 없습니다.`)
      return
    }

    try {
      const res = await fetch(`/api/branch/settlement-records/${recordId}/allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: existingAllocations }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, allocations: updated.allocations } : r))
      }
    } catch (e) {
      console.error('배분 저장 실패:', e)
    }

    setEditingCell(null)
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
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">데이터 로딩 중...</div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════
              섹션 1: 정산 인센티브 배분 내역 (메인 테이블)
          ══════════════════════════════════════════════════════════ */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">
              📊 정산 인센티브 배분 내역 ({year}년 {quarter}분기 · {branch})
            </h3>
            {records.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border rounded">
                해당 기간 더보상 TF 정산 데이터가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className={thCls} rowSpan={2}>연번</th>
                      <th className={thCls} rowSpan={2}>정산월</th>
                      <th className={thCls} rowSpan={2}>재해자</th>
                      <th className={thCls} rowSpan={2}>사건종류</th>
                      <th className={thCls} rowSpan={2}>담당자</th>
                      <th className={thCls} rowSpan={2}>정산액<br/>(부가세포함)</th>
                      <th className={thCls} rowSpan={2}>정산액<br/>(부가세제외)</th>
                      <th className={thCls} rowSpan={2}>인센대상액<br/>(10%)</th>
                      <th className={thCls} rowSpan={2}>비율<br/>합계</th>
                      {staffList.map(s => (
                        <th key={s} className={thCls} colSpan={2}>{s}</th>
                      ))}
                      <th className={thCls} rowSpan={2}>비고</th>
                    </tr>
                    <tr>
                      {staffList.map(s => ([
                        <th key={`${s}-pct-h`} className={thCls} style={{ minWidth: 30 }}>
                          <span className="block text-[10px]">%</span>
                        </th>,
                        <th key={`${s}-amt-h`} className={thCls} style={{ minWidth: 60 }}>
                          <span className="block text-[10px]">금액</span>
                        </th>
                      ]))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, idx) => {
                      const base = incentiveBase(r.grossAmount)
                      const ratioSum = getRatioSum(r)
                      const netAmt = Math.floor(r.grossAmount / 1.1)
                      const isBranchCase = (r.salesStaffName && r.salesStaffName.startsWith('더보상')) ||
                        (r.settlementStaffName && r.settlementStaffName.startsWith('더보상'))

                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className={`${cellCls} text-center`}>{idx + 1}</td>
                          <td className={`${cellCls} text-center`}>{r.month}월</td>
                          <td className={`${cellCls} text-center`}>{r.victimName}</td>
                          <td className={`${cellCls} text-center`}>{r.caseType || ''}</td>
                          <td className={`${cellCls} text-center whitespace-nowrap`}>
                            {r.settlementStaffName || r.salesStaffName || ''}
                          </td>
                          <td className={`${cellCls} text-right`}>{fmt(r.grossAmount)}</td>
                          <td className={`${cellCls} text-right`}>{fmt(netAmt)}</td>
                          <td className={`${cellCls} text-right font-medium`}>{fmt(base)}</td>
                          <td className={`${cellCls} text-center font-medium ${
                            ratioSum !== 100 ? 'text-red-500' : 'text-green-600'
                          }`}>
                            {ratioSum}%
                          </td>
                          {staffList.map(s => {
                            const ratio = getStaffRatio(r, s)
                            const isEditing = editingCell?.recordId === r.id && editingCell?.staffName === s
                            return [
                              <td key={`${r.id}-${s}-pct`}
                                className={`${cellCls} text-center cursor-pointer hover:bg-sky-50`}
                                onClick={() => {
                                  setEditingCell({ recordId: r.id, staffName: s })
                                  setEditValue(String(ratio))
                                }}
                              >
                                {isEditing ? (
                                  <input
                                    type="number"
                                    min={0} max={100}
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => saveAllocation(r.id, s, parseInt(editValue) || 0)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveAllocation(r.id, s, parseInt(editValue) || 0)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    autoFocus
                                    className="w-12 text-center border border-sky-400 rounded text-xs py-0"
                                  />
                                ) : (
                                  <span className={ratio > 0 ? 'text-sky-600' : 'text-gray-300'}>
                                    {ratio > 0 ? `${ratio}` : '-'}
                                  </span>
                                )}
                              </td>,
                              <td key={`${r.id}-${s}-amt`} className={`${cellCls} text-right`}>
                                {ratio > 0 ? (
                                  <span className="text-green-700">{fmt(getStaffIncentive(r.grossAmount, ratio))}</span>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            ]
                          })}
                          <td className={`${cellCls} text-xs text-gray-500`}>
                            {r.memo || ''}
                            {isBranchCase && ratioSum < 100 && (
                              <span className="text-orange-500 ml-1">
                                (지사인센 {100 - ratioSum}%)
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {/* 합계 행 */}
                    <tr className="bg-gray-100 font-medium">
                      <td className={`${cellCls} text-center`} colSpan={5}>합계</td>
                      <td className={`${cellCls} text-right`}>
                        {fmt(records.reduce((s, r) => s + r.grossAmount, 0))}
                      </td>
                      <td className={`${cellCls} text-right`}>
                        {fmt(records.reduce((s, r) => s + Math.floor(r.grossAmount / 1.1), 0))}
                      </td>
                      <td className={`${cellCls} text-right`}>
                        {fmt(records.reduce((s, r) => s + incentiveBase(r.grossAmount), 0))}
                      </td>
                      <td className={cellCls}></td>
                      {staffList.map(s => [
                        <td key={`total-${s}-pct`} className={cellCls}></td>,
                        <td key={`total-${s}-amt`} className={`${cellCls} text-right text-green-700 font-bold`}>
                          {fmt(staffIncentiveTotals[s] || 0)}
                        </td>
                      ])}
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
            <h3 className="text-sm font-bold text-gray-800 mb-2">
              📋 인센티브 합계 요약
            </h3>
            <div className="overflow-x-auto">
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
                  {staffList.map(s => {
                    const personalTotal = staffIncentiveTotals[s] || 0
                    const total = personalTotal // 자차보조금 미포함 (향후 추가)
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
          </div>

          {/* ══════════════════════════════════════════════════════════
              섹션 3: 지사 인센티브 관리
          ══════════════════════════════════════════════════════════ */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">
              🏢 지사 인센티브 관리
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </>
      )}
    </div>
  )
}
