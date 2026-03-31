'use client'

import { useState, useEffect, useCallback } from 'react'
import { CASE_TYPES, QUARTER_MONTHS } from '../_constants/performance'

// ─── 타입 ────────────────────────────────────────────────────────
interface StaffRosterItem {
  id: string
  staffName: string
  startYear: number
  startMonth: number
  endYear: number | null
  endMonth: number | null
}

interface AllocationRow {
  staffName: string
  ratio: number
  isExternal: boolean
}

interface SettlementRow {
  id?: string
  year?: number
  month?: number
  paymentDate: string
  victimName: string
  caseType: string
  tfName: string
  salesStaffName: string
  settlementStaffName: string
  grossAmount: number
  deduction: number
  isInstallment?: boolean
  totalInstallmentAmount?: number
  paidInstallmentAmount?: number
  memo: string
  allocations: AllocationRow[]
}

interface UserItem {
  id: string
  name: string
}

interface PatientItem {
  id: string
  name: string
}

// ─── 유틸 ─────────────────────────────────────────────────────────
function fmt(n: number) {
  return n ? n.toLocaleString('ko-KR') : ''
}
function netAmount(gross: number) {
  return Math.floor(gross / 1.1)
}
function incentiveAmount(gross: number, ratio: number) {
  return Math.floor(netAmount(gross) * (ratio / 100) * 0.1)
}

const ALL_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12] as const

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function PerformanceTab() {
  const currentYear = new Date().getFullYear()
  const [subTab, setSubTab]     = useState<'sales' | 'settlement'>('sales')
  const [year, setYear]         = useState(currentYear)
  const [quarter, setQuarter]   = useState<number | null>(null)
  const [month, setMonth]       = useState<number | null>(null)
  const [branch, setBranch]     = useState('울산지사')

  // 공통 — 사용자 목록 (DB)
  const [users, setUsers] = useState<UserItem[]>([])
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUsers(data)
    })
  }, [])

  const userNames = users.map(u => u.name)

  // ── 선택된 월 목록
  const viewMonths: number[] = quarter
    ? [...QUARTER_MONTHS[quarter]]
    : month
      ? [month]
      : [...ALL_MONTHS]

  // ══════════════════════════════════════════════════════════
  // 서브탭 A: 영업 약정건수
  // ══════════════════════════════════════════════════════════
  const [roster, setRoster]       = useState<StaffRosterItem[]>([])
  const [salesData, setSalesData] = useState<Record<string, Record<string, number>>>({})
  const [salesIds, setSalesIds]   = useState<Record<string, string>>({})
  const [salesDirty, setSalesDirty]   = useState(false)
  const [salesSaving, setSalesSaving] = useState(false)
  const [activeStaff, setActiveStaff] = useState<{ name: string; branch: string }[]>([])

  // 직원 추가 모달
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [addStaffName, setAddStaffName]       = useState('')   // select 값 ('__custom__' 포함)
  const [addStaffCustom, setAddStaffCustom]   = useState('')   // 직접입력 텍스트
  const [isCustomInput, setIsCustomInput]     = useState(false)
  const [addStaffFrom, setAddStaffFrom] = useState<{ y: number; m: number }>({ y: currentYear, m: new Date().getMonth() + 1 })

  // 퇴사 처리
  const [removingStaff, setRemovingStaff] = useState<string | null>(null)
  const [removeFrom, setRemoveFrom] = useState<{ y: number; m: number }>({ y: currentYear, m: new Date().getMonth() + 1 })

  // 직원 명단 + 약정건수 로드
  const loadSales = useCallback(async () => {
    // 분기 선택 시 마지막 달 기준으로 재직자 조회
    // → 그래야 분기 중간/마지막에 입사한 직원도 목록에 포함되고,
    //   각 월별 표에서 개별 필터링으로 정확히 표시됨
    const refMonth = month
      ? month
      : quarter
        ? QUARTER_MONTHS[quarter][2]   // 분기 마지막 달 (3,6,9,12)
        : new Date().getMonth() + 1     // 현재 달

    // 1. 재직 중인 직원 명단
    const rRes = await fetch(`/api/branch/staff-roster?branchName=${encodeURIComponent(branch)}&year=${year}&month=${refMonth}`)
    if (rRes.ok) {
      const rData: StaffRosterItem[] = await rRes.json()
      setRoster(rData)
    }

    // 2. 약정 건수 데이터
    const qs = new URLSearchParams({ year: String(year), branchName: branch, includeStaff: 'true' })
    if (quarter) qs.set('quarter', String(quarter))
    else if (month) qs.set('month', String(month))
    const sRes = await fetch(`/api/branch/sales-contracts?${qs}`)
    if (sRes.ok) {
      const sData = await sRes.json()
      const rows: { id: string; staffName: string; month: number; [k: string]: unknown }[] = Array.isArray(sData) ? sData : (sData.contracts || [])
      setActiveStaff(sData.activeStaff || [])
      const map: Record<string, Record<string, number>> = {}
      const idMap: Record<string, string> = {}
      for (const r of rows) {
        if (!map[r.staffName]) map[r.staffName] = {}
        for (const ct of CASE_TYPES) {
          map[r.staffName][`${ct.id}_${r.month}`] = (r[ct.id] as number) || 0
        }
        idMap[`${r.staffName}_${r.month}`] = r.id
      }
      setSalesData(map)
      setSalesIds(idMap)
    }
    setSalesDirty(false)
  }, [year, quarter, month, branch])

  useEffect(() => {
    if (subTab === 'sales') loadSales()
  }, [subTab, loadSales])

  function getCellValue(staffName: string, caseTypeId: string, m: number): number {
    return salesData[staffName]?.[`${caseTypeId}_${m}`] || 0
  }

  function setCellValue(staffName: string, caseTypeId: string, m: number, value: number) {
    setSalesData(prev => ({
      ...prev,
      [staffName]: {
        ...(prev[staffName] || {}),
        [`${caseTypeId}_${m}`]: value,
      }
    }))
    setSalesDirty(true)
  }

  function staffMonthTotal(staffName: string, m: number) {
    return CASE_TYPES.reduce((s, ct) => s + getCellValue(staffName, ct.id, m), 0)
  }

  async function saveSales() {
    setSalesSaving(true)
    try {
      const saves: Promise<unknown>[] = []
      for (const r of roster) {
        for (const m of viewMonths) {
          const payload: Record<string, unknown> = {
            branchName: branch, staffName: r.staffName, year, month: m,
          }
          for (const ct of CASE_TYPES) {
            payload[ct.id] = getCellValue(r.staffName, ct.id, m)
          }
          saves.push(
            fetch('/api/branch/sales-contracts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          )
        }
      }
      await Promise.all(saves)
      setSalesDirty(false)
    } finally {
      setSalesSaving(false)
    }
  }

  async function handleDeleteContract(id: string, name: string) {
    if (!confirm(`${name} 항목을 삭제하시겠습니까?`)) return
    await fetch(`/api/branch/sales-contracts/${id}`, { method: 'DELETE' })
    await loadSales()
  }

  async function handleDeleteBranchContracts() {
    if (!confirm(`${branch}의 ${year}년 전체 약정 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    await fetch('/api/branch/sales-contracts/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchName: branch, year })
    })
    await loadSales()
  }

  async function handleAddStaff() {
    const name = isCustomInput ? addStaffCustom.trim() : addStaffName.trim()
    if (!name || name === '__custom__') return
    try {
      const res = await fetch('/api/branch/staff-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName: branch,
          staffName: name,
          startYear: addStaffFrom.y,
          startMonth: addStaffFrom.m,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert('추가 실패: ' + JSON.stringify(err))
        return
      }
    } catch (e) {
      alert('네트워크 오류: ' + (e as Error).message)
      return
    }
    setShowAddStaff(false)
    setAddStaffName('')
    setAddStaffCustom('')
    setIsCustomInput(false)
    await loadSales()
  }

  async function handleRemoveStaff(rosterId: string) {
    await fetch(`/api/branch/staff-roster/${rosterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endYear: removeFrom.y, endMonth: removeFrom.m }),
    })
    setRemovingStaff(null)
    await loadSales()
  }

  // ══════════════════════════════════════════════════════════
  // 서브탭 B: 정산내역
  // ══════════════════════════════════════════════════════════
  const [settlements, setSettlements]     = useState<SettlementRow[]>([])
  const [showAddForm, setShowAddForm]     = useState(false)
  const [importing, setImporting]         = useState(false)
  const [importPreview, setImportPreview] = useState<SettlementRow[] | null>(null)
  const [importSaving, setImportSaving]   = useState(false)

  const loadSettlements = useCallback(async () => {
    const qs = new URLSearchParams({ year: String(year), branchName: branch })
    if (month) qs.set('month', String(month))
    const res = await fetch(`/api/branch/settlement-records?${qs}`)
    if (!res.ok) return
    setSettlements(await res.json())
  }, [year, month, branch])

  useEffect(() => {
    if (subTab === 'settlement') loadSettlements()
  }, [subTab, loadSettlements])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/branch/settlement-records/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || '파싱 실패'); return }
      setImportPreview(
        data.rows.map((r: SettlementRow & { year: number; month: number }) => ({
          year:    r.year,
          month:   r.month,
          paymentDate:         r.paymentDate,
          victimName:          r.victimName,
          caseType:            r.caseType || '',
          tfName:              r.tfName || '',
          salesStaffName:      r.salesStaffName || '',
          settlementStaffName: r.settlementStaffName || '',
          grossAmount:         r.grossAmount,
          deduction:           0,
          memo:                '',
          allocations: r.settlementStaffName
            ? [{ staffName: r.settlementStaffName, ratio: 100, isExternal: false }]
            : [],
        }))
      )
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function confirmImport() {
    if (!importPreview || importPreview.length === 0) return
    setImportSaving(true)

    let successCount = 0
    let failCount = 0

    try {
      let toSave: SettlementRow[] = importPreview
      if (month) {
        toSave = importPreview.filter(r => r.month === month)
      } else if (quarter) {
        const qm = QUARTER_MONTHS[quarter] as readonly number[]
        toSave = importPreview.filter(r => r.month != null && qm.includes(r.month))
      }

      if (toSave.length === 0) {
        alert('선택된 기간에 해당하는 건이 없습니다.')
        setImportSaving(false)
        return
      }

      const BATCH = 5
      for (let i = 0; i < toSave.length; i += BATCH) {
        const batch = toSave.slice(i, i + BATCH)
        const results = await Promise.allSettled(
          batch.map(row => {
            const rowYear  = (row.year  != null && !isNaN(Number(row.year)))  ? Number(row.year)  : year
            const rowMonth = (row.month != null && !isNaN(Number(row.month))) ? Number(row.month) : (month ?? 1)

            const body = {
              branchName:          branch,
              year:                rowYear,
              month:               rowMonth,
              paymentDate:         row.paymentDate   || null,
              victimName:          row.victimName    || '(미상)',
              caseType:            row.caseType      || null,
              tfName:              row.tfName        || null,
              salesStaffName:      row.salesStaffName      || null,
              settlementStaffName: row.settlementStaffName || null,
              grossAmount:         Number(row.grossAmount) || 0,
              deduction:           Number(row.deduction)   || 0,
              memo:                row.memo || null,
              allocations: Array.isArray(row.allocations)
                ? row.allocations.filter(a => a.staffName && a.staffName.trim())
                : [],
            }

            return fetch('/api/branch/settlement-records', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }).then(async res => {
              if (!res.ok) {
                const errText = await res.text().catch(() => '')
                throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`)
              }
              return res.json()
            })
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled') successCount++
          else {
            failCount++
            console.error('정산 저장 실패:', result.reason)
          }
        }
      }

      setImportPreview(null)

      if (failCount > 0) {
        alert(`${successCount}건 저장 완료, ${failCount}건 실패`)
      }

      await loadSettlements()

    } catch (e) {
      console.error('confirmImport 전체 오류:', e)
      alert('저장 중 오류: ' + (e as Error).message)
    } finally {
      setImportSaving(false)   // ← 반드시 실행
    }
  }

  async function deleteSettlement(id: string) {
    if (!confirm('이 건을 삭제하시겠습니까?')) return
    await fetch(`/api/branch/settlement-records/${id}`, { method: 'DELETE' })
    await loadSettlements()
  }

  // 필터된 정산 목록
  const filteredSettlements = settlements.filter(s => {
    const m = s.paymentDate ? parseInt(s.paymentDate.slice(5, 7)) : null
    if (month && m !== month) return false
    if (quarter && m) {
      const qm = QUARTER_MONTHS[quarter]
      if (!qm.includes(m as 1|2|3|4|5|6|7|8|9|10|11|12)) return false
    }
    return true
  })

  // 담당자별 집계
  const staffSummary: Record<string, { count: number; totalNet: number; totalIncentive: number }> = {}
  for (const s of filteredSettlements) {
    const net = netAmount(s.grossAmount) - (s.deduction || 0)
    for (const a of (s.allocations || [])) {
      if (!staffSummary[a.staffName]) staffSummary[a.staffName] = { count: 0, totalNet: 0, totalIncentive: 0 }
      staffSummary[a.staffName].count      += 1
      staffSummary[a.staffName].totalNet   += Math.floor(net * a.ratio / 100)
      staffSummary[a.staffName].totalIncentive += incentiveAmount(s.grossAmount, a.ratio)
    }
  }

  // ─── 스타일 ────────────────────────────────────────────────
  const cellCls = 'border border-gray-200 px-2 py-1 text-sm'
  const thCls   = `${cellCls} bg-gray-50 font-medium text-center whitespace-nowrap`

  // ─── 렌더 ─────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">

      {/* ── 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number" value={year} min={2020} max={2099}
          onChange={e => setYear(parseInt(e.target.value))}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
        />
        <span className="text-sm text-gray-400">년</span>
        {[1,2,3,4].map(q => (
          <button key={q}
            onClick={() => { setQuarter(quarter === q ? null : q); setMonth(null) }}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              quarter === q ? 'bg-sky-500 text-white border-sky-500' : 'border-gray-300 text-gray-600 hover:border-sky-400'
            }`}
          >
            {q}분기
          </button>
        ))}
        <span className="text-gray-300">|</span>
        {ALL_MONTHS.map(m => (
          <button key={m}
            onClick={() => { setMonth(month === m ? null : m); setQuarter(null) }}
            className={`w-7 py-1 text-xs rounded border transition-colors ${
              month === m ? 'bg-teal-500 text-white border-teal-500'
                : (quarter && (QUARTER_MONTHS[quarter] as readonly number[]).includes(m))
                  ? 'bg-sky-50 border-sky-300 text-sky-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {m}
          </button>
        ))}
        <span className="text-gray-300">|</span>
        <select value={branch} onChange={e => setBranch(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm">
          {['울산지사','부산경남지사','서울북부지사','경기안산지사','전북익산지사',
            '경북구미지사','경기의정부지사','강원동해지사','전남여수지사','대구지사',
            '부산중부지사','경기수원지사'].map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* ── 서브탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {[['sales','영업 약정건수'],['settlement','정산내역']].map(([id, label]) => (
          <button key={id}
            onClick={() => setSubTab(id as 'sales' | 'settlement')}
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
              subTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          서브탭 A: 영업 약정건수 — 월별 세로 표
      ══════════════════════════════════════════════════════ */}
      {subTab === 'sales' && (
        <div className="space-y-4">

          {/* 직원 추가/저장/삭제 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddStaff(true)}
              className="px-3 py-1.5 text-sm border border-sky-300 text-sky-600 rounded hover:bg-sky-50"
            >
              + 직원 추가
            </button>
            <button
              onClick={saveSales}
              disabled={!salesDirty || salesSaving}
              className={`px-4 py-1.5 text-sm rounded font-medium transition-colors ${
                salesDirty && !salesSaving
                  ? 'bg-sky-500 text-white hover:bg-sky-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {salesSaving ? '저장 중...' : salesDirty ? '변경사항 저장' : '저장됨'}
            </button>
            <button
              onClick={handleDeleteBranchContracts}
              className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
            >
              지사 데이터 전체 삭제
            </button>
          </div>

          {/* 직원 추가 모달 */}
          {showAddStaff && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 w-80 space-y-4">
                <h3 className="font-medium">직원 추가</h3>
                <div>
                  <label className="text-xs text-gray-500">직원명</label>
                  <select
                    value={addStaffName}
                    onChange={e => {
                      const v = e.target.value
                      setAddStaffName(v)
                      setIsCustomInput(v === '__custom__')
                      if (v !== '__custom__') setAddStaffCustom('')
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-1"
                  >
                    <option value="">선택</option>
                    {userNames
                      .filter(n => !roster.find(r => r.staffName === n))
                      .map(n => <option key={n} value={n}>{n}</option>)
                    }
                    <option value="__custom__">직접 입력</option>
                  </select>
                  {isCustomInput && (
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-1"
                      placeholder="직원명 직접 입력"
                      autoFocus
                      value={addStaffCustom}
                      onChange={e => setAddStaffCustom(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddStaff()}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">입사 연도</label>
                    <input type="number" value={addStaffFrom.y}
                      onChange={e => setAddStaffFrom(p => ({ ...p, y: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-1" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">입사 월</label>
                    <input type="number" min={1} max={12} value={addStaffFrom.m}
                      onChange={e => setAddStaffFrom(p => ({ ...p, m: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-1" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddStaff(false)} className="px-3 py-1.5 text-sm border rounded">취소</button>
                  <button onClick={handleAddStaff} className="px-3 py-1.5 text-sm bg-sky-500 text-white rounded">추가</button>
                </div>
              </div>
            </div>
          )}

          {/* 퇴사 처리 모달 */}
          {removingStaff && (() => {
            const rItem = roster.find(r => r.id === removingStaff)
            return (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                <div className="bg-white rounded-xl p-6 w-80 space-y-4">
                  <h3 className="font-medium">퇴사 처리 — {rItem?.staffName}</h3>
                  <p className="text-xs text-gray-500">퇴사 처리 월부터 목록에서 제외됩니다.</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">퇴사 연도</label>
                      <input type="number" value={removeFrom.y}
                        onChange={e => setRemoveFrom(p => ({ ...p, y: parseInt(e.target.value) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-1" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">퇴사 월</label>
                      <input type="number" min={1} max={12} value={removeFrom.m}
                        onChange={e => setRemoveFrom(p => ({ ...p, m: parseInt(e.target.value) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-1" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setRemovingStaff(null)} className="px-3 py-1.5 text-sm border rounded">취소</button>
                    <button
                      onClick={() => handleRemoveStaff(removingStaff)}
                      className="px-3 py-1.5 text-sm bg-red-500 text-white rounded"
                    >퇴사 처리</button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* 재직 중 직원 자동 감지 */}
          {(() => {
            const existingNames = new Set(roster.map(r => r.staffName))
            const autoStaff = activeStaff.filter(s => !existingNames.has(s.name))
            if (autoStaff.length === 0) return null
            return (
              <div style={{ padding: 8, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>재직 중 직원 자동 감지:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {autoStaff.map(s => (
                    <button
                      key={s.name}
                      onClick={async () => {
                        await fetch('/api/branch/staff-roster', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            branchName: branch,
                            staffName: s.name,
                            startYear: year,
                            startMonth: month || (quarter ? (quarter - 1) * 3 + 1 : new Date().getMonth() + 1),
                          }),
                        })
                        await loadSales()
                      }}
                      style={{
                        padding: '3px 10px', fontSize: 12, borderRadius: 12,
                        border: '1px solid #86efac', background: '#fff', color: '#16a34a',
                        cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      + {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* 직원 없음 안내 */}
          {roster.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              직원이 없습니다. &quot;직원 추가&quot; 버튼으로 등록하세요.
            </div>
          )}

          {/* 월별 세로 표 */}
          <div className="space-y-6">
            {viewMonths.map(m => {
              const monthYM = year * 100 + m
              const monthRoster = roster.filter(r => {
                const start = r.startYear * 100 + r.startMonth
                if (start > monthYM) return false
                if (r.endYear !== null && r.endMonth !== null) {
                  const end = r.endYear * 100 + r.endMonth
                  if (end < monthYM) return false
                }
                return true
              })

              return (
                <div key={m}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                      {year}년 {m}월
                    </h3>
                    <span className="text-xs text-gray-400">총 {monthRoster.reduce((s, r) => s + staffMonthTotal(r.staffName, m), 0)}건</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="border-collapse text-xs w-full min-w-max">
                      <thead>
                        <tr>
                          <th className={`${thCls} min-w-[80px] sticky left-0 z-10`}>성명</th>
                          {CASE_TYPES.map(ct => (
                            <th key={ct.id} className={`${thCls} min-w-[52px]`}>{ct.label}</th>
                          ))}
                          <th className={`${thCls} bg-sky-50 text-sky-700 min-w-[48px]`}>합계</th>
                          <th className={`${thCls} w-8`}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthRoster.map(r => (
                          <tr key={r.staffName} className="hover:bg-gray-50">
                            <td className={`${cellCls} font-medium sticky left-0 bg-white`}>{r.staffName}</td>
                            {CASE_TYPES.map(ct => (
                              <td key={ct.id} className={cellCls}>
                                <input
                                  type="number" min={0} step={0.5}
                                  value={getCellValue(r.staffName, ct.id, m) || ''}
                                  placeholder="0"
                                  className="w-10 text-center bg-transparent outline-none"
                                  onChange={e => setCellValue(r.staffName, ct.id, m, parseFloat(e.target.value) || 0)}
                                />
                              </td>
                            ))}
                            <td className={`${cellCls} text-center font-semibold text-sky-700 bg-sky-50`}>
                              {staffMonthTotal(r.staffName, m) || 0}
                            </td>
                            <td className={cellCls}>
                              <div className="flex items-center gap-1">
                                {salesIds[`${r.staffName}_${m}`] && (
                                  <button
                                    onClick={() => handleDeleteContract(salesIds[`${r.staffName}_${m}`], r.staffName)}
                                    className="text-gray-300 hover:text-red-400 text-[10px]"
                                    title="이 월 약정 삭제"
                                  >삭제</button>
                                )}
                                <button
                                  onClick={() => { setRemovingStaff(r.id); setRemoveFrom({ y: year, m }) }}
                                  className="text-gray-300 hover:text-red-400 text-xs"
                                  title="퇴사 처리"
                                >✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {/* 상병별 합계 행 */}
                        <tr className="bg-gray-50">
                          <td className={`${cellCls} text-xs text-gray-500 sticky left-0 bg-gray-50 font-medium`}>합계</td>
                          {CASE_TYPES.map(ct => {
                            const total = monthRoster.reduce((s, r) => s + getCellValue(r.staffName, ct.id, m), 0)
                            return (
                              <td key={ct.id} className={`${cellCls} text-center font-medium text-gray-700`}>
                                {total || ''}
                              </td>
                            )
                          })}
                          <td className={`${cellCls} text-center font-bold text-sky-700 bg-sky-50`}>
                            {monthRoster.reduce((s, r) => s + staffMonthTotal(r.staffName, m), 0)}
                          </td>
                          <td className={cellCls} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          서브탭 B: 정산내역
      ══════════════════════════════════════════════════════ */}
      {subTab === 'settlement' && (
        <div className="space-y-4">

          {/* 엑셀 업로드 + 직접 추가 */}
          <div className="flex items-center gap-3">
            <label className={`px-3 py-1.5 text-sm rounded border cursor-pointer transition-colors ${
              importing ? 'bg-gray-100 text-gray-400' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
            }`}>
              {importing ? '파싱 중...' : '📂 성공보수 파일 업로드 (xlsx)'}
              <input type="file" accept=".xlsx" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
            <button
              onClick={() => setShowAddForm(f => !f)}
              className="px-3 py-1.5 text-sm border border-sky-300 text-sky-600 rounded hover:bg-sky-50"
            >
              + 직접 추가
            </button>
          </div>

          {/* 임포트 미리보기 */}
          {importPreview && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-700">
                  {importPreview.length}건 파싱 완료
                  {month && ` — ${month}월 필터 적용 시 ${importPreview.filter(r => r.month === month).length}건 저장`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setImportPreview(null)} className="px-3 py-1 text-xs border rounded">취소</button>
                  <button
                    onClick={confirmImport}
                    disabled={importSaving}
                    className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                  >
                    {importSaving ? '저장 중...' : '전체 저장'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-100">
                      {['입금일','재해자','사건종류','TF','영업담당','정산담당','입금액','배분'].map(h => (
                        <th key={h} className="border border-amber-200 px-2 py-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => (
                      <tr key={i} className="bg-white">
                        <td className="border border-amber-200 px-2 py-1">{r.paymentDate}</td>
                        <td className="border border-amber-200 px-2 py-1">{r.victimName}</td>
                        <td className="border border-amber-200 px-2 py-1">{r.caseType}</td>
                        <td className="border border-amber-200 px-2 py-1">{r.tfName}</td>
                        <td className="border border-amber-200 px-2 py-1">{r.salesStaffName}</td>
                        <td className="border border-amber-200 px-2 py-1">{r.settlementStaffName}</td>
                        <td className="border border-amber-200 px-2 py-1 text-right">{fmt(r.grossAmount)}</td>
                        <td className="border border-amber-200 px-2 py-1">
                          {r.allocations.map(a => `${a.staffName} ${a.ratio}%`).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 직접 추가 폼 */}
          {showAddForm && (
            <AddSettlementForm
              branchName={branch}
              year={year}
              defaultMonth={month || new Date().getMonth() + 1}
              userNames={userNames}
              onSave={async (row) => {
                const res = await fetch('/api/branch/settlement-records', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...row, branchName: branch }),
                })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}))
                  alert(`저장 실패: ${JSON.stringify(err)}`)
                  return
                }
                await loadSettlements()
                setShowAddForm(false)
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {/* 정산내역 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {['#','입금일','재해자','사건종류','TF','영업담당','정산담당','입금액','부가세제외','인센 대상','배분내역 (인센)',''].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSettlements.map((row, i) => {
                  const net = netAmount(row.grossAmount) - (row.deduction || 0)
                  return (
                    <tr key={row.id ?? i} className="hover:bg-gray-50">
                      <td className={`${cellCls} text-center text-gray-400`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <span>{i+1}</span>
                          {row.isInstallment && (
                            <span
                              title={`누적납부: ${(row.paidInstallmentAmount ?? 0).toLocaleString()}원 / 총액: ${(row.totalInstallmentAmount ?? 0).toLocaleString()}원`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 2,
                                padding: '1px 5px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                                backgroundColor: '#fef3c7', color: '#92400e', cursor: 'default',
                                border: '1px solid #fde68a', whiteSpace: 'nowrap',
                              }}
                            >
                              분할 {(row.paidInstallmentAmount ?? 0).toLocaleString()}/{(row.totalInstallmentAmount ?? 0).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cellCls}>{row.paymentDate?.slice(0,10)}</td>
                      <td className={`${cellCls} font-medium`}>{row.victimName}</td>
                      <td className={cellCls}>{row.caseType}</td>
                      <td className={cellCls}>{row.tfName}</td>
                      <td className={cellCls}>{row.salesStaffName}</td>
                      <td className={cellCls}>{row.settlementStaffName}</td>
                      <td className={`${cellCls} text-right`}>{fmt(row.grossAmount)}</td>
                      <td className={`${cellCls} text-right text-gray-500`}>{fmt(netAmount(row.grossAmount))}</td>
                      <td className={`${cellCls} text-right font-medium text-sky-700`}>{fmt(net)}</td>
                      <td className={`${cellCls}`}>
                        {(row.allocations || []).map((a, ai) => (
                          <div key={ai} className="text-xs">
                            {a.staffName} {a.ratio}%
                            {a.isExternal && <span className="text-amber-500 ml-1">(타)</span>}
                            <span className="text-green-600 ml-1">→{fmt(incentiveAmount(row.grossAmount, a.ratio))}</span>
                          </div>
                        ))}
                      </td>
                      <td className={cellCls}>
                        {row.id && (
                          <button onClick={() => deleteSettlement(row.id!)}
                            className="text-gray-300 hover:text-red-400">✕</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredSettlements.length === 0 && (
                  <tr>
                    <td colSpan={12} className={`${cellCls} text-center text-gray-400 py-6`}>
                      데이터 없음 — 엑셀 업로드 또는 직접 추가
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSettlements.length > 0 && (
                <tfoot>
                  <tr className="bg-sky-50 font-medium text-xs">
                    <td colSpan={7} className={`${cellCls} text-right text-sky-700`}>
                      합계 ({filteredSettlements.length}건)
                    </td>
                    <td className={`${cellCls} text-right text-sky-700`}>
                      {fmt(filteredSettlements.reduce((s, r) => s + r.grossAmount, 0))}
                    </td>
                    <td className={`${cellCls} text-right text-sky-700`}>
                      {fmt(filteredSettlements.reduce((s, r) => s + netAmount(r.grossAmount), 0))}
                    </td>
                    <td colSpan={3} className={cellCls} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* 담당자별 집계 */}
          {/* 분할납부 모니터링 */}
          {(() => {
            const installmentRecords = filteredSettlements.filter(r => r.isInstallment)
            if (installmentRecords.length === 0) return null
            const installmentByBranch = installmentRecords.reduce((acc, r) => {
              const br = (r as SettlementRow & { branchName?: string }).branchName || branch
              if (!acc[br]) acc[br] = { count: 0, totalPending: 0 }
              acc[br].count++
              acc[br].totalPending += ((r.totalInstallmentAmount || 0) - (r.paidInstallmentAmount || 0))
              return acc
            }, {} as Record<string, { count: number; totalPending: number }>)
            return (
              <div style={{ marginTop: 24, padding: 16, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
                  분할납부 모니터링 ({installmentRecords.length}건)
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(installmentByBranch).map(([br, info]) => (
                    <div key={br} style={{
                      padding: '6px 12px', background: '#fff', borderRadius: 6,
                      border: '1px solid #fde68a', fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 600 }}>{br}</span>
                      <span style={{ color: '#64748b', marginLeft: 6 }}>{info.count}건</span>
                      <span style={{ color: '#dc2626', marginLeft: 6, fontWeight: 600 }}>
                        잔액 {info.totalPending.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  {installmentRecords.map(r => (
                    <div key={r.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '4px 8px', fontSize: 12, borderBottom: '1px solid #fef3c7',
                    }}>
                      <span style={{ color: '#374151' }}>{r.victimName}</span>
                      <span style={{ color: '#64748b' }}>
                        {(r.paidInstallmentAmount ?? 0).toLocaleString()} /
                        {(r.totalInstallmentAmount ?? 0).toLocaleString()}원
                        {(r.totalInstallmentAmount || 0) > (r.paidInstallmentAmount || 0) && (
                          <span style={{ color: '#dc2626', marginLeft: 4 }}>
                            (잔액 {((r.totalInstallmentAmount || 0) - (r.paidInstallmentAmount || 0)).toLocaleString()}원)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {Object.keys(staffSummary).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">담당자별 집계</h4>
              <table className="border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {['담당자','건수','인센 대상액','인센티브(10%)'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(staffSummary)
                    .sort((a,b) => b[1].totalIncentive - a[1].totalIncentive)
                    .map(([name, stat]) => (
                      <tr key={name} className="hover:bg-gray-50">
                        <td className={`${cellCls} font-medium`}>{name}</td>
                        <td className={`${cellCls} text-center`}>{stat.count}</td>
                        <td className={`${cellCls} text-right`}>{fmt(stat.totalNet)}</td>
                        <td className={`${cellCls} text-right font-medium text-green-700`}>{fmt(stat.totalIncentive)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 직접 추가 폼 ─────────────────────────────────────────────────
function AddSettlementForm({
  branchName, year, defaultMonth, userNames,
  onSave, onCancel,
}: {
  branchName: string
  year: number
  defaultMonth: number
  userNames: string[]
  onSave: (row: SettlementRow & { year: number; month: number }) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    paymentDate: '',
    victimName: '',
    victimSearch: '',
    caseType: '',
    tfName: '',
    salesStaffName: '',
    isInstallment: false,
    totalInstallmentAmount: 0,
    paidInstallmentAmount: 0,
    settlementStaffName: '',
    grossAmount: 0,
    deduction: 0,
    memo: '',
    allocations: [{ staffName: '', ratio: 100, isExternal: false }] as AllocationRow[],
  })
  const [saving, setSaving] = useState(false)
  const [patientResults, setPatientResults] = useState<PatientItem[]>([])
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)

  async function searchPatient(q: string) {
    if (q.length < 1) { setPatientResults([]); return }
    const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      const data = await res.json()
      setPatientResults(Array.isArray(data) ? data : (data.patients || []))
    }
  }

  const totalRatio = form.allocations.reduce((s, a) => s + (a.ratio || 0), 0)

  async function handleSave() {
    if (!form.victimName) return
    setSaving(true)
    const payDate = form.paymentDate
    const rowMonth = payDate ? parseInt(payDate.slice(5, 7)) : defaultMonth
    const rowYear  = payDate ? parseInt(payDate.slice(0, 4)) : year
    try {
      await onSave({
        ...form,
        year: rowYear,
        month: rowMonth,
        paymentDate: payDate || '',
        deduction: form.deduction || 0,
      })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:border-sky-400'

  return (
    <div className="border border-sky-200 bg-sky-50 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">

        {/* 입금일자 */}
        <div>
          <label className="text-xs text-gray-500">입금일자</label>
          <input type="date" value={form.paymentDate}
            onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
            className={`${inputCls} mt-0.5`} />
        </div>

        {/* 재해자명 — 환자 검색 */}
        <div className="relative">
          <label className="text-xs text-gray-500">재해자명</label>
          <input
            value={form.victimSearch || form.victimName}
            onChange={async e => {
              const v = e.target.value
              setForm(f => ({ ...f, victimSearch: v, victimName: v }))
              setShowPatientDropdown(true)
              await searchPatient(v)
            }}
            onBlur={() => setTimeout(() => setShowPatientDropdown(false), 150)}
            placeholder="이름 검색..."
            className={`${inputCls} mt-0.5`}
          />
          {showPatientDropdown && patientResults.length > 0 && (
            <div className="absolute z-10 bg-white border border-gray-200 rounded shadow-md w-full max-h-40 overflow-y-auto mt-1">
              {patientResults.map(p => (
                <button key={p.id} onMouseDown={() => {
                  setForm(f => ({ ...f, victimName: p.name, victimSearch: p.name }))
                  setShowPatientDropdown(false)
                }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-sky-50">
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 사건종류 */}
        <div>
          <label className="text-xs text-gray-500">사건종류</label>
          <input value={form.caseType}
            onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))}
            placeholder="난청 최초, 근골 등"
            className={`${inputCls} mt-0.5`} />
        </div>

        {/* TF */}
        <div>
          <label className="text-xs text-gray-500">TF</label>
          <input value={form.tfName}
            onChange={e => setForm(f => ({ ...f, tfName: e.target.value }))}
            placeholder="더보상울산, 울산동부 등"
            className={`${inputCls} mt-0.5`} />
        </div>

        {/* 영업담당자 */}
        <div>
          <label className="text-xs text-gray-500">영업담당자</label>
          <select value={form.salesStaffName}
            onChange={e => setForm(f => ({ ...f, salesStaffName: e.target.value }))}
            className={`${inputCls} mt-0.5`}>
            <option value="">선택</option>
            {userNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* 정산담당자 */}
        <div>
          <label className="text-xs text-gray-500">정산담당자</label>
          <select value={form.settlementStaffName}
            onChange={e => setForm(f => ({ ...f, settlementStaffName: e.target.value }))}
            className={`${inputCls} mt-0.5`}>
            <option value="">선택</option>
            {userNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* 입금액 */}
        <div>
          <label className="text-xs text-gray-500">입금액 (원)</label>
          <input type="number" value={form.grossAmount || ''}
            onChange={e => setForm(f => ({ ...f, grossAmount: parseInt(e.target.value) || 0 }))}
            className={`${inputCls} mt-0.5`} />
        </div>

        {/* 공제 */}
        <div>
          <label className="text-xs text-gray-500">공제 (원)</label>
          <input type="number" value={form.deduction || ''}
            onChange={e => setForm(f => ({ ...f, deduction: parseInt(e.target.value) || 0 }))}
            className={`${inputCls} mt-0.5`} />
        </div>
      </div>

      {/* 분할납부 */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={form.isInstallment}
            onChange={e => setForm(f => ({ ...f, isInstallment: e.target.checked }))}
          />
          분할납부
        </label>
        {form.isInstallment && (
          <div className="flex gap-2 mt-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500">총 납부 예정액</label>
              <input type="number" value={form.totalInstallmentAmount || ''}
                onChange={e => setForm(f => ({ ...f, totalInstallmentAmount: parseInt(e.target.value) || 0 }))}
                className={`${inputCls} mt-0.5`} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">현재 누적 납부액</label>
              <input type="number" value={form.paidInstallmentAmount || ''}
                onChange={e => setForm(f => ({ ...f, paidInstallmentAmount: parseInt(e.target.value) || 0 }))}
                className={`${inputCls} mt-0.5`} />
            </div>
          </div>
        )}
      </div>

      {/* 인센티브 배분 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 font-medium">
            인센티브 배분 (합계: <span className={totalRatio !== 100 ? 'text-orange-500' : 'text-green-600'}>{totalRatio}%</span>)
          </span>
          <button
            onClick={() => setForm(f => ({ ...f, allocations: [...f.allocations, { staffName: '', ratio: 0, isExternal: false }] }))}
            className="text-xs text-sky-600 underline"
          >+ 추가</button>
        </div>
        {form.allocations.map((a, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <select
              value={a.staffName}
              onChange={e => {
                const v = [...form.allocations]
                v[i] = { ...v[i], staffName: e.target.value }
                setForm(f => ({ ...f, allocations: v }))
              }}
              className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
            >
              <option value="">담당자 선택</option>
              {userNames.map(n => <option key={n} value={n}>{n}</option>)}
              <option value="__custom__">직접 입력</option>
            </select>
            <input
              type="number" min={0} max={100}
              value={a.ratio}
              onChange={e => {
                const v = [...form.allocations]
                v[i] = { ...v[i], ratio: parseInt(e.target.value) || 0 }
                setForm(f => ({ ...f, allocations: v }))
              }}
              className="border border-gray-300 rounded px-2 py-1 text-xs w-14 text-center"
            />
            <span className="text-xs text-gray-400">%</span>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={a.isExternal}
                onChange={e => {
                  const v = [...form.allocations]
                  v[i] = { ...v[i], isExternal: e.target.checked }
                  setForm(f => ({ ...f, allocations: v }))
                }} />
              타지사
            </label>
            {i > 0 && (
              <button
                onClick={() => setForm(f => ({ ...f, allocations: f.allocations.filter((_,j) => j !== i) }))}
                className="text-gray-300 hover:text-red-400 text-xs"
              >✕</button>
            )}
            {form.grossAmount > 0 && a.ratio > 0 && (
              <span className="text-xs text-green-600">
                → {fmt(incentiveAmount(form.grossAmount, a.ratio))}원
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">취소</button>
        <button
          onClick={handleSave}
          disabled={saving || !form.victimName}
          className="px-3 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
