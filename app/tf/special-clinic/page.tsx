'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getTFColor } from '@/lib/tf-colors'

// ─── 타입 ────────────────────────────────────────────────────────
interface Schedule {
  id: string
  patientName: string
  tfName: string
  hospitalName: string
  clinicType: string
  examRound: number
  scheduledDate: string | null
  isAllDay: boolean
  scheduledHour: number | null
  scheduledMinute: number | null
  status: string
  sender: string | null
  sourceDate: string | null
  rawMessage: string | null
  memo: string | null
  createdAt: string
}

// ─── 유틸 ─────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0') }
function fmtTime(h: number | null, m: number | null) {
  if (h == null) return ''
  return `${pad(h)}:${pad(m ?? 0)}`
}
function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

const STATUS_LABELS: Record<string, string> = { scheduled: '예정', done: '완료', cancelled: '취소', unknown: '미정' }
const STATUS_COLORS: Record<string, string> = { scheduled: '#3B82F6', done: '#22C55E', cancelled: '#EF4444', unknown: '#F59E0B' }

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function SpecialClinicPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-400">로딩 중...</div>}>
      <SpecialClinicCalendar />
    </Suspense>
  )
}

function SpecialClinicCalendar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const now = new Date()
  const [year, setYear] = useState(Number(searchParams?.get('year')) || now.getFullYear())
  const [month, setMonth] = useState(Number(searchParams?.get('month')) || now.getMonth() + 1)
  const [tfFilter, setTfFilter] = useState(searchParams?.get('tf') || '')
  const [typeFilter, setTypeFilter] = useState(searchParams?.get('type') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') || 'all')

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [allTfNames, setAllTfNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Schedule | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'form' | 'paste'>('form')

  // 캘린더 고도화 상태
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [currentDay, setCurrentDay] = useState<Date>(new Date())
  const [manualDate, setManualDate] = useState('')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d
  })
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [holidays, setHolidays] = useState<Record<string, string>>({})
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // URL 동기화
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('year', String(year))
    params.set('month', String(month))
    if (tfFilter) params.set('tf', tfFilter)
    if (typeFilter) params.set('type', typeFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    router.replace(`/tf/special-clinic?${params}`, { scroll: false })
  }, [year, month, tfFilter, typeFilter, statusFilter, router])

  // 데이터 로드
  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({
      month: `${year}-${pad(month)}`,
      status: statusFilter,
    })
    if (tfFilter) qs.set('tfName', tfFilter)
    if (typeFilter) qs.set('clinicType', typeFilter)
    const res = await fetch(`/api/tf/special-clinic?${qs}`)
    if (res.ok) setSchedules(await res.json())
    setLoading(false)
  }, [year, month, tfFilter, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  // 공휴일 로드
  useEffect(() => {
    fetch(`/api/holidays?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => { if (data && typeof data === 'object') setHolidays(data) })
      .catch(() => {})
  }, [year, month])

  // 팝업 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelected(null)
      }
    }
    if (selected) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [selected])

  // TF 목록 (전체 데이터에서 — 필터와 무관하게 모든 TF 표시)
  useEffect(() => {
    const qs = new URLSearchParams({ month: `${year}-${pad(month)}` })
    fetch(`/api/tf/special-clinic?${qs}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Schedule[]) => setAllTfNames([...new Set(data.map(s => s.tfName))].sort()))
      .catch(() => {})
  }, [year, month])
  const tfList = allTfNames

  // 달력 그리드 생성
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startDow = firstDay.getDay() // 0=일
  const daysInMonth = lastDay.getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  function getSchedulesForDay(day: number) {
    const target = new Date(year, month - 1, day)
    return schedules.filter(s => {
      if (!s.scheduledDate) return false
      return isSameDay(new Date(s.scheduledDate), target)
    })
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // 주 네비게이션
  function prevWeek() {
    setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  }
  function nextWeek() {
    setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
  }
  function getWeekDays(): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); return d
    })
  }

  // 날짜키
  function dateKey(y: number, m: number, d: number) {
    return `${y}-${pad(m)}-${pad(d)}`
  }

  // 일정 카드 클릭 (팝업)
  function handleEventClick(s: Schedule, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let x = rect.right + 8
    let y = rect.top
    if (x + 320 > window.innerWidth) x = rect.left - 328
    if (y + 350 > window.innerHeight) y = window.innerHeight - 360
    if (x < 0) x = 8
    if (y < 0) y = 8
    setPopupPosition({ x, y })
    setSelected(s)
  }

  // 드래그 앤 드롭
  async function handleDrop(targetDate: Date) {
    if (!draggedEventId) return
    try {
      await fetch(`/api/tf/special-clinic/${draggedEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: targetDate.toISOString() }),
      })
      load()
    } catch (e) {
      console.error('날짜 변경 실패:', e)
    }
    setDraggedEventId(null)
  }

  // 접기/펼치기
  function toggleExpand(key: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // 일별 뷰 네비게이션
  function prevDay() { setCurrentDay(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n }) }
  function nextDay() { setCurrentDay(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n }) }
  function getSchedulesForDate(d: Date) {
    return schedules.filter(s => s.scheduledDate && isSameDay(new Date(s.scheduledDate), d))
  }

  // 날짜 클릭 → 일별 뷰로
  function goToDay(d: Date) { setCurrentDay(d); setViewMode('day') }

  // 수동 입력 모달 열기 (날짜 기본값 지정)
  function openManualModal(date?: string) {
    if (date) setManualDate(date)
    else setManualDate('')
    setShowModal(true)
    setModalTab('form')
  }

  // 삭제
  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/tf/special-clinic/${id}`, { method: 'DELETE' })
    setSelected(null)
    load()
  }

  // 상태 변경
  async function handleStatusChange(id: string, newStatus: string) {
    await fetch(`/api/tf/special-clinic/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSelected(s => s ? { ...s, status: newStatus } : null)
    load()
  }

  const DOW = ['일','월','화','수','목','금','토']

  return (
    <div className="p-4 space-y-4" style={{ maxWidth: 1200 }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-gray-800">TF업무 &gt; 특진 일정</h1>
        <button
          onClick={() => openManualModal()}
          className="px-3 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600"
        >
          + 수동 입력
        </button>
      </div>

      {/* 월/주 네비게이션 + 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        {viewMode === 'month' ? (
          <>
            <button onClick={prevMonth} className="px-2 py-1 border rounded hover:bg-gray-50">&lt;</button>
            <span className="text-sm font-semibold min-w-[100px] text-center">{year}년 {month}월</span>
            <button onClick={nextMonth} className="px-2 py-1 border rounded hover:bg-gray-50">&gt;</button>
          </>
        ) : viewMode === 'week' ? (
          <>
            <button onClick={prevWeek} className="px-2 py-1 border rounded hover:bg-gray-50">&lt;</button>
            <span className="text-sm font-semibold min-w-[180px] text-center">
              {currentWeekStart.getFullYear()}년 {currentWeekStart.getMonth() + 1}월 {currentWeekStart.getDate()}일 — {(() => {
                const end = new Date(currentWeekStart); end.setDate(end.getDate() + 6)
                return `${end.getMonth() + 1}월 ${end.getDate()}일`
              })()}
            </span>
            <button onClick={nextWeek} className="px-2 py-1 border rounded hover:bg-gray-50">&gt;</button>
          </>
        ) : (
          <>
            <button onClick={prevDay} className="px-2 py-1 border rounded hover:bg-gray-50">&lt;</button>
            <span className="text-sm font-semibold min-w-[160px] text-center">
              {currentDay.getFullYear()}년 {currentDay.getMonth() + 1}월 {currentDay.getDate()}일 ({DOW[currentDay.getDay()]})
            </span>
            <button onClick={nextDay} className="px-2 py-1 border rounded hover:bg-gray-50">&gt;</button>
          </>
        )}

        <span className="text-gray-300">|</span>

        <div className="flex bg-gray-100 rounded p-0.5">
          {(['month', 'week', 'day'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${viewMode === m ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
              {m === 'month' ? '월별' : m === 'week' ? '주별' : '일별'}
            </button>
          ))}
        </div>

        <span className="text-gray-300">|</span>

        <select value={tfFilter} onChange={e => setTfFilter(e.target.value)}
          className="border rounded px-2 py-1 text-xs">
          <option value="">전체 TF</option>
          {tfList.map(tf => <option key={tf} value={tf}>{tf}</option>)}
        </select>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border rounded px-2 py-1 text-xs">
          <option value="">전체 유형</option>
          <option value="특진">특진</option>
          <option value="재특진">재특진</option>
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded px-2 py-1 text-xs">
          <option value="all">전체 상태</option>
          <option value="scheduled">예정</option>
          <option value="done">완료</option>
          <option value="cancelled">취소</option>
        </select>

        {loading && <span className="text-xs text-gray-400">로딩...</span>}
      </div>

      {/* 캘린더 + TF 범례 flex 레이아웃 */}
      <div className="flex gap-3">
      {/* 캘린더 그리드 */}
      <div className="border rounded-lg overflow-hidden flex-1 min-w-0">
        {/* 요일 헤더 */}
        {viewMode !== 'day' && (
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DOW.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
        </div>
        )}

        {/* 월별 뷰 */}
        {viewMode === 'month' && weeks.map((wk, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0" style={{ minHeight: 100 }}>
            {wk.map((day, di) => {
              const daySchedules = day ? getSchedulesForDay(day) : []
              const isToday = day !== null && isSameDay(new Date(year, month - 1, day), now)
              const dk = day ? dateKey(year, month, day) : ''
              const isExpanded = expandedDates.has(dk)
              const maxShow = 2
              const holidayName = day ? holidays[dk] : null
              const isHoliday = !!holidayName

              return (
                <div key={di}
                  className={`group border-r last:border-r-0 p-1 transition-colors ${day ? 'bg-white' : 'bg-gray-50/50'}`}
                  onDragOver={day ? (e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = '#eff6ff' } : undefined}
                  onDragLeave={day ? (e) => { e.currentTarget.style.backgroundColor = '' } : undefined}
                  onDrop={day ? (e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = ''; handleDrop(new Date(year, month - 1, day)) } : undefined}
                >
                  {day !== null && (
                    <>
                      <div className="flex items-center gap-1 mb-0.5">
                        <div
                          onClick={() => goToDay(new Date(year, month - 1, day))}
                          className={`text-xs cursor-pointer hover:underline ${isToday ? 'bg-[#29ABE2] text-white w-5 h-5 rounded-full flex items-center justify-center font-bold' : (di === 0 || isHoliday) ? 'text-red-400' : di === 6 ? 'text-blue-400' : 'text-gray-600'}`}
                        >
                          {day}
                        </div>
                        {holidayName && (
                          <span className="text-[9px] text-red-400 truncate">{holidayName}</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openManualModal(dk) }}
                          className="ml-auto w-4 h-4 text-[10px] text-gray-400 hover:text-[#29ABE2] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="이 날 일정 추가"
                        >+</button>
                      </div>
                      {(isExpanded ? daySchedules : daySchedules.slice(0, maxShow)).map(s => (
                        <button
                          key={s.id}
                          draggable
                          onDragStart={() => setDraggedEventId(s.id)}
                          onDragEnd={() => setDraggedEventId(null)}
                          onClick={(e) => handleEventClick(s, e)}
                          className="w-full text-left mb-0.5 rounded px-1 py-0.5 cursor-pointer transition-all hover:brightness-95"
                          style={{
                            backgroundColor: getTFColor(s.tfName) + '18',
                            borderLeft: `3px solid ${getTFColor(s.tfName)}`,
                            opacity: draggedEventId === s.id ? 0.4 : 1,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getTFColor(s.tfName) }} />
                            <span className="text-[10px] font-medium truncate text-gray-800">{s.patientName}</span>
                          </div>
                          <div className="text-[9px] text-gray-500 truncate pl-2.5">
                            {s.clinicType} {s.examRound}차 {fmtTime(s.scheduledHour, s.scheduledMinute)}
                          </div>
                          <div className="text-[9px] text-gray-400 truncate pl-2.5">{s.hospitalName}</div>
                        </button>
                      ))}
                      {daySchedules.length > maxShow && (
                        <button
                          onClick={() => toggleExpand(dk)}
                          className="w-full text-[9px] text-sky-500 hover:text-sky-700 text-center py-0.5 cursor-pointer"
                        >
                          {isExpanded ? '▲ 접기' : `+ ${daySchedules.length - maxShow}개 더보기`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* 주별 뷰 */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-7 border-b last:border-b-0" style={{ minHeight: 300 }}>
            {getWeekDays().map((wd, di) => {
              const wdSchedules = schedules.filter(s => s.scheduledDate && isSameDay(new Date(s.scheduledDate), wd))
              const isToday = isSameDay(wd, now)
              const dk = dateKey(wd.getFullYear(), wd.getMonth() + 1, wd.getDate())
              const holidayName = holidays[dk]
              const isHoliday = !!holidayName
              const isCurrentMonth = wd.getMonth() + 1 === month && wd.getFullYear() === year

              return (
                <div key={di}
                  className={`border-r last:border-r-0 p-1.5 flex flex-col ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'}`}
                  style={{ minHeight: 120 }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = '#eff6ff' }}
                  onDragLeave={e => { e.currentTarget.style.backgroundColor = '' }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = ''; handleDrop(wd) }}
                >
                  <div className="mb-1">
                    <div
                      onClick={() => goToDay(wd)}
                      className={`text-xs cursor-pointer hover:underline ${isToday ? 'bg-[#29ABE2] text-white w-5 h-5 rounded-full flex items-center justify-center font-bold' : (di === 0 || isHoliday) ? 'text-red-400' : di === 6 ? 'text-blue-400' : isCurrentMonth ? 'text-gray-600' : 'text-gray-300'}`}
                    >
                      {wd.getDate()}
                    </div>
                    {holidayName && <div className="text-[9px] text-red-400">{holidayName}</div>}
                  </div>
                  <div className="flex-1 space-y-0.5 overflow-y-auto">
                    {wdSchedules.map(s => (
                      <button
                        key={s.id}
                        draggable
                        onDragStart={() => setDraggedEventId(s.id)}
                        onDragEnd={() => setDraggedEventId(null)}
                        onClick={(e) => handleEventClick(s, e)}
                        className="w-full text-left rounded px-1 py-0.5 cursor-pointer transition-all hover:brightness-95"
                        style={{
                          backgroundColor: getTFColor(s.tfName) + '18',
                          borderLeft: `3px solid ${getTFColor(s.tfName)}`,
                          opacity: draggedEventId === s.id ? 0.4 : 1,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getTFColor(s.tfName) }} />
                          <span className="text-[10px] font-medium truncate text-gray-800">{s.patientName}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 pl-2.5">
                          {s.clinicType} {s.examRound}차
                        </div>
                        <div className="text-[9px] text-gray-400 truncate pl-2.5">{s.hospitalName}</div>
                        {!s.isAllDay && s.scheduledHour != null && (
                          <div className="text-[9px] text-sky-600 pl-2.5 font-medium">
                            {fmtTime(s.scheduledHour, s.scheduledMinute)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* 일별 뷰 */}
        {viewMode === 'day' && (() => {
          const dayScheds = getSchedulesForDate(currentDay)
          const allDayScheds = dayScheds.filter(s => s.isAllDay || s.scheduledHour == null)
          const timedScheds = dayScheds.filter(s => !s.isAllDay && s.scheduledHour != null)
            .sort((a, b) => (a.scheduledHour! * 60 + (a.scheduledMinute ?? 0)) - (b.scheduledHour! * 60 + (b.scheduledMinute ?? 0)))
          const dk = dateKey(currentDay.getFullYear(), currentDay.getMonth() + 1, currentDay.getDate())
          const holidayName = holidays[dk]

          return (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  {holidayName && <span className="text-xs text-red-400 font-medium">{holidayName}</span>}
                </div>
                <button
                  onClick={() => openManualModal(dk)}
                  className="px-2.5 py-1 text-xs bg-sky-500 text-white rounded hover:bg-sky-600"
                >+ 이 날 일정 추가</button>
              </div>

              {dayScheds.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">이 날 등록된 일정이 없습니다</div>
              )}

              {allDayScheds.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium">하루종일</div>
                  {allDayScheds.map(s => (
                    <div key={s.id} className="rounded-lg p-3 border" style={{ borderLeftWidth: 4, borderLeftColor: getTFColor(s.tfName), backgroundColor: getTFColor(s.tfName) + '08' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getTFColor(s.tfName) }} />
                        <span className="text-xs font-medium" style={{ color: getTFColor(s.tfName) }}>{s.tfName}</span>
                      </div>
                      <div className="text-sm font-bold text-gray-800">{s.patientName} &nbsp;{s.clinicType} {s.examRound}차</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.hospitalName}</div>
                      <div className="flex gap-2 mt-2">
                        {(['scheduled','done','cancelled'] as const).map(st => (
                          <button key={st} onClick={() => handleStatusChange(s.id, st)}
                            className="px-1.5 py-0.5 text-[10px] rounded border transition-colors"
                            style={s.status === st ? { backgroundColor: STATUS_COLORS[st], color: '#fff', borderColor: STATUS_COLORS[st] } : { borderColor: '#ddd', color: '#666' }}
                          >{STATUS_LABELS[st]}</button>
                        ))}
                        <button onClick={() => handleDelete(s.id)} className="px-1.5 py-0.5 text-[10px] rounded border border-red-200 text-red-500 hover:bg-red-50 ml-auto">삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {timedScheds.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium">시간 일정</div>
                  {timedScheds.map(s => (
                    <div key={s.id} className="flex gap-3">
                      <div className="text-xs font-medium text-sky-600 w-12 pt-3 text-right flex-shrink-0">
                        {fmtTime(s.scheduledHour, s.scheduledMinute)}
                      </div>
                      <div className="flex-1 rounded-lg p-3 border" style={{ borderLeftWidth: 4, borderLeftColor: getTFColor(s.tfName), backgroundColor: getTFColor(s.tfName) + '08' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getTFColor(s.tfName) }} />
                          <span className="text-xs font-medium" style={{ color: getTFColor(s.tfName) }}>{s.tfName}</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">{s.patientName} &nbsp;{s.clinicType} {s.examRound}차</div>
                        <div className="text-xs text-gray-500 mt-0.5">{s.hospitalName}</div>
                        <div className="flex gap-2 mt-2">
                          {(['scheduled','done','cancelled'] as const).map(st => (
                            <button key={st} onClick={() => handleStatusChange(s.id, st)}
                              className="px-1.5 py-0.5 text-[10px] rounded border transition-colors"
                              style={s.status === st ? { backgroundColor: STATUS_COLORS[st], color: '#fff', borderColor: STATUS_COLORS[st] } : { borderColor: '#ddd', color: '#666' }}
                            >{STATUS_LABELS[st]}</button>
                          ))}
                          <button onClick={() => handleDelete(s.id)} className="px-1.5 py-0.5 text-[10px] rounded border border-red-200 text-red-500 hover:bg-red-50 ml-auto">삭제</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* TF 범례 사이드바 */}
      {tfList.length > 0 && (
        <div className="w-36 flex-shrink-0">
          <div className="sticky top-4 border rounded-lg p-3 bg-white">
            <div className="text-[10px] font-semibold text-gray-500 mb-2">TF 범례</div>
            <div className="space-y-1.5">
              {tfList.map(tf => (
                <div key={tf} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getTFColor(tf) }} />
                  <span className="text-[10px] text-gray-700">{tf}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>{/* flex wrapper end */}

      {/* ── 말풍선 팝업 ── */}
      {selected && (
        <div ref={popupRef}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-[300px]"
          style={{
            left: popupPosition.x, top: popupPosition.y,
            animation: 'fadeInScale 0.15s ease-out',
          }}
        >
          <style>{`@keyframes fadeInScale { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }`}</style>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getTFColor(selected.tfName) }} />
                <span className="text-xs font-medium" style={{ color: getTFColor(selected.tfName) }}>{selected.tfName}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            <div className="text-sm font-bold text-gray-800">
              {selected.patientName} &nbsp;{selected.clinicType} {selected.examRound}차
            </div>

            <div className="text-xs text-gray-600">{selected.hospitalName}</div>

            <div className="text-xs text-gray-600">
              {selected.scheduledDate ? new Date(selected.scheduledDate).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }) : '-'}
              {!selected.isAllDay && ` ${fmtTime(selected.scheduledHour, selected.scheduledMinute)}`}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">상태:</span>
              <div className="flex gap-1">
                {(['scheduled','done','cancelled'] as const).map(st => (
                  <button key={st}
                    onClick={() => handleStatusChange(selected.id, st)}
                    className="px-1.5 py-0.5 text-[10px] rounded border transition-colors"
                    style={selected.status === st
                      ? { backgroundColor: STATUS_COLORS[st], color: '#fff', borderColor: STATUS_COLORS[st] }
                      : { borderColor: '#ddd', color: '#666' }
                    }
                  >
                    {STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>

            {selected.sender && (
              <div className="text-xs"><span className="text-gray-400">발신: </span>{selected.sender}</div>
            )}
            {selected.memo && (
              <div className="text-xs"><span className="text-gray-400">메모: </span><span className="whitespace-pre-wrap">{selected.memo}</span></div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => handleDelete(selected.id)}
                className="px-3 py-1 text-xs border border-red-300 text-red-500 rounded hover:bg-red-50">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수동 입력 모달 ── */}
      {showModal && (
        <InputModal
          onClose={() => { setShowModal(false); setManualDate('') }}
          onSaved={() => { setShowModal(false); setManualDate(''); load() }}
          modalTab={modalTab}
          setModalTab={setModalTab}
          tfList={tfList}
          defaultYear={year}
          defaultMonth={month}
          defaultDate={manualDate}
        />
      )}
    </div>
  )
}

// ─── 수동 입력 모달 ────────────────────────────────────────────────
function InputModal({
  onClose, onSaved, modalTab, setModalTab, tfList, defaultYear, defaultMonth, defaultDate,
}: {
  onClose: () => void
  onSaved: () => void
  modalTab: 'form' | 'paste'
  setModalTab: (t: 'form' | 'paste') => void
  tfList: string[]
  defaultYear: number
  defaultMonth: number
  defaultDate?: string
}) {
  // 직접 입력
  const [form, setForm] = useState({
    patientName: '', tfName: '', hospitalName: '', clinicType: '특진',
    examRound: 1, scheduledDate: defaultDate || `${defaultYear}-${pad(defaultMonth)}-01`,
    scheduledTime: '', memo: '',
  })
  const [saving, setSaving] = useState(false)

  // 텍스트 붙여넣기
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<{ parsed: number; saved: number } | null>(null)

  async function handleFormSave() {
    if (!form.patientName || !form.tfName || !form.hospitalName) { alert('필수 항목을 입력하세요'); return }
    setSaving(true)
    const hasTime = !!form.scheduledTime
    const [h, m] = hasTime ? form.scheduledTime.split(':').map(Number) : [null, null]
    const res = await fetch('/api/tf/special-clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: form.patientName,
        tfName: form.tfName,
        hospitalName: form.hospitalName,
        clinicType: form.clinicType,
        examRound: form.examRound,
        scheduledDate: new Date(form.scheduledDate),
        isAllDay: !hasTime,
        scheduledHour: h,
        scheduledMinute: m ?? 0,
        status: 'scheduled',
        memo: form.memo || null,
      }),
    })
    setSaving(false)
    if (res.ok) onSaved()
    else alert('저장 실패')
  }

  async function handleParse() {
    if (!pasteText.trim()) return
    setParsing(true)
    const res = await fetch('/api/tf/special-clinic/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: pasteText }),
    })
    setParsing(false)
    if (res.ok) {
      const data = await res.json()
      setParseResult(data)
      setTimeout(() => onSaved(), 1500)
    } else {
      alert('파싱 실패')
    }
  }

  const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:border-sky-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">특진 일정 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded">
          {[['form','직접 입력'] as const, ['paste','텍스트 붙여넣기'] as const].map(([id, label]) => (
            <button key={id} onClick={() => setModalTab(id)}
              className={`flex-1 py-1 text-xs rounded font-medium ${modalTab === id ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {modalTab === 'form' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">환자명 *</label>
                <input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500">TF명 *</label>
                <input list="tf-list" value={form.tfName} onChange={e => setForm(f => ({ ...f, tfName: e.target.value }))} className={inputCls} />
                <datalist id="tf-list">
                  {tfList.map(tf => <option key={tf} value={tf} />)}
                </datalist>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">병원명 *</label>
                <input value={form.hospitalName} onChange={e => setForm(f => ({ ...f, hospitalName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500">유형</label>
                <div className="flex gap-2 mt-1">
                  {['특진','재특진'].map(t => (
                    <label key={t} className="flex items-center gap-1 text-xs">
                      <input type="radio" name="clinicType" checked={form.clinicType === t}
                        onChange={() => setForm(f => ({ ...f, clinicType: t }))} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">회차</label>
                <select value={form.examRound} onChange={e => setForm(f => ({ ...f, examRound: Number(e.target.value) }))} className={inputCls}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}차</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">날짜</label>
                <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500">시간 (선택)</label>
                <input type="time" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className={`${inputCls} h-16`} />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleFormSave} disabled={saving}
                className="px-4 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {modalTab === 'paste' && (
          <div className="space-y-3">
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="텔레그램 메시지를 붙여넣으세요..."
              className={`${inputCls} h-48 font-mono text-xs`}
            />
            {parseResult && (
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                {parseResult.parsed}건 파싱 → {parseResult.saved}건 저장 완료
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={handleParse} disabled={parsing || !pasteText.trim()}
                className="px-4 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50">
                {parsing ? '파싱 중...' : '파싱 후 저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
