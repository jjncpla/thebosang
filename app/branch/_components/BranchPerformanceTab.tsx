'use client'
import { useState, useEffect } from 'react'

interface SalesContract {
  id: string
  branchName: string
  staffName: string
  year: number
  month: number
  pneumoconiosis: number
  copd: number
  hearingLoss: number
  wageCorrection: number
  disabilityPayment: number
  litigation: number
  musculoskeletal: number
  cerebrovascular: number
  occupationalCancer: number
  accident: number
  other: number
}

interface SettlementSummary {
  staffName: string
  personalTotal: number
  tfTotal: number
  grandTotal: number
}

interface WeeklyActivity {
  id: string
  branchName: string
  staffName: string
  year: number
  month: number
  weekNumber: number
  weekLabel: string
  initialVisit: number
  specialExam: number
  docSupplementation: number
  submission: number
  sales: number
}

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const CASE_TYPES = [
  { key: 'hearingLoss', label: '난청' },
  { key: 'copd', label: 'COPD' },
  { key: 'pneumoconiosis', label: '진폐' },
  { key: 'musculoskeletal', label: '근골격계' },
  { key: 'occupationalCancer', label: '직업성암' },
  { key: 'cerebrovascular', label: '뇌심혈관' },
  { key: 'disabilityPayment', label: '장해급여' },
  { key: 'wageCorrection', label: '평균임금정정' },
  { key: 'litigation', label: '소송' },
  { key: 'accident', label: '업무상사고' },
  { key: 'other', label: '기타' },
]

export default function BranchPerformanceTab({
  selectedBranch,
  selectedYear,
}: {
  selectedBranch: string
  selectedYear: number
}) {
  const [subTab, setSubTab] = useState<'contracts' | 'settlement' | 'weekly'>('contracts')
  const [contracts, setContracts] = useState<SalesContract[]>([])
  const [settlements, setSettlements] = useState<SettlementSummary[]>([])
  const [activities, setActivities] = useState<WeeklyActivity[]>([])
  const [loading, setLoading] = useState(false)

  const th = { padding: '8px 10px', background: '#29ABE2', color: '#fff', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #1A8BBF', textAlign: 'center' as const, whiteSpace: 'nowrap' as const }
  const td = { padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #f1f5f9', textAlign: 'center' as const }

  useEffect(() => {
    fetchAll()
  }, [selectedBranch, selectedYear, subTab])

  const fetchAll = async () => {
    setLoading(true)
    if (subTab === 'contracts') {
      const res = await fetch(`/api/branch/sales-contracts?branchName=${encodeURIComponent(selectedBranch)}&year=${selectedYear}`)
      const data = await res.json()
      setContracts(Array.isArray(data) ? data : (data.contracts || []))
    } else if (subTab === 'settlement') {
      const res = await fetch(`/api/branch/settlement-records?branchName=${encodeURIComponent(selectedBranch)}&year=${selectedYear}`)
      const data = await res.json()
      const records = Array.isArray(data) ? data : (data.records || [])
      // 직원별 정산 합계 계산
      const summaryMap: Record<string, SettlementSummary> = {}
      records.forEach((r: { grossAmount: number; salesStaffName?: string; settlementStaffName?: string; allocations?: { staffName: string; ratio: number; isExternal: boolean }[] }) => {
        const staffs = [r.salesStaffName, r.settlementStaffName].filter((s): s is string => Boolean(s))
        staffs.forEach((s) => {
          if (!summaryMap[s]) summaryMap[s] = { staffName: s, personalTotal: 0, tfTotal: 0, grandTotal: 0 }
        })
        // allocations에서 합산
        ;(r.allocations || []).forEach((a) => {
          if (!summaryMap[a.staffName]) summaryMap[a.staffName] = { staffName: a.staffName, personalTotal: 0, tfTotal: 0, grandTotal: 0 }
          const amount = Math.round(r.grossAmount * (a.ratio / 100))
          if (a.isExternal) {
            summaryMap[a.staffName].tfTotal += amount
          } else {
            summaryMap[a.staffName].personalTotal += amount
          }
          summaryMap[a.staffName].grandTotal += amount
        })
      })
      setSettlements(Object.values(summaryMap).sort((a, b) => b.grandTotal - a.grandTotal))
    } else {
      const res = await fetch(`/api/weekly-activity?branchName=${encodeURIComponent(selectedBranch)}&year=${selectedYear}`)
      const data = await res.json()
      setActivities(data.activities || [])
    }
    setLoading(false)
  }

  // 직원별 집계
  const staffList = [...new Set(contracts.map(c => c.staffName))].sort()

  const getStaffMonthTotal = (staffName: string, month: number) => {
    const c = contracts.find(c => c.staffName === staffName && c.month === month)
    if (!c) return 0
    return CASE_TYPES.reduce((sum, t) => sum + ((c as unknown as Record<string, number>)[t.key] || 0), 0)
  }

  const getStaffAnnualTotal = (staffName: string) => {
    return Array.from({length: 12}, (_, i) => i + 1).reduce((sum, m) => sum + getStaffMonthTotal(staffName, m), 0)
  }

  // 약정 실적 서브탭
  const renderContracts = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{...th, textAlign: 'left'}}>직원</th>
            {MONTHS.map(m => <th key={m} style={th}>{m}</th>)}
            <th style={{...th, background: '#e0f2fe'}}>합계</th>
            <th style={{...th, background: '#e0f2fe'}}>순위</th>
          </tr>
        </thead>
        <tbody>
          {staffList
            .map(s => ({ name: s, total: getStaffAnnualTotal(s) }))
            .sort((a, b) => b.total - a.total)
            .map((item, idx) => (
              <tr key={item.name}>
                <td style={{...td, textAlign: 'left', fontWeight: 600}}>{item.name}</td>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => {
                  const total = getStaffMonthTotal(item.name, m)
                  return <td key={m} style={{...td, color: total > 0 ? '#1e40af' : '#94a3b8'}}>{total || '-'}</td>
                })}
                <td style={{...td, background: '#f0f9ff', fontWeight: 700, color: '#0369a1'}}>{item.total}</td>
                <td style={{...td, fontWeight: 600, color: idx === 0 ? '#b45309' : idx === 1 ? '#475569' : idx === 2 ? '#9a3412' : '#64748b'}}>{idx + 1}위</td>
              </tr>
            ))}
          {/* 집계 행 */}
          <tr style={{ background: '#f8fafc' }}>
            <td style={{...td, textAlign: 'left', fontWeight: 700}}>합계</td>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => {
              const monthTotal = staffList.reduce((sum, s) => sum + getStaffMonthTotal(s, m), 0)
              return <td key={m} style={{...td, fontWeight: 600}}>{monthTotal || '-'}</td>
            })}
            <td style={{...td, background: '#e0f2fe', fontWeight: 700}}>
              {staffList.reduce((sum, s) => sum + getStaffAnnualTotal(s), 0)}
            </td>
            <td style={td}></td>
          </tr>
        </tbody>
      </table>

      {/* 순위표 */}
      <div style={{ marginTop: 20 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>연간 약정건수 순위</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {staffList
            .map(s => ({ name: s, total: getStaffAnnualTotal(s) }))
            .sort((a, b) => b.total - a.total)
            .map((item, idx) => (
              <div key={item.name} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#fff7ed' : '#f8fafc',
                border: '1px solid #e2e8f0',
              }}>
                {idx + 1}위 {item.name} <span style={{ color: '#2563eb' }}>{item.total}건</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )

  // 정산 집계 서브탭
  const renderSettlement = () => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{...th, textAlign: 'left'}}>직원</th>
            <th style={th}>개인 정산 합계</th>
            <th style={th}>TF 정산 합계</th>
            <th style={{...th, background: '#e0f2fe'}}>총 합계</th>
          </tr>
        </thead>
        <tbody>
          {settlements.map(s => (
            <tr key={s.staffName}>
              <td style={{...td, textAlign: 'left', fontWeight: 600}}>{s.staffName}</td>
              <td style={td}>{s.personalTotal.toLocaleString()}원</td>
              <td style={td}>{s.tfTotal.toLocaleString()}원</td>
              <td style={{...td, background: '#f0f9ff', fontWeight: 700, color: '#0369a1'}}>
                {s.grandTotal.toLocaleString()}원
              </td>
            </tr>
          ))}
          {settlements.length === 0 && (
            <tr><td colSpan={4} style={{...td, color: '#94a3b8', padding: 24}}>데이터 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  // 주간활동 서브탭
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  const monthActivities = activities.filter(a => a.month === selectedMonth)
  const weeklyStaffs = [...new Set(monthActivities.map(a => a.staffName))].sort()
  const weeks = [...new Set(monthActivities.map(a => a.weekNumber))].sort((a, b) => a - b)

  const getActivity = (staff: string, week: number) =>
    monthActivities.find(a => a.staffName === staff && a.weekNumber === week)

  const getStaffMonthSum = (staff: string, field: keyof WeeklyActivity) =>
    monthActivities.filter(a => a.staffName === staff)
      .reduce((sum, a) => sum + ((a[field] as number) || 0), 0)

  const activityTypes = [
    { label: '초진', field: 'initialVisit' as keyof WeeklyActivity },
    { label: '특진', field: 'specialExam' as keyof WeeklyActivity },
    { label: '자료보완', field: 'docSupplementation' as keyof WeeklyActivity },
    { label: '접수', field: 'submission' as keyof WeeklyActivity },
    { label: '영업', field: 'sales' as keyof WeeklyActivity },
  ]

  const getActivityTotal = (act: WeeklyActivity | undefined) => {
    if (!act) return 0
    return (act.initialVisit || 0) + (act.specialExam || 0) + (act.docSupplementation || 0) + (act.submission || 0) + (act.sales || 0)
  }

  const renderWeekly = () => (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#64748b' }}>주간 활동 현황</span>
      </div>

      {weeklyStaffs.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          {[...activityTypes, { label: '합계', field: null as unknown as keyof WeeklyActivity }].map(actType => (
            <div key={actType.label} style={{ marginBottom: 16 }}>
              <h5 style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{actType.label}</h5>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>구분</th>
                    {weeklyStaffs.map(s => <th key={s} style={th}>{s}</th>)}
                    <th style={{...th, background: '#e0f2fe'}}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(w => {
                    const weekLabel = monthActivities.find(a => a.weekNumber === w)?.weekLabel || `${selectedMonth}월 ${w}주`
                    return (
                      <tr key={w}>
                        <td style={{...td, textAlign: 'left'}}>{weekLabel}</td>
                        {weeklyStaffs.map(s => {
                          const act = getActivity(s, w)
                          const val = actType.field ? ((act?.[actType.field] as number) || 0) : getActivityTotal(act)
                          return <td key={s} style={td}>{val || '-'}</td>
                        })}
                        <td style={{...td, background: '#f0f9ff', fontWeight: 600}}>
                          {weeklyStaffs.reduce((sum, s) => {
                            const act = getActivity(s, w)
                            return sum + (actType.field ? ((act?.[actType.field] as number) || 0) : getActivityTotal(act))
                          }, 0) || '-'}
                        </td>
                      </tr>
                    )
                  })}
                  {/* 월 합계 행 */}
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td style={{...td, textAlign: 'left'}}>{selectedMonth}월 합계</td>
                    {weeklyStaffs.map(s => {
                      const total = actType.field
                        ? getStaffMonthSum(s, actType.field)
                        : activityTypes.reduce((sum, at) => sum + getStaffMonthSum(s, at.field), 0)
                      return <td key={s} style={{...td, background: '#f8fafc'}}>{total || '-'}</td>
                    })}
                    <td style={{...td, background: '#e0f2fe'}}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#94a3b8', fontSize: 13 }}>이 달의 주간활동 데이터가 없습니다.</p>
      )}
    </div>
  )

  const subTabStyle = (active: boolean) => ({
    padding: '6px 14px', fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? '#29ABE2' : '#64748b', cursor: 'pointer', background: 'none', border: 'none',
    borderBottomWidth: 2, borderBottomStyle: 'solid' as const,
    borderBottomColor: active ? '#29ABE2' : 'transparent',
  })

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
        <button style={subTabStyle(subTab === 'contracts')} onClick={() => setSubTab('contracts')}>약정 실적</button>
        <button style={subTabStyle(subTab === 'settlement')} onClick={() => setSubTab('settlement')}>정산 집계</button>
        <button style={subTabStyle(subTab === 'weekly')} onClick={() => setSubTab('weekly')}>주간활동</button>
      </div>
      {loading ? <p style={{ color: '#94a3b8', fontSize: 13 }}>로딩 중...</p> : (
        <>
          {subTab === 'contracts' && renderContracts()}
          {subTab === 'settlement' && renderSettlement()}
          {subTab === 'weekly' && renderWeekly()}
        </>
      )}
    </div>
  )
}
