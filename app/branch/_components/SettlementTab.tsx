'use client'

import { useState, useEffect, useCallback } from 'react'

const BRANCH_LIST = [
  '울산지사',
  '부산경남지사',
  '서울북부지사',
  '경기안산지사',
  '전북익산지사',
  '경북구미지사',
  '경기의정부지사',
  '강원동해지사',
  '전남여수지사',
  '대구지사',
  '부산중부지사',
  '경기수원지사',
]

// ─── 타입 ───────────────────────────────────────────────────────
interface BranchMonthData {
  month: number
  revenue: number
  cost: number
  memo: string
}

interface BranchFinancialData {
  branchName: string
  months: BranchMonthData[]
}

interface OutdoorRow {
  userId: string
  userName: string
  months: { month: number; contractCount: number; settlementAmount: number }[]
}

interface IndoorRow {
  userId: string
  userName: string
  month: number
  docSentCount: number
  docReceivedCount: number
  caseRegisteredCount: number
  tfManagedCount: number
  adminTaskDone: boolean
  memo: string
}

// ─── 유틸 ────────────────────────────────────────────────────────
const QUARTER_MONTHS: Record<number, [number, number, number]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
}

function formatAmount(v: number) {
  if (!v) return ''
  return v.toLocaleString('ko-KR')
}

function parseAmount(s: string) {
  return parseInt(s.replace(/,/g, '').replace(/[^0-9]/g, '')) || 0
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────
export default function SettlementTab() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(1)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const months = QUARTER_MONTHS[quarter]

  // ── 매출·비용 상태
  const [branchFinancials, setBranchFinancials] = useState<BranchFinancialData[]>([])
  const [addingBranch, setAddingBranch] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('')

  // ── 외근직 상태
  const [outdoorRows, setOutdoorRows] = useState<OutdoorRow[]>([])

  // ── 내근직 상태
  const [indoorRows, setIndoorRows] = useState<IndoorRow[]>([])

  // ── 로드
  const loadData = useCallback(async () => {
    const qs = `year=${year}&quarter=${quarter}`
    const [fin, out, ind] = await Promise.all([
      fetch(`/api/branch/financial?${qs}`).then(r => r.json()),
      fetch(`/api/branch/outdoor-performance?${qs}`).then(r => r.json()),
      fetch(`/api/branch/indoor-workload?${qs}`).then(r => r.json()),
    ])

    // 매출비용 — 지사별 그룹
    const branchMap: Record<string, BranchFinancialData> = {}
    for (const r of fin) {
      const key = r.branchName ?? '전사'
      if (!branchMap[key]) {
        branchMap[key] = {
          branchName: key,
          months: months.map(m => ({ month: m, revenue: 0, cost: 0, memo: '' })),
        }
      }
      const idx = months.indexOf(r.month)
      if (idx >= 0) {
        branchMap[key].months[idx] = { month: r.month, revenue: r.revenue, cost: r.cost, memo: r.memo ?? '' }
      }
    }
    setBranchFinancials(Object.values(branchMap))

    // 외근직 — userId별 그룹
    const userMap: Record<string, OutdoorRow> = {}
    for (const r of out) {
      if (!userMap[r.userId]) {
        userMap[r.userId] = {
          userId: r.userId,
          userName: r.user.name,
          months: months.map(m => ({ month: m, contractCount: 0, settlementAmount: 0 })),
        }
      }
      const idx = months.indexOf(r.month)
      if (idx >= 0) userMap[r.userId].months[idx] = { month: r.month, contractCount: r.contractCount, settlementAmount: r.settlementAmount }
    }
    setOutdoorRows(Object.values(userMap))

    // 내근직 — userId+month별
    const indMap: Record<string, IndoorRow> = {}
    for (const r of ind) {
      indMap[`${r.userId}_${r.month}`] = {
        userId: r.userId,
        userName: r.user.name,
        month: r.month,
        docSentCount: r.docSentCount,
        docReceivedCount: r.docReceivedCount,
        caseRegisteredCount: r.caseRegisteredCount,
        tfManagedCount: r.tfManagedCount,
        adminTaskDone: r.adminTaskDone,
        memo: r.memo ?? '',
      }
    }
    setIndoorRows(Object.values(indMap))
    setDirty(false)
  }, [year, quarter])

  useEffect(() => { loadData() }, [loadData])

  // ── 저장
  async function handleSave() {
    setSaving(true)
    try {
      const saves: Promise<unknown>[] = []

      // 매출비용 — 지사별
      for (const branch of branchFinancials) {
        for (const row of branch.months) {
          saves.push(fetch('/api/branch/financial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              year,
              month: row.month,
              branchName: branch.branchName === '전사' ? null : branch.branchName,
              revenue: row.revenue,
              cost: row.cost,
              memo: row.memo,
            }),
          }))
        }
      }

      // 외근직
      for (const row of outdoorRows) {
        for (const m of row.months) {
          saves.push(fetch('/api/branch/outdoor-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: row.userId, year, month: m.month, contractCount: m.contractCount, settlementAmount: m.settlementAmount }),
          }))
        }
      }

      // 내근직
      for (const row of indoorRows) {
        saves.push(fetch('/api/branch/indoor-workload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: row.userId, year, month: row.month,
            docSentCount: row.docSentCount, docReceivedCount: row.docReceivedCount,
            caseRegisteredCount: row.caseRegisteredCount, tfManagedCount: row.tfManagedCount,
            adminTaskDone: row.adminTaskDone, memo: row.memo,
          }),
        }))
      }

      await Promise.all(saves)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  // ── 외근직 행 추가
  const [addingOutdoor, setAddingOutdoor] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAllUsers(data)
    })
  }, [])

  function addOutdoorRow() {
    if (!newUserId) return
    if (outdoorRows.find(r => r.userId === newUserId)) { setAddingOutdoor(false); return }
    setOutdoorRows(prev => [...prev, {
      userId: newUserId,
      userName: newUserName,
      months: months.map(m => ({ month: m, contractCount: 0, settlementAmount: 0 })),
    }])
    setNewUserId(''); setNewUserName(''); setAddingOutdoor(false); setDirty(true)
  }

  // ── 파생 합계
  const branchTotals = branchFinancials.map(b => ({
    branchName: b.branchName,
    revenue: b.months.reduce((s, m) => s + m.revenue, 0),
    cost: b.months.reduce((s, m) => s + m.cost, 0),
  }))

  const monthTotals = months.map(month => ({
    month,
    revenue: branchFinancials.reduce((s, b) => {
      const m = b.months.find(m => m.month === month)
      return s + (m?.revenue ?? 0)
    }, 0),
    cost: branchFinancials.reduce((s, b) => {
      const m = b.months.find(m => m.month === month)
      return s + (m?.cost ?? 0)
    }, 0),
  }))

  const totalRevenue = branchTotals.reduce((s, b) => s + b.revenue, 0)
  const totalCost = branchTotals.reduce((s, b) => s + b.cost, 0)
  const totalProfit = totalRevenue - totalCost

  // ─── 렌더
  const cellCls = 'border border-gray-200 px-2 py-1 text-sm'
  const inputCls = 'w-full text-right text-sm bg-transparent outline-none'

  return (
    <div className="space-y-6 p-4">
      {/* 연도·분기 선택 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500">기준연도</span>
        <input
          type="number" value={year} min={2020} max={2099}
          onChange={e => { setYear(parseInt(e.target.value)); setDirty(false) }}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
        />
        <span className="text-sm text-gray-500 ml-2">분기</span>
        {[1, 2, 3, 4].map(q => (
          <button key={q}
            onClick={() => { setQuarter(q); setDirty(false) }}
            className={`px-3 py-1 text-sm rounded border ${quarter === q ? 'bg-sky-500 text-white border-sky-500' : 'border-gray-300 text-gray-600 hover:border-sky-400'}`}
          >
            {q}분기
          </button>
        ))}
      </div>

      {/* ── 섹션1: 매출·비용 ── */}
      <section>
        <h3 className="text-sm font-medium text-sky-700 mb-2 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-sky-500" />
          매출·비용 현황
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#29ABE2] text-white">
                <th className={`${cellCls} text-left w-28`}>지사</th>
                <th className={`${cellCls} text-left w-16`}>항목</th>
                {months.map(m => (
                  <th key={m} className={`${cellCls} text-right w-32`}>{m}월</th>
                ))}
                <th className={`${cellCls} text-right w-36 bg-sky-50`}>지사 합계</th>
                <th className={`${cellCls} w-8`} />
              </tr>
            </thead>
            <tbody>
              {branchFinancials.map((branch, bi) => (
                <>
                  {/* 매출 행 */}
                  <tr key={`${branch.branchName}_rev`}>
                    <td className={`${cellCls} font-medium`} rowSpan={3}>
                      <div className="flex items-center gap-1">
                        <span>{branch.branchName}</span>
                      </div>
                    </td>
                    <td className={`${cellCls} text-gray-500 text-xs`}>매출</td>
                    {branch.months.map((m, mi) => (
                      <td key={m.month} className={cellCls}>
                        <input
                          className={inputCls}
                          value={m.revenue ? formatAmount(m.revenue) : ''}
                          placeholder="0"
                          onChange={e => {
                            const v = [...branchFinancials]
                            v[bi].months[mi] = { ...m, revenue: parseAmount(e.target.value) }
                            setBranchFinancials(v); setDirty(true)
                          }}
                        />
                      </td>
                    ))}
                    <td className={`${cellCls} text-right font-medium text-sky-700 bg-sky-50`}>
                      {formatAmount(branchTotals[bi]?.revenue ?? 0)}
                    </td>
                    <td className={`${cellCls} text-center`} rowSpan={3}>
                      <button
                        onClick={() => {
                          setBranchFinancials(prev => prev.filter((_, i) => i !== bi))
                          setDirty(true)
                        }}
                        className="text-gray-300 hover:text-red-400 text-xs leading-none"
                        title="지사 삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                  {/* 비용 행 */}
                  <tr key={`${branch.branchName}_cost`}>
                    <td className={`${cellCls} text-gray-500 text-xs`}>비용</td>
                    {branch.months.map((m, mi) => (
                      <td key={m.month} className={cellCls}>
                        <input
                          className={inputCls}
                          value={m.cost ? formatAmount(m.cost) : ''}
                          placeholder="0"
                          onChange={e => {
                            const v = [...branchFinancials]
                            v[bi].months[mi] = { ...m, cost: parseAmount(e.target.value) }
                            setBranchFinancials(v); setDirty(true)
                          }}
                        />
                      </td>
                    ))}
                    <td className={`${cellCls} text-right font-medium text-orange-600 bg-orange-50`}>
                      {formatAmount(branchTotals[bi]?.cost ?? 0)}
                    </td>
                  </tr>
                  {/* 순이익 행 */}
                  <tr key={`${branch.branchName}_profit`} className="bg-gray-50">
                    <td className={`${cellCls} text-gray-500 text-xs`}>순이익</td>
                    {branch.months.map(m => {
                      const p = m.revenue - m.cost
                      return (
                        <td key={m.month} className={`${cellCls} text-right text-xs font-medium ${p > 0 ? 'text-green-600' : p < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {p !== 0 ? formatAmount(p) : ''}
                        </td>
                      )
                    })}
                    <td className={`${cellCls} text-right text-xs font-bold ${
                      (branchTotals[bi]?.revenue ?? 0) - (branchTotals[bi]?.cost ?? 0) >= 0
                        ? 'text-green-600 bg-green-50'
                        : 'text-red-500 bg-red-50'
                    }`}>
                      {formatAmount((branchTotals[bi]?.revenue ?? 0) - (branchTotals[bi]?.cost ?? 0))}
                    </td>
                  </tr>
                  {/* 지사 간 구분선 */}
                  <tr key={`${branch.branchName}_divider`}>
                    <td colSpan={months.length + 3} className="py-0">
                      <div className="h-px bg-gray-200" />
                    </td>
                  </tr>
                </>
              ))}

              {/* 전사 합산 행 */}
              {branchFinancials.length > 1 && (
                <>
                  <tr className="bg-sky-50 font-medium">
                    <td className={`${cellCls} text-sky-700`} colSpan={1}>전사 합계</td>
                    <td className={`${cellCls} text-gray-500 text-xs`}>매출</td>
                    {monthTotals.map(m => (
                      <td key={m.month} className={`${cellCls} text-right text-sky-700`}>
                        {m.revenue ? formatAmount(m.revenue) : ''}
                      </td>
                    ))}
                    <td className={`${cellCls} text-right font-bold text-sky-700 bg-sky-100`}>
                      {formatAmount(totalRevenue)}
                    </td>
                    <td className={cellCls} />
                  </tr>
                  <tr className="bg-orange-50 font-medium">
                    <td className={cellCls} />
                    <td className={`${cellCls} text-gray-500 text-xs`}>비용</td>
                    {monthTotals.map(m => (
                      <td key={m.month} className={`${cellCls} text-right text-orange-600`}>
                        {m.cost ? formatAmount(m.cost) : ''}
                      </td>
                    ))}
                    <td className={`${cellCls} text-right font-bold text-orange-600 bg-orange-100`}>
                      {formatAmount(totalCost)}
                    </td>
                    <td className={cellCls} />
                  </tr>
                  <tr className="bg-green-50 font-medium">
                    <td className={cellCls} />
                    <td className={`${cellCls} text-gray-500 text-xs`}>순이익</td>
                    {monthTotals.map(m => {
                      const p = m.revenue - m.cost
                      return (
                        <td key={m.month} className={`${cellCls} text-right text-xs font-medium ${p > 0 ? 'text-green-700' : p < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {p !== 0 ? formatAmount(p) : ''}
                        </td>
                      )
                    })}
                    <td className={`${cellCls} text-right font-bold ${totalProfit >= 0 ? 'text-green-700 bg-green-100' : 'text-red-600 bg-red-50'}`}>
                      {formatAmount(totalProfit)}
                    </td>
                    <td className={cellCls} />
                  </tr>
                </>
              )}

              {/* 데이터 없음 */}
              {branchFinancials.length === 0 && (
                <tr>
                  <td colSpan={months.length + 3} className={`${cellCls} text-center text-gray-400 py-6`}>
                    지사를 추가하여 매출·비용을 입력하세요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 지사 추가 */}
        <div className="mt-2">
          {!addingBranch ? (
            <button
              onClick={() => setAddingBranch(true)}
              className="text-sm text-sky-600 hover:text-sky-800 underline"
            >
              + 지사 추가
            </button>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
              >
                <option value="">지사 선택</option>
                {BRANCH_LIST.filter(b => !branchFinancials.find(r => r.branchName === b)).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!selectedBranch) return
                  setBranchFinancials(prev => [...prev, {
                    branchName: selectedBranch,
                    months: months.map(m => ({ month: m, revenue: 0, cost: 0, memo: '' })),
                  }])
                  setSelectedBranch(''); setAddingBranch(false); setDirty(true)
                }}
                className="px-3 py-1 text-sm bg-sky-500 text-white rounded hover:bg-sky-600"
              >
                추가
              </button>
              <button
                onClick={() => { setSelectedBranch(''); setAddingBranch(false) }}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 섹션2: 외근직 실적 ── */}
      <section>
        <h3 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          외근직 실적
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#29ABE2] text-white">
                <th className={`${cellCls} text-left w-24`}>성명</th>
                {months.flatMap(m => [
                  <th key={`${m}-c`} className={`${cellCls} text-right w-20`}>{m}월 약정</th>,
                  <th key={`${m}-s`} className={`${cellCls} text-right w-24`}>{m}월 정산(원)</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {outdoorRows.map((row, ri) => (
                <tr key={row.userId}>
                  <td className={`${cellCls} font-medium`}>{row.userName}</td>
                  {row.months.map((m, mi) => (
                    <>
                      <td key={`c_${m.month}`} className={cellCls}>
                        <input className={inputCls}
                          value={m.contractCount || ''}
                          placeholder="0"
                          type="number" min={0}
                          onChange={e => {
                            const v = [...outdoorRows]
                            v[ri].months[mi] = { ...m, contractCount: parseInt(e.target.value) || 0 }
                            setOutdoorRows(v); setDirty(true)
                          }}
                        />
                      </td>
                      <td key={`s_${m.month}`} className={cellCls}>
                        <input className={inputCls}
                          value={m.settlementAmount ? formatAmount(m.settlementAmount) : ''}
                          placeholder="0"
                          onChange={e => {
                            const v = [...outdoorRows]
                            v[ri].months[mi] = { ...m, settlementAmount: parseAmount(e.target.value) }
                            setOutdoorRows(v); setDirty(true)
                          }}
                        />
                      </td>
                    </>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 직원 추가 */}
        {!addingOutdoor ? (
          <button onClick={() => setAddingOutdoor(true)}
            className="mt-2 text-sm text-sky-600 hover:text-sky-800 underline">
            + 직원 추가
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <select className="border border-gray-300 rounded px-2 py-1 text-sm"
              value={newUserId}
              onChange={e => {
                const u = allUsers.find(u => u.id === e.target.value)
                setNewUserId(e.target.value)
                setNewUserName(u?.name ?? '')
              }}>
              <option value="">직원 선택</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={addOutdoorRow} className="px-3 py-1 text-sm bg-sky-500 text-white rounded hover:bg-sky-600">추가</button>
            <button onClick={() => setAddingOutdoor(false)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">취소</button>
          </div>
        )}
      </section>

      {/* ── 섹션3: 내근직 업무부하 ── */}
      <section>
        <h3 className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
          내근직 업무부하
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#29ABE2] text-white">
                <th className={`${cellCls} text-left`}>성명</th>
                <th className={`${cellCls} text-center`}>월</th>
                <th className={`${cellCls} text-right`}>문서 발신</th>
                <th className={`${cellCls} text-right`}>문서 수신</th>
                <th className={`${cellCls} text-right`}>접수건수</th>
                <th className={`${cellCls} text-right`}>담당TF수</th>
                <th className={`${cellCls} text-center`}>관리업무</th>
                <th className={`${cellCls} text-left`}>메모</th>
              </tr>
            </thead>
            <tbody>
              {indoorRows.map((row, ri) => (
                <tr key={`${row.userId}_${row.month}`}>
                  <td className={`${cellCls} font-medium`}>{row.userName}</td>
                  <td className={`${cellCls} text-center text-gray-500`}>{row.month}월</td>
                  {(['docSentCount', 'docReceivedCount', 'caseRegisteredCount', 'tfManagedCount'] as const).map(field => (
                    <td key={field} className={cellCls}>
                      <input className={inputCls} type="number" min={0}
                        value={row[field] || ''}
                        placeholder="0"
                        onChange={e => {
                          const v = [...indoorRows]
                          v[ri] = { ...v[ri], [field]: parseInt(e.target.value) || 0 }
                          setIndoorRows(v); setDirty(true)
                        }}
                      />
                    </td>
                  ))}
                  <td className={`${cellCls} text-center`}>
                    <input type="checkbox" checked={row.adminTaskDone}
                      onChange={e => {
                        const v = [...indoorRows]
                        v[ri] = { ...v[ri], adminTaskDone: e.target.checked }
                        setIndoorRows(v); setDirty(true)
                      }}
                    />
                  </td>
                  <td className={cellCls}>
                    <input className="w-full text-sm bg-transparent outline-none"
                      value={row.memo}
                      onChange={e => {
                        const v = [...indoorRows]
                        v[ri] = { ...v[ri], memo: e.target.value }
                        setIndoorRows(v); setDirty(true)
                      }}
                    />
                  </td>
                </tr>
              ))}
              {indoorRows.length === 0 && (
                <tr><td colSpan={8} className={`${cellCls} text-center text-gray-400 py-4`}>데이터 없음 — 저장 시 자동 생성</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 저장 버튼 */}
      <div className="flex justify-end pt-2 border-t">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`px-5 py-2 rounded text-sm font-medium transition-colors ${
            dirty && !saving
              ? 'bg-sky-500 hover:bg-sky-600 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? '저장 중...' : dirty ? '변경사항 저장' : '저장됨'}
        </button>
      </div>
    </div>
  )
}
