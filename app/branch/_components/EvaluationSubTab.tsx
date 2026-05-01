'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ────────────────────────────────────────────────
interface ContactItem {
  id: string
  name: string
  jobGrade: string
  branch: string
  title: string
}

interface EvalRecord {
  id: string
  userId: string
  grade: string | null
  gradeReason: string | null
  user: { id: string; name: string; branchName: string | null }
}

interface SettlementRow {
  settlementStaffName: string
  tfName: string
  grossAmount: number
}

interface SalesContractRow {
  staffName: string
  month: number
  [key: string]: unknown
}

// ─── 상수 ────────────────────────────────────────────────
const CASE_TYPE_IDS = [
  'pneumoconiosis', 'copd', 'hearingLoss', 'wageCorrection',
  'disabilityPayment', 'litigation', 'musculoskeletal',
  'cerebrovascular', 'occupationalCancer', 'accident', 'other',
]

const INDOOR_GRADES = ['S', 'A', 'B', 'C'] as const

const EVAL_VIEWS = [
  { id: 'outdoor', label: '외근직 평가' },
  { id: 'indoor', label: '내근직 평가' },
  { id: 'yearend', label: '연말 시상식 대상 평가' },
] as const

type EvalView = typeof EVAL_VIEWS[number]['id']

// Contact 테이블의 branch는 "노무법인 더보상 울산지사" 형식,
// PerformanceTab의 ALL_BRANCHES는 "울산지사" 형식 → 변환 필요
function toContactBranch(shortBranch: string) {
  return `노무법인 더보상 ${shortBranch}`
}

function fmt(n: number) {
  return n ? n.toLocaleString('ko-KR') : '0'
}
function netAmount(gross: number) {
  return Math.floor(gross / 1.1)
}

// ─── Props ───────────────────────────────────────────────
interface Props {
  year: number
  quarter: number | null
  month: number | null
  branch: string
  viewMonths: number[]
}

// ─── 메인 컴포넌트 ──────────────────────────────────────
export default function EvaluationSubTab({ year, quarter, month, branch, viewMonths }: Props) {
  const [evalView, setEvalView] = useState<EvalView>('outdoor')

  return (
    <div className="space-y-4">
      {/* 평가 유형 선택 */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
        {EVAL_VIEWS.map(v => (
          <button key={v.id}
            onClick={() => setEvalView(v.id)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
              evalView === v.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >{v.label}</button>
        ))}
      </div>

      {evalView === 'outdoor' && (
        <OutdoorEval year={year} quarter={quarter} month={month} branch={branch} viewMonths={viewMonths} />
      )}
      {evalView === 'indoor' && (
        <IndoorEval year={year} quarter={quarter} month={month} branch={branch} />
      )}
      {evalView === 'yearend' && (
        <YearendEval />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// (1) 외근직 평가
// ══════════════════════════════════════════════════════════
function OutdoorEval({ year, quarter, month, branch }: Props) {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [salesData, setSalesData] = useState<Record<string, number>>({})       // staffName → 약정건수 합계
  const [tbSettleData, setTbSettleData] = useState<Record<string, { count: number; gross: number }>>({}) // 더보상TF 정산
  const [isanData, setIsanData] = useState<Record<string, { count: number; gross: number }>>({})         // 이산TF 건수

  // 대상 기간: 매분기
  const evalQuarters = quarter
    ? [quarter]
    : month
      ? [Math.ceil(month / 3)]
      : [1, 2, 3, 4]

  const evalMonths = evalQuarters.flatMap(q => {
    const base = (q - 1) * 3
    return [base + 1, base + 2, base + 3]
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. 해당 지사 외근직 직원 목록
      const cRes = await fetch(`/api/contacts?branch=${encodeURIComponent(toContactBranch(branch))}&jobGrade=외근직`)
      if (cRes.ok) {
        const data = await cRes.json()
        setContacts(Array.isArray(data) ? data : data.contacts || [])
      }

      // 2. 약정건수 — 해당 기간
      const salesMap: Record<string, number> = {}
      const sRes = await fetch(`/api/branch/sales-contracts?year=${year}&branchName=${encodeURIComponent(branch)}&includeStaff=true`)
      if (sRes.ok) {
        const sData = await sRes.json()
        const rows: SalesContractRow[] = Array.isArray(sData) ? sData : sData.contracts || []
        for (const r of rows) {
          if (!evalMonths.includes(r.month)) continue
          const total = CASE_TYPE_IDS.reduce((sum, ct) => sum + ((r[ct] as number) || 0), 0)
          salesMap[r.staffName] = (salesMap[r.staffName] || 0) + total
        }
      }
      setSalesData(salesMap)

      // 3. 정산내역 — 대상 기간 월별
      const tbSettle: Record<string, { count: number; gross: number }> = {}
      const isanSettle: Record<string, { count: number; gross: number }> = {}

      for (const m of evalMonths) {
        const rRes = await fetch(`/api/branch/settlement-records?year=${year}&month=${m}&branchName=${encodeURIComponent(branch)}`)
        if (!rRes.ok) continue
        const rows: SettlementRow[] = await rRes.json()
        for (const r of rows) {
          const name = r.settlementStaffName || '(미지정)'
          if (r.tfName?.startsWith('더보상')) {
            if (!tbSettle[name]) tbSettle[name] = { count: 0, gross: 0 }
            tbSettle[name].count += 1
            tbSettle[name].gross += r.grossAmount
          } else if (r.tfName) {
            if (!isanSettle[name]) isanSettle[name] = { count: 0, gross: 0 }
            isanSettle[name].count += 1
            isanSettle[name].gross += r.grossAmount
          }
        }
      }
      // 4. 당 지사 인원이 다른 지사 이산TF를 정산한 건 추가 집계 (cross-branch)
      //    ※ 지사 소속 외근직 이름 = contacts + salesData keys
      const localStaffNames = Array.from(new Set([
        ...Object.keys(salesMap),
        ...Object.keys(tbSettle),
        ...Object.keys(isanSettle),
      ]))
      if (localStaffNames.length > 0) {
        const qs = new URLSearchParams({
          year: String(year),
          staffNames: localStaffNames.join(','),
          months: evalMonths.join(','),
        })
        const crossRes = await fetch(`/api/branch/evaluation/isan-settlements?${qs}`)
        if (crossRes.ok) {
          const cross: Record<string, { count: number; gross: number }> = await crossRes.json()
          // cross는 전 지사 대상이므로 이미 현재 지사 건을 포함.
          //  → isanSettle을 cross로 '대체'하되, 당 지사 담당(더보상TF) 건은 cross에서 빠지므로 tbSettle과 충돌 없음
          for (const [name, v] of Object.entries(cross)) {
            isanSettle[name] = v
          }
        }
      }
      setTbSettleData(tbSettle)
      setIsanData(isanSettle)
    } catch (e) {
      console.error('외근직 평가 데이터 로드 실패', e)
    } finally {
      setLoading(false)
    }
  }, [year, quarter, month, branch, evalMonths.join(',')])

  useEffect(() => { loadData() }, [loadData])

  // 외근직 대상자 = contacts 중 외근직 + salesData에 이름이 있는 사람 합집합
  const staffNames = Array.from(new Set([
    ...contacts.map(c => c.name),
    ...Object.keys(salesData),
    ...Object.keys(tbSettleData),
  ]))

  const periodLabel = quarter
    ? `${year}년 ${quarter}분기`
    : month
      ? `${year}년 ${Math.ceil(month / 3)}분기`
      : `${year}년 전체`

  const cellCls = 'border border-gray-200 px-3 py-2 text-sm'
  const thCls = `${cellCls} bg-gray-50 font-medium text-center whitespace-nowrap`

  if (loading) return <div className="text-center py-8 text-gray-400">로딩 중...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="font-medium text-gray-700">대상 기간:</span>
        <span>{periodLabel} (매분기 평가)</span>
      </div>

      {staffNames.length === 0 ? (
        <div className="text-center py-8 text-gray-400">해당 지사의 외근직 데이터가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>직원명</th>
                <th className={thCls}>약정건수</th>
                <th className={thCls}>더보상TF 정산액</th>
                <th className={thCls}>더보상TF 정산건수</th>
                <th className={thCls}>이산TF 건수</th>
                <th className={thCls}>이산TF 정산액</th>
              </tr>
            </thead>
            <tbody>
              {staffNames.map(name => {
                const sales = salesData[name] || 0
                const tb = tbSettleData[name] || { count: 0, gross: 0 }
                const isan = isanData[name] || { count: 0, gross: 0 }
                return (
                  <tr key={name} className="hover:bg-gray-50">
                    <td className={`${cellCls} font-medium text-center`}>{name}</td>
                    <td className={`${cellCls} text-right`}>{sales > 0 ? `${sales}건` : '-'}</td>
                    <td className={`${cellCls} text-right`}>{tb.gross > 0 ? `${fmt(netAmount(tb.gross))}원` : '-'}</td>
                    <td className={`${cellCls} text-center`}>{tb.count > 0 ? `${tb.count}건` : '-'}</td>
                    <td className={`${cellCls} text-center`}>{isan.count > 0 ? `${isan.count}건` : '-'}</td>
                    <td className={`${cellCls} text-right`}>{isan.gross > 0 ? `${fmt(netAmount(isan.gross))}원` : '-'}</td>
                  </tr>
                )
              })}
              {/* 합계 행 */}
              <tr className="bg-gray-100 font-semibold">
                <td className={`${cellCls} text-center`}>합계</td>
                <td className={`${cellCls} text-right`}>
                  {fmt(staffNames.reduce((s, n) => s + (salesData[n] || 0), 0))}건
                </td>
                <td className={`${cellCls} text-right`}>
                  {fmt(netAmount(staffNames.reduce((s, n) => s + (tbSettleData[n]?.gross || 0), 0)))}원
                </td>
                <td className={`${cellCls} text-center`}>
                  {staffNames.reduce((s, n) => s + (tbSettleData[n]?.count || 0), 0)}건
                </td>
                <td className={`${cellCls} text-center`}>
                  {staffNames.reduce((s, n) => s + (isanData[n]?.count || 0), 0)}건
                </td>
                <td className={`${cellCls} text-right`}>
                  {fmt(netAmount(staffNames.reduce((s, n) => s + (isanData[n]?.gross || 0), 0)))}원
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// (2) 내근직 평가
// ══════════════════════════════════════════════════════════
interface IndoorEvalProps {
  year: number
  quarter: number | null
  month: number | null
  branch: string
}

function IndoorEval({ year, quarter, month, branch }: IndoorEvalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [evalRecords, setEvalRecords] = useState<EvalRecord[]>([])
  const [editGrades, setEditGrades] = useState<Record<string, string>>({})
  const [editReasons, setEditReasons] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<{ id: string; name: string; branchName: string | null }[]>([])

  // 대상 기간: 매반기 (H1: 1-6월, H2: 7-12월)
  const evalHalf = quarter
    ? (quarter <= 2 ? 1 : 2)
    : month
      ? (month <= 6 ? 1 : 2)
      : null // 1년 전체일 경우 양 반기 모두

  const periods = evalHalf
    ? [`${year}-H${evalHalf}`]
    : [`${year}-H1`, `${year}-H2`]

  const periodLabel = evalHalf
    ? `${year}년 ${evalHalf === 1 ? '상' : '하'}반기`
    : `${year}년 전체`

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. 해당 지사 내근직 직원 (Contact)
      const cRes = await fetch(`/api/contacts?branch=${encodeURIComponent(toContactBranch(branch))}&jobGrade=내근직`)
      if (cRes.ok) {
        const data = await cRes.json()
        setContacts(Array.isArray(data) ? data : data.contacts || [])
      }

      // 2. User 목록 (평가 저장용 userId 매핑)
      const uRes = await fetch('/api/users')
      if (uRes.ok) {
        const data = await uRes.json()
        if (Array.isArray(data)) setUsers(data)
      }

      // 3. 기존 평가 조회
      const allEvals: EvalRecord[] = []
      for (const p of periods) {
        const eRes = await fetch(`/api/branch/evaluations?branchName=${encodeURIComponent(branch)}&period=${p}&evalType=INDOOR`)
        if (eRes.ok) {
          const data = await eRes.json()
          allEvals.push(...data)
        }
      }
      setEvalRecords(allEvals)

      // 기존 데이터로 편집 상태 초기화
      const grades: Record<string, string> = {}
      const reasons: Record<string, string> = {}
      for (const e of allEvals) {
        const key = `${e.userId}_${periods[0]}`
        grades[key] = e.grade || ''
        reasons[key] = e.gradeReason || ''
      }
      setEditGrades(grades)
      setEditReasons(reasons)
    } catch (e) {
      console.error('내근직 평가 데이터 로드 실패', e)
    } finally {
      setLoading(false)
    }
  }, [year, quarter, month, branch])

  useEffect(() => { loadData() }, [loadData])

  // Contact → User 매핑 (이름 기준)
  function findUserId(contactName: string): string | null {
    const u = users.find(u => u.name === contactName && u.branchName === branch)
    return u?.id || users.find(u => u.name === contactName)?.id || null
  }

  async function saveEval(contactName: string, period: string) {
    const userId = findUserId(contactName)
    if (!userId) {
      alert(`"${contactName}" 사용자를 찾을 수 없습니다. 시스템에 등록된 사용자만 평가할 수 있습니다.`)
      return
    }
    const key = `${userId}_${period}`
    setSaving(key)
    try {
      const res = await fetch('/api/branch/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          period,
          evalType: 'INDOOR',
          grade: editGrades[key] || null,
          gradeReason: editReasons[key] || null,
          branchName: branch,
        }),
      })
      if (res.ok) {
        await loadData()
      }
    } catch (e) {
      console.error('평가 저장 실패', e)
    } finally {
      setSaving(null)
    }
  }

  const cellCls = 'border border-gray-200 px-3 py-2 text-sm'
  const thCls = `${cellCls} bg-gray-50 font-medium text-center whitespace-nowrap`

  if (loading) return <div className="text-center py-8 text-gray-400">로딩 중...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="font-medium text-gray-700">대상 기간:</span>
        <span>{periodLabel} (매반기 평가 · 지사장 주관)</span>
      </div>

      {periods.map(period => {
        const halfNum = period.endsWith('H1') ? 1 : 2
        const halfLabel = `${year}년 ${halfNum === 1 ? '상' : '하'}반기`

        return (
          <div key={period} className="space-y-2">
            {periods.length > 1 && (
              <h4 className="text-sm font-semibold text-gray-700">{halfLabel}</h4>
            )}

            {contacts.length === 0 ? (
              <div className="text-center py-6 text-gray-400">해당 지사의 내근직 직원이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={`${thCls} w-28`}>직원명</th>
                      <th className={`${thCls} w-24`}>직책</th>
                      <th className={`${thCls} w-24`}>평가등급</th>
                      <th className={thCls}>평가 사유</th>
                      <th className={`${thCls} w-20`}>저장</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => {
                      const userId = findUserId(c.name)
                      const key = userId ? `${userId}_${period}` : `__${c.name}_${period}`
                      const existing = evalRecords.find(e => e.userId === userId && e.user)
                      const currentGrade = editGrades[key] || existing?.grade || ''
                      const currentReason = editReasons[key] || existing?.gradeReason || ''
                      const isSaving = saving === key

                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className={`${cellCls} font-medium text-center`}>{c.name}</td>
                          <td className={`${cellCls} text-center text-gray-500`}>{c.title || '-'}</td>
                          <td className={`${cellCls} text-center`}>
                            <select
                              value={currentGrade}
                              onChange={e => setEditGrades(prev => ({ ...prev, [key]: e.target.value }))}
                              className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm text-center"
                            >
                              <option value="">미평가</option>
                              {INDOOR_GRADES.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </td>
                          <td className={cellCls}>
                            <textarea
                              value={currentReason}
                              onChange={e => setEditReasons(prev => ({ ...prev, [key]: e.target.value }))}
                              placeholder="평가 사유를 입력하세요"
                              rows={1}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm resize-y"
                            />
                          </td>
                          <td className={`${cellCls} text-center`}>
                            <button
                              onClick={() => saveEval(c.name, period)}
                              disabled={isSaving || !userId}
                              className="px-2 py-1 text-xs bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50"
                            >
                              {isSaving ? '...' : '저장'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// (3) 연말 시상식 대상 평가 (추후 구현)
// ══════════════════════════════════════════════════════════
function YearendEval() {
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-lg mb-2">연말 시상식 대상 평가</p>
      <p className="text-sm">대상 기간: 전년도 12월 ~ 대상연도 11월</p>
      <p className="text-sm mt-4">추후 구현 예정</p>
    </div>
  )
}
