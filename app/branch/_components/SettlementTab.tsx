'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ───────────────────────────────────────────────────────
interface FinancialRow {
  month: number
  revenue: number
  cost: number
  memo: string
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
  const [financials, setFinancials] = useState<FinancialRow[]>(
    months.map(m => ({ month: m, revenue: 0, cost: 0, memo: '' }))
  )

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

    // 매출비용
    const finMap: Record<number, FinancialRow> = {}
    for (const m of months) finMap[m] = { month: m, revenue: 0, cost: 0, memo: '' }
    for (const r of fin) finMap[r.month] = { month: r.month, revenue: r.revenue, cost: r.cost, memo: r.memo ?? '' }
    setFinancials(months.map(m => finMap[m]))

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

      // 매출비용
      for (const row of financials) {
        saves.push(fetch('/api/branch/financial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, month: row.month, branchName: null, revenue: row.revenue, cost: row.cost, memo: row.memo }),
        }))
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
  const totalRevenue = financials.reduce((s, r) => s + r.revenue, 0)
  const totalCost = financials.reduce((s, r) => s + r.cost, 0)
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
              <tr className="bg-gray-50">
                <th className={`${cellCls} text-left`}>항목</th>
                {months.map(m => <th key={m} className={`${cellCls} text-right w-32`}>{m}월</th>)}
                <th className={`${cellCls} text-right w-36 bg-sky-50`}>분기 합계</th>
              </tr>
            </thead>
            <tbody>
              {/* 매출 */}
              <tr>
                <td className={`${cellCls} text-gray-600`}>매출 (원)</td>
                {financials.map((row, i) => (
                  <td key={row.month} className={cellCls}>
                    <input className={inputCls}
                      value={row.revenue ? formatAmount(row.revenue) : ''}
                      placeholder="0"
                      onChange={e => {
                        const v = [...financials]; v[i] = { ...v[i], revenue: parseAmount(e.target.value) }
                        setFinancials(v); setDirty(true)
                      }}
                    />
                  </td>
                ))}
                <td className={`${cellCls} text-right font-medium text-sky-700 bg-sky-50`}>
                  {formatAmount(totalRevenue)}
                </td>
              </tr>
              {/* 비용 */}
              <tr>
                <td className={`${cellCls} text-gray-600`}>비용 (원)</td>
                {financials.map((row, i) => (
                  <td key={row.month} className={cellCls}>
                    <input className={inputCls}
                      value={row.cost ? formatAmount(row.cost) : ''}
                      placeholder="0"
                      onChange={e => {
                        const v = [...financials]; v[i] = { ...v[i], cost: parseAmount(e.target.value) }
                        setFinancials(v); setDirty(true)
                      }}
                    />
                  </td>
                ))}
                <td className={`${cellCls} text-right font-medium text-orange-600 bg-orange-50`}>
                  {formatAmount(totalCost)}
                </td>
              </tr>
              {/* 순이익 */}
              <tr className="bg-gray-50">
                <td className={`${cellCls} font-medium`}>순이익</td>
                {months.map(m => {
                  const row = financials.find(r => r.month === m)!
                  const p = row.revenue - row.cost
                  return (
                    <td key={m} className={`${cellCls} text-right font-medium ${p >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {p !== 0 ? formatAmount(p) : ''}
                    </td>
                  )
                })}
                <td className={`${cellCls} text-right font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'} bg-green-50`}>
                  {formatAmount(totalProfit)}
                </td>
              </tr>
            </tbody>
          </table>
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
              <tr className="bg-gray-50">
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
              <tr className="bg-gray-50">
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
