'use client'

import { useState, useEffect, useCallback } from 'react'
import { CASE_TYPES, QUARTER_MONTHS, CaseTypeId } from '../_constants/performance'

// ─── 타입 ────────────────────────────────────────────────────────
interface SalesRow {
  id?: string
  staffName: string
  [key: string]: number | string | undefined
}

interface AllocationRow {
  staffName: string
  ratio: number
  isExternal: boolean
}

interface SettlementRow {
  id?: string
  paymentDate: string
  victimName: string
  caseType: string
  tfName: string
  salesStaffName: string
  settlementStaffName: string
  grossAmount: number
  deduction: number
  memo: string
  allocations: AllocationRow[]
  _editing?: boolean
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

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function PerformanceTab() {
  const currentYear = new Date().getFullYear()
  const [subTab, setSubTab] = useState<'sales' | 'settlement'>('sales')

  // ── 공통 필터
  const [year, setYear]       = useState(currentYear)
  const [quarter, setQuarter] = useState<number | null>(null)
  const [month, setMonth]     = useState<number | null>(null)
  const [branch, setBranch]   = useState('울산지사')

  // ── 영업 약정건수 상태
  const [salesRows, setSalesRows]     = useState<SalesRow[]>([])
  const [salesDirty, setSalesDirty]   = useState(false)
  const [salesSaving, setSalesSaving] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')

  // ── 정산내역 상태
  const [settlements, setSettlements]         = useState<SettlementRow[]>([])
  const [showAddForm, setShowAddForm]         = useState(false)
  const [importing, setImporting]             = useState(false)
  const [importPreview, setImportPreview]     = useState<SettlementRow[] | null>(null)

  // ── 보기 모드 (월별 / 분기 합계)
  const viewMonths = (() => {
    if (month) return [month]
    if (quarter) return [...QUARTER_MONTHS[quarter]]
    return [1,2,3,4,5,6,7,8,9,10,11,12]
  })()

  // ─────────────────────────────────────────────────────────────
  // 영업 약정건수 로드
  const loadSales = useCallback(async () => {
    const qs = new URLSearchParams({ year: String(year), branchName: branch })
    if (quarter) qs.set('quarter', String(quarter))
    if (month) qs.set('month', String(month))
    const res = await fetch(`/api/branch/sales-contracts?${qs}`)
    if (!res.ok) return
    const data: { staffName: string; month: number; [k: string]: unknown }[] = await res.json()

    const staffSet = new Set(data.map(r => r.staffName))
    const rows: SalesRow[] = []
    for (const staff of staffSet) {
      const row: SalesRow = { staffName: staff }
      for (const m of viewMonths) {
        const rec = data.find(r => r.staffName === staff && r.month === m)
        for (const ct of CASE_TYPES) {
          const key = `${ct.id}_${m}`
          row[key] = (rec?.[ct.id] as number) || 0
        }
      }
      rows.push(row)
    }
    setSalesRows(rows)
    setSalesDirty(false)
  }, [year, quarter, month, branch])

  useEffect(() => { if (subTab === 'sales') loadSales() }, [subTab, loadSales])

  // 영업 약정건수 저장
  async function saveSales() {
    setSalesSaving(true)
    try {
      const saves: Promise<unknown>[] = []
      for (const row of salesRows) {
        for (const m of viewMonths) {
          const payload: Record<string, unknown> = {
            branchName: branch,
            staffName: row.staffName,
            year,
            month: m,
          }
          for (const ct of CASE_TYPES) {
            payload[ct.id] = (row[`${ct.id}_${m}`] as number) || 0
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

  function addStaff() {
    const name = newStaffName.trim()
    if (!name || salesRows.find(r => r.staffName === name)) return
    const row: SalesRow = { staffName: name }
    for (const m of viewMonths) {
      for (const ct of CASE_TYPES) {
        row[`${ct.id}_${m}`] = 0
      }
    }
    setSalesRows(prev => [...prev, row])
    setNewStaffName('')
    setSalesDirty(true)
  }

  function staffMonthTotal(row: SalesRow, m: number) {
    return CASE_TYPES.reduce((s, ct) => s + ((row[`${ct.id}_${m}`] as number) || 0), 0)
  }
  function staffTotal(row: SalesRow) {
    return viewMonths.reduce((s, m) => s + staffMonthTotal(row, m), 0)
  }

  // ─────────────────────────────────────────────────────────────
  // 정산내역 로드
  const loadSettlements = useCallback(async () => {
    const qs = new URLSearchParams({ year: String(year), branchName: branch })
    if (month) qs.set('month', String(month))
    const res = await fetch(`/api/branch/settlement-records?${qs}`)
    if (!res.ok) return
    const data = await res.json()
    setSettlements(data.map((r: SettlementRow) => ({ ...r, _editing: false })))
  }, [year, month, branch])

  useEffect(() => { if (subTab === 'settlement') loadSettlements() }, [subTab, loadSettlements])

  // 성공보수 엑셀 임포트
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/branch/settlement-records/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setImportPreview(
        data.rows.map((r: Partial<SettlementRow>) => ({
          paymentDate: r.paymentDate || '',
          victimName: r.victimName || '',
          caseType: r.caseType || '',
          tfName: r.tfName || '',
          salesStaffName: r.salesStaffName || '',
          settlementStaffName: r.settlementStaffName || '',
          grossAmount: r.grossAmount || 0,
          deduction: 0,
          memo: '',
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
    if (!importPreview) return
    const filteredByMonth = month
      ? importPreview.filter(r => r.paymentDate && parseInt(r.paymentDate.slice(5, 7)) === month)
      : importPreview

    for (const row of filteredByMonth) {
      const rowMonth = row.paymentDate ? parseInt(row.paymentDate.slice(5, 7)) : month || 1
      const rowYear  = row.paymentDate ? parseInt(row.paymentDate.slice(0, 4)) : year
      await fetch('/api/branch/settlement-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row, branchName: branch, year: rowYear, month: rowMonth }),
      })
    }
    setImportPreview(null)
    await loadSettlements()
  }

  async function deleteSettlement(id: string) {
    if (!confirm('이 건을 삭제하시겠습니까?')) return
    await fetch(`/api/branch/settlement-records/${id}`, { method: 'DELETE' })
    await loadSettlements()
  }

  // 담당자별 집계
  const staffSummary: Record<string, { count: number; totalNet: number; totalIncentive: number }> = {}
  for (const s of settlements) {
    const net = netAmount(s.grossAmount) - s.deduction
    for (const a of s.allocations) {
      if (!staffSummary[a.staffName]) staffSummary[a.staffName] = { count: 0, totalNet: 0, totalIncentive: 0 }
      staffSummary[a.staffName].count += 1
      staffSummary[a.staffName].totalNet += Math.floor(net * a.ratio / 100)
      staffSummary[a.staffName].totalIncentive += incentiveAmount(s.grossAmount - s.deduction * 1.1, a.ratio)
    }
  }

  // 필터 기준 월별 필터링 (정산내역)
  const filteredSettlements = settlements.filter(s => {
    const m = s.paymentDate ? parseInt(s.paymentDate.slice(5, 7)) : null
    if (month && m !== month) return false
    if (quarter && m) {
      const qMonths = QUARTER_MONTHS[quarter]
      if (!qMonths.includes(m as 1|2|3|4|5|6|7|8|9|10|11|12)) return false
    }
    return true
  })

  // ─── 렌더 ─────────────────────────────────────────────────────
  const cellCls = 'border border-gray-200 px-2 py-1 text-sm'
  const thCls   = `${cellCls} bg-gray-50 font-medium text-center`

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

        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
          <button key={m}
            onClick={() => { setMonth(month === m ? null : m); setQuarter(null) }}
            className={`w-8 py-1 text-xs rounded border transition-colors ${
              month === m ? 'bg-teal-500 text-white border-teal-500'
                : (quarter && QUARTER_MONTHS[quarter].includes(m as 1|2|3|4|5|6|7|8|9|10|11|12))
                  ? 'bg-sky-50 border-sky-300 text-sky-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {m}
          </button>
        ))}

        <span className="text-gray-300">|</span>
        <select
          value={branch}
          onChange={e => setBranch(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {['울산지사','부산경남지사','서울북부지사','경기안산지사','전북익산지사',
            '경북구미지사','경기의정부지사','강원동해지사','전남여수지사','대구지사',
            '부산중부지사','경기수원지사'].map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* ── 서브탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setSubTab('sales')}
          className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
            subTab === 'sales' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          영업 약정건수
        </button>
        <button
          onClick={() => setSubTab('settlement')}
          className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
            subTab === 'settlement' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          정산내역
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          서브탭 A: 영업 약정건수
      ══════════════════════════════════════════════ */}
      {subTab === 'sales' && (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr>
                  <th className={`${thCls} sticky left-0 z-10 bg-gray-50 w-24`}>성명</th>
                  {viewMonths.map(m => (
                    CASE_TYPES.map(ct => (
                      <th key={`${m}_${ct.id}`} className={thCls}>
                        {viewMonths.length > 1 ? `${m}월 ` : ''}{ct.label}
                      </th>
                    ))
                  ))}
                  {viewMonths.map(m => (
                    <th key={`total_${m}`} className={`${thCls} bg-sky-50 text-sky-700`}>
                      {viewMonths.length > 1 ? `${m}월` : ''} 합계
                    </th>
                  ))}
                  {viewMonths.length > 1 && (
                    <th className={`${thCls} bg-sky-100 text-sky-800`}>전체 합계</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row, ri) => (
                  <tr key={row.staffName} className="hover:bg-gray-50">
                    <td className={`${cellCls} sticky left-0 bg-white font-medium`}>{row.staffName}</td>
                    {viewMonths.map(m =>
                      CASE_TYPES.map(ct => {
                        const key = `${ct.id}_${m}`
                        return (
                          <td key={key} className={cellCls}>
                            <input
                              type="number" min={0} step={0.5}
                              value={(row[key] as number) || ''}
                              placeholder="0"
                              className="w-10 text-center bg-transparent outline-none"
                              onChange={e => {
                                const v = [...salesRows]
                                v[ri] = { ...v[ri], [key]: parseFloat(e.target.value) || 0 }
                                setSalesRows(v)
                                setSalesDirty(true)
                              }}
                            />
                          </td>
                        )
                      })
                    )}
                    {viewMonths.map(m => (
                      <td key={`t_${m}`} className={`${cellCls} text-center font-medium text-sky-700 bg-sky-50`}>
                        {staffMonthTotal(row, m) || ''}
                      </td>
                    ))}
                    {viewMonths.length > 1 && (
                      <td className={`${cellCls} text-center font-bold text-sky-800 bg-sky-100`}>
                        {staffTotal(row) || ''}
                      </td>
                    )}
                  </tr>
                ))}

                {/* 상병별 합계 행 */}
                <tr className="bg-gray-50 font-medium">
                  <td className={`${cellCls} sticky left-0 bg-gray-50 text-xs text-gray-500`}>합계</td>
                  {viewMonths.map(m =>
                    CASE_TYPES.map(ct => {
                      const key = `${ct.id}_${m}`
                      const total = salesRows.reduce((s, r) => s + ((r[key] as number) || 0), 0)
                      return (
                        <td key={key} className={`${cellCls} text-center text-xs`}>{total || ''}</td>
                      )
                    })
                  )}
                  {viewMonths.map(m => {
                    const total = salesRows.reduce((s, r) => s + staffMonthTotal(r, m), 0)
                    return (
                      <td key={`t_${m}`} className={`${cellCls} text-center font-bold text-sky-700 bg-sky-50`}>
                        {total || ''}
                      </td>
                    )
                  })}
                  {viewMonths.length > 1 && (
                    <td className={`${cellCls} text-center font-bold text-sky-800 bg-sky-100`}>
                      {salesRows.reduce((s, r) => s + staffTotal(r), 0) || ''}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 직원 추가 + 저장 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                className="border border-gray-300 rounded px-2 py-1 text-sm w-28"
                placeholder="직원명 추가"
                value={newStaffName}
                onChange={e => setNewStaffName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addStaff()}
              />
              <button onClick={addStaff} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
                + 추가
              </button>
            </div>
            <button
              onClick={saveSales}
              disabled={!salesDirty || salesSaving}
              className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                salesDirty && !salesSaving
                  ? 'bg-sky-500 text-white hover:bg-sky-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {salesSaving ? '저장 중...' : salesDirty ? '저장' : '저장됨'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          서브탭 B: 정산내역
      ══════════════════════════════════════════════ */}
      {subTab === 'settlement' && (
        <div className="space-y-4">

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
                  {importPreview.length}건 파싱 완료 — 확인 후 저장하세요
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setImportPreview(null)} className="px-3 py-1 text-xs border rounded">취소</button>
                  <button onClick={confirmImport} className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600">
                    전체 저장
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-100">
                      {['입금일','재해자','사건종류','TF','영업담당','정산담당','입금액'].map(h => (
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
              month={month || new Date().getMonth() + 1}
              onSave={async (row) => {
                await fetch('/api/branch/settlement-records', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...row, branchName: branch }),
                })
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
                  {['#','입금일','재해자','사건종류','TF','영업담당','정산담당',
                    '입금액','부가세제외','공제','인센 대상액','배분내역',''].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSettlements.map((row, i) => {
                  const net = netAmount(row.grossAmount) - row.deduction
                  return (
                    <tr key={row.id ?? i} className="hover:bg-gray-50">
                      <td className={`${cellCls} text-center text-gray-400`}>{i+1}</td>
                      <td className={cellCls}>{row.paymentDate?.slice(0,10)}</td>
                      <td className={cellCls}>{row.victimName}</td>
                      <td className={cellCls}>{row.caseType}</td>
                      <td className={cellCls}>{row.tfName}</td>
                      <td className={cellCls}>{row.salesStaffName}</td>
                      <td className={cellCls}>{row.settlementStaffName}</td>
                      <td className={`${cellCls} text-right`}>{fmt(row.grossAmount)}</td>
                      <td className={`${cellCls} text-right`}>{fmt(netAmount(row.grossAmount))}</td>
                      <td className={`${cellCls} text-right text-orange-600`}>{row.deduction ? fmt(row.deduction) : ''}</td>
                      <td className={`${cellCls} text-right font-medium text-sky-700`}>{fmt(net)}</td>
                      <td className={`${cellCls} max-w-40`}>
                        {row.allocations.map((a, ai) => (
                          <div key={ai} className="text-xs text-gray-600">
                            {a.staffName} {a.ratio}%
                            {a.isExternal && <span className="ml-1 text-amber-500">(타지사)</span>}
                            <span className="ml-1 text-green-600">
                              +{fmt(incentiveAmount(row.grossAmount, a.ratio))}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className={cellCls}>
                        {row.id && (
                          <button
                            onClick={() => deleteSettlement(row.id!)}
                            className="text-gray-300 hover:text-red-400 text-xs"
                          >✕</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredSettlements.length === 0 && (
                  <tr>
                    <td colSpan={13} className={`${cellCls} text-center text-gray-400 py-6`}>
                      데이터 없음 — 엑셀 업로드 또는 직접 추가
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSettlements.length > 0 && (
                <tfoot>
                  <tr className="bg-sky-50 font-medium">
                    <td colSpan={7} className={`${cellCls} text-center text-sky-700`}>
                      합계 ({filteredSettlements.length}건)
                    </td>
                    <td className={`${cellCls} text-right text-sky-700`}>
                      {fmt(filteredSettlements.reduce((s, r) => s + r.grossAmount, 0))}
                    </td>
                    <td className={`${cellCls} text-right text-sky-700`}>
                      {fmt(filteredSettlements.reduce((s, r) => s + netAmount(r.grossAmount), 0))}
                    </td>
                    <td colSpan={4} className={cellCls} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* 담당자별 집계 */}
          {Object.keys(staffSummary).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">담당자별 집계</h4>
              <div className="overflow-x-auto">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {['담당자','정산 건수','인센 대상액 합계','인센티브 합계(10%)'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(staffSummary)
                      .sort((a, b) => b[1].totalIncentive - a[1].totalIncentive)
                      .map(([name, stat]) => (
                        <tr key={name} className="hover:bg-gray-50">
                          <td className={`${cellCls} font-medium`}>{name}</td>
                          <td className={`${cellCls} text-center`}>{stat.count}</td>
                          <td className={`${cellCls} text-right`}>{fmt(stat.totalNet)}</td>
                          <td className={`${cellCls} text-right font-medium text-green-700`}>
                            {fmt(stat.totalIncentive)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 직접 추가 폼 컴포넌트 ────────────────────────────────────────
function AddSettlementForm({
  branchName, year, month,
  onSave, onCancel,
}: {
  branchName: string
  year: number
  month: number
  onSave: (row: SettlementRow) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<SettlementRow>({
    paymentDate: '',
    victimName: '',
    caseType: '',
    tfName: '',
    salesStaffName: '',
    settlementStaffName: '',
    grossAmount: 0,
    deduction: 0,
    memo: '',
    allocations: [{ staffName: '', ratio: 100, isExternal: false }],
  })
  const [saving, setSaving] = useState(false)

  function setField(k: keyof SettlementRow, v: unknown) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function setAlloc(i: number, k: keyof AllocationRow, v: unknown) {
    const a = [...form.allocations]
    a[i] = { ...a[i], [k]: v }
    setForm(f => ({ ...f, allocations: a }))
  }

  const totalRatio = form.allocations.reduce((s, a) => s + (a.ratio || 0), 0)

  async function handleSave() {
    if (!form.victimName) return
    setSaving(true)
    const rowMonth = form.paymentDate ? parseInt(form.paymentDate.slice(5, 7)) : month
    const rowYear  = form.paymentDate ? parseInt(form.paymentDate.slice(0, 4)) : year
    try {
      await onSave({ ...form, year: rowYear, month: rowMonth } as SettlementRow)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-sky-400'

  return (
    <div className="border border-sky-200 bg-sky-50 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {([
          ['입금일자', 'paymentDate', 'date'],
          ['재해자명', 'victimName', 'text'],
          ['사건종류', 'caseType', 'text'],
          ['TF', 'tfName', 'text'],
          ['영업담당자', 'salesStaffName', 'text'],
          ['정산담당자', 'settlementStaffName', 'text'],
          ['입금액', 'grossAmount', 'number'],
          ['공제', 'deduction', 'number'],
        ] as [string, keyof SettlementRow, string][]).map(([label, key, type]) => (
          <div key={key as string}>
            <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
            <input
              type={type}
              value={form[key] as string | number}
              onChange={e => setField(key, type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {/* 배분 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500 font-medium">인센티브 배분 (합계: {totalRatio}%)</label>
          <button
            onClick={() => setForm(f => ({ ...f, allocations: [...f.allocations, { staffName: '', ratio: 0, isExternal: false }] }))}
            className="text-xs text-sky-600 underline"
          >+ 배분 추가</button>
        </div>
        {form.allocations.map((a, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input
              className="border border-gray-300 rounded px-2 py-1 text-xs w-24"
              placeholder="담당자명"
              value={a.staffName}
              onChange={e => setAlloc(i, 'staffName', e.target.value)}
            />
            <input
              type="number" min={0} max={100}
              className="border border-gray-300 rounded px-2 py-1 text-xs w-16 text-center"
              value={a.ratio}
              onChange={e => setAlloc(i, 'ratio', parseInt(e.target.value) || 0)}
            />
            <span className="text-xs text-gray-400">%</span>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={a.isExternal}
                onChange={e => setAlloc(i, 'isExternal', e.target.checked)} />
              타지사
            </label>
            {i > 0 && (
              <button
                onClick={() => setForm(f => ({ ...f, allocations: f.allocations.filter((_, j) => j !== i) }))}
                className="text-gray-300 hover:text-red-400 text-xs"
              >✕</button>
            )}
            {form.grossAmount > 0 && a.ratio > 0 && (
              <span className="text-xs text-green-600 ml-1">
                인센 {fmt(incentiveAmount(form.grossAmount, a.ratio))}원
              </span>
            )}
          </div>
        ))}
        {totalRatio !== 100 && (
          <p className="text-xs text-orange-500 mt-1">⚠ 배분 합계가 100%가 아닙니다 ({totalRatio}%)</p>
        )}
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
