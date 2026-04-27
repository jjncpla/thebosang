'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getTFColor } from '@/lib/tf-colors'
import { TF_BY_BRANCH as FALLBACK_TF_BY_BRANCH, ALL_TF_LIST as FALLBACK_ALL_TF_LIST } from '@/lib/constants/tf'

// ─── 타입 ────────────────────────────────────────────────────────
interface Schedule {
  id: string
  patientName: string | null
  patientPhone: string | null
  tfName: string
  hospitalName: string | null
  clinicType: string | null
  category: string
  examRound: number | null
  title: string | null
  content: string | null
  scheduledDate: string | null
  isAllDay: boolean
  scheduledHour: number | null
  scheduledMinute: number | null
  status: string
  sender: string | null
  sourceDate: string | null
  rawMessage: string | null
  memo: string | null
  assignedStaff: string | null
  attended: boolean | null
  isPickup: boolean | null
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
const CATEGORIES = ['특진', '재특진', '영업', '자료보완', '교육', '회의', '장해진단', '질판위', '상담', '약정', '기타'] as const
const FREEFORM_CATEGORIES = ['영업', '자료보완', '교육', '회의', '장해진단', '질판위', '상담', '약정', '기타'] as const
const CATEGORY_COLORS: Record<string, string> = {
  '특진': '',       // TF 색상 사용
  '재특진': '',     // TF 색상 사용
  '영업': '#10B981',
  '자료보완': '#F59E0B',
  '교육': '#8B5CF6',
  '회의': '#9B59B6',
  '장해진단': '#0D9488',
  '질판위': '#DC2626',
  '상담': '#0EA5E9',
  '약정': '#EC4899',
  '기타': '#95A5A6',
}
function isFreeform(category: string) {
  return (FREEFORM_CATEGORIES as readonly string[]).includes(category)
}
function eventColor(s: Schedule, colorMap?: Record<string, string>) {
  if (isFreeform(s.category)) return CATEGORY_COLORS[s.category] || '#95A5A6'
  return getTFColor(s.tfName, colorMap)
}
function eventTitle(s: Schedule) {
  if (isFreeform(s.category)) return s.title || s.category
  return s.patientName || ''
}
/** 특진/재특진 일정의 담당자 라벨 — 없으면 '미배정' */
function attendeeLabel(s: Schedule): string {
  if (isFreeform(s.category)) return ''
  const n = (s.assignedStaff ?? '').trim()
  return n || '미배정'
}

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
  const [selectedTFs, setSelectedTFs] = useState<string[]>([])
  const [tfPanelOpen, setTfPanelOpen] = useState(false)
  const tfPanelRef = useRef<HTMLDivElement>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branchPanelOpen, setBranchPanelOpen] = useState(false)
  const branchPanelRef = useRef<HTMLDivElement>(null)
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false)
  const categoryPanelRef = useRef<HTMLDivElement>(null)
  const [hospitalFilters, setHospitalFilters] = useState<string[]>([])
  const [hospitalPanelOpen, setHospitalPanelOpen] = useState(false)
  const hospitalPanelRef = useRef<HTMLDivElement>(null)
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [statusPanelOpen, setStatusPanelOpen] = useState(false)
  const statusPanelRef = useRef<HTMLDivElement>(null)
  const [staffFilters, setStaffFilters] = useState<string[]>([])
  const [staffPanelOpen, setStaffPanelOpen] = useState(false)
  const staffPanelRef = useRef<HTMLDivElement>(null)
  const [staffSearch, setStaffSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Schedule | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'form' | 'paste'>('form')
  const [editTarget, setEditTarget] = useState<Schedule | null>(null)

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
  // DB에서 지사별 색상 맵 (Branch.colorBase) 로드
  const [branchColorMap, setBranchColorMap] = useState<Record<string, string>>({})
  useEffect(() => {
    fetch('/api/tf-color-map')
      .then(r => r.ok ? r.json() : {})
      .then((m: Record<string, string>) => { if (m && typeof m === 'object') setBranchColorMap(m) })
      .catch(() => {})
  }, [])

  // DB에서 지사-TF 맵 로드 — admin/branches/tf 변경이 즉시 반영됨
  const [dbTfByBranch, setDbTfByBranch] = useState<Record<string, string[]> | null>(null)
  useEffect(() => {
    fetch('/api/branches-tf-map')
      .then(r => r.ok ? r.json() : null)
      .then((data: { branches?: Array<{ name: string; tfs: string[] }> } | null) => {
        if (!data?.branches) return
        const map: Record<string, string[]> = {}
        for (const b of data.branches) map[b.name] = b.tfs
        setDbTfByBranch(map)
      })
      .catch(() => {})
  }, [])
  // DB 로드 전엔 하드코딩 fallback 사용
  const TF_BY_BRANCH = dbTfByBranch ?? FALLBACK_TF_BY_BRANCH
  const ALL_TF_LIST = dbTfByBranch ? Object.values(dbTfByBranch).flat() : FALLBACK_ALL_TF_LIST

  // URL 동기화
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('year', String(year))
    params.set('month', String(month))
    router.replace(`/tf/special-clinic?${params}`, { scroll: false })
  }, [year, month, router])

  // 검색 debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // TF 패널 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tfPanelRef.current && !tfPanelRef.current.contains(e.target as Node)) setTfPanelOpen(false)
    }
    if (tfPanelOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tfPanelOpen])

  // 지사 패널 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (branchPanelRef.current && !branchPanelRef.current.contains(e.target as Node)) setBranchPanelOpen(false)
    }
    if (branchPanelOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [branchPanelOpen])

  // 카테고리 패널 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryPanelRef.current && !categoryPanelRef.current.contains(e.target as Node)) setCategoryPanelOpen(false)
    }
    if (categoryPanelOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [categoryPanelOpen])

  // 병원 패널 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (hospitalPanelRef.current && !hospitalPanelRef.current.contains(e.target as Node)) setHospitalPanelOpen(false)
    }
    if (hospitalPanelOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [hospitalPanelOpen])

  // 상태 패널 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusPanelRef.current && !statusPanelRef.current.contains(e.target as Node)) setStatusPanelOpen(false)
    }
    if (statusPanelOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [statusPanelOpen])

  // 담당자 패널 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (staffPanelRef.current && !staffPanelRef.current.contains(e.target as Node)) setStaffPanelOpen(false)
    }
    if (staffPanelOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [staffPanelOpen])

  // 데이터 로드 (전체 — 프론트에서 필터링)
  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({
      month: `${year}-${pad(month)}`,
      status: 'all',
    })
    const res = await fetch(`/api/tf/special-clinic?${qs}`)
    if (res.ok) {
      const data = await res.json()
      setSchedules(data)
    }
    setLoading(false)
  }, [year, month])

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

  // TF 목록 — 전체 TF (더보상TF 포함), 실제 데이터 여부 무관
  const tfList = ALL_TF_LIST.slice().sort()

  // 지사 목록 (단축명)
  const BRANCH_SHORT: Record<string, string> = Object.keys(TF_BY_BRANCH).reduce((acc, b) => {
    const short = b.replace('노무법인 더보상 ', '').replace('노무법인 더보상', '본사')
    acc[b] = short
    return acc
  }, {} as Record<string, string>)
  const branchList = Object.keys(TF_BY_BRANCH)

  // 지사 선택 핸들러
  function selectBranch(branch: string) {
    if (selectedBranch === branch) {
      setSelectedBranch('')
      setSelectedTFs([])
    } else {
      setSelectedBranch(branch)
      setSelectedTFs(TF_BY_BRANCH[branch] || [])
    }
    setBranchPanelOpen(false)
  }
  const branchButtonLabel = selectedBranch ? BRANCH_SHORT[selectedBranch] || selectedBranch : '지사 선택'

  // 이달 병원 목록 (특진/재특진만, 가나다 정렬)
  const hospitalList = [...new Set(
    schedules.filter(s => s.hospitalName && !isFreeform(s.category)).map(s => s.hospitalName!)
  )].sort((a, b) => a.localeCompare(b, 'ko'))

  // 이달 담당자 목록 (특진/재특진 assignedStaff, 가나다 정렬)
  const staffList = [...new Set(
    schedules
      .filter(s => !isFreeform(s.category) && s.assignedStaff && s.assignedStaff.trim())
      .map(s => s.assignedStaff!.trim())
  )].sort((a, b) => a.localeCompare(b, 'ko'))

  // 프론트 필터링 (TF 복수선택 + 카테고리 + 병원 + 상태 + 담당자 + 검색)
  const filteredSchedules = schedules.filter(s => {
    if (selectedTFs.length > 0 && !selectedTFs.includes(s.tfName)) return false
    if (categoryFilters.length > 0 && !categoryFilters.includes(s.category) && !categoryFilters.includes(s.clinicType ?? '')) return false
    if (hospitalFilters.length > 0 && (!s.hospitalName || !hospitalFilters.includes(s.hospitalName))) return false
    if (statusFilters.length > 0 && !statusFilters.includes(s.status)) return false
    if (staffFilters.length > 0) {
      // '미배정' 가상 항목 지원 — assignedStaff가 비어있으면 매칭
      const staff = s.assignedStaff?.trim() || ''
      const matchUnassigned = staffFilters.includes('__UNASSIGNED__') && !staff
      const matchNamed = staff && staffFilters.includes(staff)
      if (!matchUnassigned && !matchNamed) return false
    }
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase()
      const haystack = [s.patientName, s.hospitalName, s.tfName, s.memo, s.title, s.content, s.assignedStaff].filter(Boolean) as string[]
      if (!haystack.some(f => f.toLowerCase().includes(q))) return false
    }
    return true
  })

  // 검색 결과 (전체 데이터 기반 — 캘린더에 표시되는 건 filteredSchedules)
  const searchResults = debouncedQuery
    ? schedules.filter(s => {
        const haystack = [s.patientName, s.hospitalName, s.tfName, s.memo, s.title, s.content].filter(Boolean) as string[]
        return haystack.some(f => f.toLowerCase().includes(debouncedQuery.toLowerCase()))
      })
    : []

  // TF 선택 토글
  function toggleTF(tf: string) {
    setSelectedTFs(prev => prev.includes(tf) ? prev.filter(t => t !== tf) : [...prev, tf])
  }
  const tfButtonLabel = selectedTFs.length === 0 ? '전체 TF'
    : selectedTFs.length === 1 ? selectedTFs[0]
    : `${selectedTFs[0]} 외 ${selectedTFs.length - 1}개`

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
    return filteredSchedules.filter(s => {
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
    return filteredSchedules.filter(s => s.scheduledDate && isSameDay(new Date(s.scheduledDate), d))
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
        <h1 className="text-lg font-bold text-gray-800">TF업무 &gt; 통합 캘린더</h1>
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

        {/* 지사 선택 드롭다운 */}
        <div className="relative" ref={branchPanelRef}>
          <button
            onClick={() => setBranchPanelOpen(p => !p)}
            className={`border rounded px-2 py-1 text-xs flex items-center gap-1 hover:bg-gray-50 ${selectedBranch ? 'bg-orange-50 border-orange-300 text-orange-700' : ''}`}
          >
            {branchButtonLabel} <span className="text-gray-400">▼</span>
          </button>
          {branchPanelOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg z-40 w-52 py-1 max-h-72 overflow-y-auto">
              <div className="px-2 py-1 border-b">
                <button onClick={() => { setSelectedBranch(''); setSelectedTFs([]); setBranchPanelOpen(false) }} className="text-[10px] text-sky-500 hover:underline">전체 초기화</button>
              </div>
              {branchList.map(branch => (
                <button
                  key={branch}
                  onClick={() => selectBranch(branch)}
                  className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between ${selectedBranch === branch ? 'bg-orange-50 text-orange-700 font-medium' : ''}`}
                >
                  <span>{BRANCH_SHORT[branch]}</span>
                  <span className="text-gray-400 text-[10px]">{TF_BY_BRANCH[branch].length}개</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TF 복수선택 드롭다운 */}
        <div className="relative" ref={tfPanelRef}>
          <button
            onClick={() => setTfPanelOpen(p => !p)}
            className="border rounded px-2 py-1 text-xs flex items-center gap-1 hover:bg-gray-50"
          >
            {tfButtonLabel} <span className="text-gray-400">▼</span>
          </button>
          {tfPanelOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg z-40 w-52 py-1 max-h-80 overflow-y-auto">
              <div className="flex gap-1 px-2 py-1 border-b">
                <button onClick={() => { setSelectedTFs([]); setSelectedBranch('') }} className="text-[10px] text-sky-500 hover:underline">전체</button>
                <button onClick={() => setSelectedTFs([...tfList])} className="text-[10px] text-sky-500 hover:underline">모두 선택</button>
              </div>
              {/* 지사별 그룹 */}
              {branchList.map(branch => (
                <div key={branch}>
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] text-gray-400 font-medium bg-gray-50 border-b border-gray-100">
                    {BRANCH_SHORT[branch]}
                  </div>
                  {TF_BY_BRANCH[branch].map(tf => (
                    <label key={tf} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                      <input type="checkbox" checked={selectedTFs.includes(tf)} onChange={() => { toggleTF(tf); setSelectedBranch('') }} className="rounded" />
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: getTFColor(tf, branchColorMap) }} />
                      {tf}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 카테고리 복수선택 드롭다운 */}
        <div className="relative" ref={categoryPanelRef}>
          <button
            onClick={() => setCategoryPanelOpen(p => !p)}
            className={`border rounded px-2 py-1 text-xs flex items-center gap-1 hover:bg-gray-50 ${categoryFilters.length > 0 ? 'bg-purple-50 border-purple-300 text-purple-700' : ''}`}
          >
            {categoryFilters.length === 0
              ? '전체 카테고리'
              : categoryFilters.length === 1
                ? categoryFilters[0]
                : `${categoryFilters[0]} 외 ${categoryFilters.length - 1}개`}
            {' '}<span className="text-gray-400">▼</span>
          </button>
          {categoryPanelOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg z-40 w-40 py-1">
              <div className="px-2 py-1 border-b">
                <button onClick={() => setCategoryFilters([])} className="text-[10px] text-sky-500 hover:underline">전체 초기화</button>
              </div>
              {CATEGORIES.map(c => (
                <label key={c} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={categoryFilters.includes(c)}
                    onChange={() => setCategoryFilters(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                    className="rounded"
                  />
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[c] || '#64748B' }} />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 병원 복수선택 드롭다운 */}
        <div className="relative" ref={hospitalPanelRef}>
          <button
            onClick={() => setHospitalPanelOpen(p => !p)}
            className={`border rounded px-2 py-1 text-xs flex items-center gap-1 hover:bg-gray-50 ${hospitalFilters.length > 0 ? 'bg-teal-50 border-teal-300 text-teal-700' : ''}`}
          >
            {hospitalFilters.length === 0
              ? '전체 병원'
              : hospitalFilters.length === 1
                ? hospitalFilters[0].length > 8 ? hospitalFilters[0].slice(0, 8) + '…' : hospitalFilters[0]
                : `${hospitalFilters[0].length > 6 ? hospitalFilters[0].slice(0, 6) + '…' : hospitalFilters[0]} 외 ${hospitalFilters.length - 1}개`}
            {' '}<span className="text-gray-400">▼</span>
          </button>
          {hospitalPanelOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg z-40 w-56 py-1">
              <div className="px-2 py-1 border-b flex items-center justify-between gap-2">
                <button onClick={() => { setHospitalFilters([]); setHospitalSearch('') }} className="text-[10px] text-sky-500 hover:underline flex-shrink-0">전체 초기화</button>
                <input
                  value={hospitalSearch}
                  onChange={e => setHospitalSearch(e.target.value)}
                  placeholder="병원명 검색..."
                  className="border border-gray-200 rounded px-1.5 py-0.5 text-[10px] w-full focus:outline-none focus:border-sky-300"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {hospitalList.length === 0 ? (
                <div className="px-3 py-2 text-[10px] text-gray-400">이달 특진/재특진 일정 없음</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {hospitalList
                    .filter(h => !hospitalSearch || h.toLowerCase().includes(hospitalSearch.toLowerCase()))
                    .map(h => (
                    <label key={h} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={hospitalFilters.includes(h)}
                        onChange={() => setHospitalFilters(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h])}
                        className="rounded flex-shrink-0"
                      />
                      <span className="truncate" title={h}>{h}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 상태 복수선택 드롭다운 */}
        <div className="relative" ref={statusPanelRef}>
          <button
            onClick={() => setStatusPanelOpen(p => !p)}
            className={`border rounded px-2 py-1 text-xs flex items-center gap-1 hover:bg-gray-50 ${statusFilters.length > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
          >
            {statusFilters.length === 0
              ? '전체 상태'
              : statusFilters.map(s => STATUS_LABELS[s] ?? s).join(' · ')}
            {' '}<span className="text-gray-400">▼</span>
          </button>
          {statusPanelOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg z-40 w-32 py-1">
              <div className="px-2 py-1 border-b">
                <button onClick={() => setStatusFilters([])} className="text-[10px] text-sky-500 hover:underline">전체 초기화</button>
              </div>
              {(['scheduled', 'done', 'cancelled', 'unknown'] as const).map(st => (
                <label key={st} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(st)}
                    onChange={() => setStatusFilters(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st])}
                    className="rounded"
                  />
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[st] }} />
                  {STATUS_LABELS[st]}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 담당자 복수선택 드롭다운 */}
        <div className="relative" ref={staffPanelRef}>
          <button
            onClick={() => setStaffPanelOpen(p => !p)}
            className={`border rounded px-2 py-1 text-xs flex items-center gap-1 hover:bg-gray-50 ${staffFilters.length > 0 ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}`}
          >
            {staffFilters.length === 0
              ? '전체 담당자'
              : staffFilters.length === 1
                ? (staffFilters[0] === '__UNASSIGNED__' ? '미배정' : staffFilters[0])
                : `${staffFilters[0] === '__UNASSIGNED__' ? '미배정' : staffFilters[0]} 외 ${staffFilters.length - 1}명`}
            {' '}<span className="text-gray-400">▼</span>
          </button>
          {staffPanelOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg z-40 w-56 py-1">
              <div className="flex gap-1 px-2 py-1 border-b">
                <button onClick={() => setStaffFilters([])} className="text-[10px] text-sky-500 hover:underline">전체 초기화</button>
                <button onClick={() => setStaffFilters([...staffList])} className="text-[10px] text-sky-500 hover:underline ml-auto">모두 선택</button>
              </div>
              <div className="px-2 py-1 border-b">
                <input
                  type="text"
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  placeholder="담당자 검색..."
                  className="w-full border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {/* 미배정 */}
                {(!staffSearch || '미배정'.includes(staffSearch)) && (
                  <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={staffFilters.includes('__UNASSIGNED__')}
                      onChange={() => setStaffFilters(prev => prev.includes('__UNASSIGNED__')
                        ? prev.filter(x => x !== '__UNASSIGNED__')
                        : [...prev, '__UNASSIGNED__']
                      )}
                      className="rounded"
                    />
                    <span className="italic text-gray-400">미배정</span>
                  </label>
                )}
                {staffList.length === 0 && (
                  <div className="px-2 py-2 text-[11px] text-gray-400 text-center">이달 등록된 담당자 없음</div>
                )}
                {staffList
                  .filter(name => !staffSearch || name.toLowerCase().includes(staffSearch.toLowerCase()))
                  .map(name => (
                    <label key={name} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={staffFilters.includes(name)}
                        onChange={() => setStaffFilters(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])}
                        className="rounded"
                      />
                      <span>{name}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        {loading && <span className="text-xs text-gray-400">로딩...</span>}

        <div className="ml-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="재해자명, 병원명, TF명, 담당자 검색..."
            className="border rounded px-2 py-1 text-xs w-60 focus:outline-none focus:border-sky-400"
          />
        </div>
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
                      {(isExpanded ? daySchedules : daySchedules.slice(0, maxShow)).map(s => {
                        const free = isFreeform(s.category)
                        const color = eventColor(s, branchColorMap)
                        return (
                        <button
                          key={s.id}
                          draggable
                          onDragStart={() => setDraggedEventId(s.id)}
                          onDragEnd={() => setDraggedEventId(null)}
                          onClick={(e) => handleEventClick(s, e)}
                          className="w-full text-left mb-0.5 rounded px-1 py-0.5 cursor-pointer transition-all hover:brightness-95"
                          style={{
                            backgroundColor: color + '18',
                            borderLeft: `3px solid ${color}`,
                            opacity: draggedEventId === s.id ? 0.4 : 1,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-[10px] font-medium truncate text-gray-800">{eventTitle(s)}</span>
                          </div>
                          {free ? (
                            <div className="text-[9px] text-gray-500 truncate pl-2.5">
                              {s.category}{s.tfName ? ` · ${s.tfName}` : ''} {fmtTime(s.scheduledHour, s.scheduledMinute)}
                            </div>
                          ) : (
                            <>
                              <div className="text-[9px] text-gray-500 truncate pl-2.5">
                                {s.clinicType} {s.examRound}차 {fmtTime(s.scheduledHour, s.scheduledMinute)}
                                {s.isPickup && <span className="ml-1 text-amber-600">🚗</span>}
                              </div>
                              <div className="text-[9px] text-gray-400 truncate pl-2.5">
                                <span className={!s.assignedStaff ? 'italic text-gray-300' : ''}>{attendeeLabel(s)}</span>
                                {s.hospitalName && <span className="ml-1 text-gray-400">· {s.hospitalName}</span>}
                              </div>
                            </>
                          )}
                        </button>
                        )
                      })}
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
              const wdSchedules = filteredSchedules.filter(s => s.scheduledDate && isSameDay(new Date(s.scheduledDate), wd))
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
                    {wdSchedules.map(s => {
                      const free = isFreeform(s.category)
                      const color = eventColor(s, branchColorMap)
                      return (
                      <button
                        key={s.id}
                        draggable
                        onDragStart={() => setDraggedEventId(s.id)}
                        onDragEnd={() => setDraggedEventId(null)}
                        onClick={(e) => handleEventClick(s, e)}
                        className="w-full text-left rounded px-1 py-0.5 cursor-pointer transition-all hover:brightness-95"
                        style={{
                          backgroundColor: color + '18',
                          borderLeft: `3px solid ${color}`,
                          opacity: draggedEventId === s.id ? 0.4 : 1,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-[10px] font-medium truncate text-gray-800">{eventTitle(s)}</span>
                        </div>
                        {free ? (
                          <div className="text-[9px] text-gray-500 truncate pl-2.5">
                            {s.category}{s.tfName ? ` · ${s.tfName}` : ''}
                          </div>
                        ) : (
                          <>
                            <div className="text-[9px] text-gray-500 pl-2.5">
                              {s.clinicType} {s.examRound}차
                              {s.isPickup && <span className="ml-1 text-amber-600">🚗</span>}
                            </div>
                            <div className="text-[9px] text-gray-400 truncate pl-2.5">
                              <span className={!s.assignedStaff ? 'italic text-gray-300' : ''}>{attendeeLabel(s)}</span>
                              {s.hospitalName && <span className="ml-1">· {s.hospitalName}</span>}
                            </div>
                          </>
                        )}
                        {!s.isAllDay && s.scheduledHour != null && (
                          <div className="text-[9px] text-sky-600 pl-2.5 font-medium">
                            {fmtTime(s.scheduledHour, s.scheduledMinute)}
                          </div>
                        )}
                      </button>
                      )
                    })}
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
                  {allDayScheds.map(s => {
                    const free = isFreeform(s.category)
                    const color = eventColor(s, branchColorMap)
                    return (
                    <div key={s.id} className="rounded-lg p-3 border" style={{ borderLeftWidth: 4, borderLeftColor: color, backgroundColor: color + '08' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium" style={{ color }}>
                          {free ? s.category : s.tfName}
                        </span>
                        {free && s.tfName && <span className="text-xs text-gray-400">· {s.tfName}</span>}
                      </div>
                      {free ? (
                        <>
                          <div className="text-sm font-bold text-gray-800">{eventTitle(s)}</div>
                          {s.content && <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{s.content}</div>}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-800">{s.patientName} &nbsp;{s.clinicType} {s.examRound}차</span>
                            {s.patientPhone && <span className="text-xs text-gray-500">{s.patientPhone}</span>}
                            {s.isPickup && <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🚗 픽업</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            담당: <span className={!s.assignedStaff ? 'italic text-gray-400' : ''}>{attendeeLabel(s)}</span>
                            {s.hospitalName && <> · {s.hospitalName}</>}
                          </div>
                        </>
                      )}
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
                    )
                  })}
                </div>
              )}

              {timedScheds.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium">시간 일정</div>
                  {timedScheds.map(s => {
                    const free = isFreeform(s.category)
                    const color = eventColor(s, branchColorMap)
                    return (
                    <div key={s.id} className="flex gap-3">
                      <div className="text-xs font-medium text-sky-600 w-12 pt-3 text-right flex-shrink-0">
                        {fmtTime(s.scheduledHour, s.scheduledMinute)}
                      </div>
                      <div className="flex-1 rounded-lg p-3 border" style={{ borderLeftWidth: 4, borderLeftColor: color, backgroundColor: color + '08' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium" style={{ color }}>
                            {free ? s.category : s.tfName}
                          </span>
                          {free && s.tfName && <span className="text-xs text-gray-400">· {s.tfName}</span>}
                        </div>
                        {free ? (
                          <>
                            <div className="text-sm font-bold text-gray-800">{eventTitle(s)}</div>
                            {s.content && <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{s.content}</div>}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-gray-800">{s.patientName} &nbsp;{s.clinicType} {s.examRound}차</span>
                              {s.patientPhone && <span className="text-xs text-gray-500">{s.patientPhone}</span>}
                              {s.isPickup && <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🚗 픽업</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              담당: <span className={!s.assignedStaff ? 'italic text-gray-400' : ''}>{attendeeLabel(s)}</span>
                              {s.hospitalName && <> · {s.hospitalName}</>}
                            </div>
                          </>
                        )}
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
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* TF 범례 사이드바 — 더보상 / 이산 구분 */}
      {(() => {
        // 범례는 항상 등록된 전체 TF를 표시 — 지사 선택·필터와 독립적
        //   (1) TF_BY_BRANCH에 등록된 모든 TF (관할 기준)
        //   (2) 현재 월 일정에 있지만 관할 미등록 orphan TF (데이터 보정 여지 노출)
        // 선택 상태는 opacity로만 구분 (아래 isActive 참고)
        const allRegistered = Object.values(TF_BY_BRANCH).flat() as string[]
        const allRegisteredSet = new Set(allRegistered)
        const orphanFromSchedules = schedules
          .map(s => s.tfName)
          .filter((t): t is string => !!t && !allRegisteredSet.has(t))
        const activeTfs = [...new Set([...allRegistered, ...orphanFromSchedules])].sort()
        if (activeTfs.length === 0) return null
        const bosangTfs = activeTfs.filter(tf => !tf.startsWith('이산'))
        const isanTfs = activeTfs.filter(tf => tf.startsWith('이산'))
        function TFItem({ tf }: { tf: string }) {
          const isActive = selectedTFs.length === 0 || selectedTFs.includes(tf)
          return (
            <div
              onClick={() => { toggleTF(tf); setSelectedBranch('') }}
              className="flex items-center gap-1 cursor-pointer hover:bg-gray-50 rounded px-0.5 -mx-0.5 min-w-0"
              style={{ opacity: isActive ? 1 : 0.35 }}
              title={tf}
            >
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getTFColor(tf, branchColorMap) }} />
              <span className="text-[10px] text-gray-700 truncate">{tf}</span>
            </div>
          )
        }
        return (
          <div className="w-60 flex-shrink-0">
            <div className="sticky top-4 border rounded-lg p-3 bg-white space-y-3">
              {bosangTfs.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />더보상
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {bosangTfs.map(tf => <TFItem key={tf} tf={tf} />)}
                  </div>
                </div>
              )}
              {bosangTfs.length > 0 && isanTfs.length > 0 && (
                <div className="border-t border-gray-100" />
              )}
              {isanTfs.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />이산
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {isanTfs.map(tf => <TFItem key={tf} tf={tf} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
      </div>{/* flex wrapper end */}

      {/* 검색 결과 목록 */}
      {debouncedQuery && searchResults.length > 0 && (
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-600">
            검색 결과: &quot;{debouncedQuery}&quot; — {searchResults.length}건
          </div>
          <div className="max-h-48 overflow-y-auto">
            {searchResults.map(s => {
              const free = isFreeform(s.category)
              return (
              <button key={s.id}
                onClick={() => {
                  if (s.scheduledDate) {
                    const d = new Date(s.scheduledDate)
                    setYear(d.getFullYear())
                    setMonth(d.getMonth() + 1)
                  }
                  setSelected(s)
                  setPopupPosition({ x: window.innerWidth / 2 - 150, y: 200 })
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-sky-50 border-b last:border-b-0 flex items-center gap-3"
              >
                <span className="text-gray-400 min-w-[90px]">
                  {s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString('ko-KR') : '-'}
                </span>
                <span className="font-medium text-gray-800">{eventTitle(s)}</span>
                {free ? (
                  <>
                    <span className="text-gray-500">{s.category}</span>
                    {s.content && <span className="text-gray-400 truncate">{s.content.slice(0, 40)}</span>}
                  </>
                ) : (
                  <>
                    <span className="text-gray-500">{s.clinicType} {s.examRound}차</span>
                    <span className="text-gray-400 truncate">{s.hospitalName}</span>
                    <span className={`text-[11px] ${s.assignedStaff ? 'text-gray-500' : 'text-gray-300 italic'}`}>{attendeeLabel(s)}</span>
                    {s.isPickup && <span className="text-[10px] text-amber-600">🚗</span>}
                  </>
                )}
                <span className="ml-auto text-[10px]" style={{ color: eventColor(s, branchColorMap) }}>{s.tfName || s.category}</span>
              </button>
              )
            })}
          </div>
        </div>
      )}
      {debouncedQuery && searchResults.length === 0 && (
        <div className="text-center py-3 text-gray-400 text-xs border rounded-lg">
          &quot;{debouncedQuery}&quot;에 대한 검색 결과가 없습니다
        </div>
      )}

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
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColor(selected, branchColorMap) }} />
                <span className="text-xs font-medium" style={{ color: eventColor(selected, branchColorMap) }}>
                  {isFreeform(selected.category) ? selected.category : selected.tfName}
                </span>
                {isFreeform(selected.category) && selected.tfName && (
                  <span className="text-xs text-gray-400">· {selected.tfName}</span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            {isFreeform(selected.category) ? (
              <>
                <div className="text-sm font-bold text-gray-800">{eventTitle(selected)}</div>
                {selected.content && (
                  <div className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-2 max-h-40 overflow-y-auto">
                    {selected.content}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-gray-800">
                    {selected.patientName} &nbsp;{selected.clinicType} {selected.examRound}차
                  </span>
                  {selected.isPickup && <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🚗 픽업</span>}
                </div>
                <div className="text-xs text-gray-600">{selected.hospitalName}</div>
                <div className="text-xs text-gray-600">
                  담당: <span className={!selected.assignedStaff ? 'italic text-gray-400' : ''}>{attendeeLabel(selected)}</span>
                </div>
              </>
            )}

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
              <button onClick={() => { setEditTarget(selected); setSelected(null); setShowModal(true); setModalTab('form') }}
                className="px-3 py-1 text-xs border border-sky-300 text-sky-600 rounded hover:bg-sky-50">
                수정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수동 입력 / 수정 모달 ── */}
      {showModal && (
        <InputModal
          onClose={() => { setShowModal(false); setManualDate(''); setEditTarget(null) }}
          onSaved={() => { setShowModal(false); setManualDate(''); setEditTarget(null); load() }}
          modalTab={modalTab}
          setModalTab={setModalTab}
          tfList={tfList}
          defaultYear={year}
          defaultMonth={month}
          defaultDate={manualDate}
          editTarget={editTarget ?? undefined}
        />
      )}
    </div>
  )
}

// ─── 수동 입력 모달 ────────────────────────────────────────────────
function InputModal({
  onClose, onSaved, modalTab, setModalTab, tfList, defaultYear, defaultMonth, defaultDate, editTarget,
}: {
  onClose: () => void
  onSaved: () => void
  modalTab: 'form' | 'paste'
  setModalTab: (t: 'form' | 'paste') => void
  tfList: string[]
  defaultYear: number
  defaultMonth: number
  defaultDate?: string
  editTarget?: Schedule
}) {
  // 직접 입력 — 수정 모드일 때 editTarget 값으로 초기화
  function initForm(target?: Schedule) {
    if (target) {
      const d = target.scheduledDate ? new Date(target.scheduledDate) : null
      const dateStr = d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${defaultYear}-${pad(defaultMonth)}-01`
      const timeStr = !target.isAllDay && target.scheduledHour != null
        ? `${pad(target.scheduledHour)}:${pad(target.scheduledMinute ?? 0)}`
        : ''
      return {
        category: target.category || '특진',
        tfName: target.tfName || '',
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        memo: target.memo || '',
        patientName: target.patientName || '',
        hospitalName: target.hospitalName || '',
        clinicType: target.clinicType || '특진',
        examRound: target.examRound ?? 1,
        title: target.title || '',
        content: target.content || '',
        assignedStaff: target.assignedStaff || '',
        attended: target.attended ?? null,
        isPickup: target.isPickup ?? false,
      }
    }
    return {
      category: '특진',
      tfName: '',
      scheduledDate: defaultDate || `${defaultYear}-${pad(defaultMonth)}-01`,
      scheduledTime: '',
      memo: '',
      patientName: '',
      hospitalName: '',
      clinicType: '특진',
      examRound: 1,
      title: '',
      content: '',
      assignedStaff: '',
      attended: null as boolean | null,
      isPickup: false,
    }
  }
  const [form, setForm] = useState(() => initForm(editTarget))
  const [saving, setSaving] = useState(false)

  // 텍스트 붙여넣기
  const [pasteText, setPasteText] = useState('')
  const [pasteTfOrg, setPasteTfOrg] = useState<'이산' | '더보상' | 'neutral'>('neutral')
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<{ parsed: number; saved: number } | null>(null)

  const free = isFreeform(form.category)

  async function handleFormSave() {
    if (free) {
      if (!form.title.trim()) { alert('제목을 입력하세요'); return }
    } else {
      if (!form.patientName || !form.tfName || !form.hospitalName) { alert('필수 항목을 입력하세요'); return }
    }
    setSaving(true)
    const hasTime = !!form.scheduledTime
    const [h, m] = hasTime ? form.scheduledTime.split(':').map(Number) : [null, null]

    const payload: Record<string, unknown> = {
      category: form.category,
      tfName: form.tfName || '',
      scheduledDate: new Date(form.scheduledDate),
      isAllDay: !hasTime,
      scheduledHour: h,
      scheduledMinute: m ?? 0,
      memo: form.memo || null,
    }
    if (!editTarget) payload.status = 'scheduled'

    if (free) {
      Object.assign(payload, {
        title: form.title.trim(),
        content: form.content || null,
        patientName: null,
        hospitalName: null,
        clinicType: null,
        examRound: null,
      })
    } else {
      Object.assign(payload, {
        patientName: form.patientName,
        hospitalName: form.hospitalName,
        clinicType: form.clinicType,
        examRound: form.examRound,
        assignedStaff: form.assignedStaff || null,
        attended: form.attended,
        isPickup: form.isPickup ?? false,
        title: null,
        content: null,
      })
    }

    const url = editTarget ? `/api/tf/special-clinic/${editTarget.id}` : '/api/tf/special-clinic'
    const method = editTarget ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
      body: JSON.stringify({ text: pasteText, tfOrg: pasteTfOrg }),
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
          <h2 className="text-sm font-bold">{editTarget ? '일정 수정' : '일정 등록'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* 탭 — 수정 모드에서는 붙여넣기 탭 숨김 */}
        {!editTarget && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded">
            {[['form','직접 입력'] as const, ['paste','텍스트 붙여넣기'] as const].map(([id, label]) => (
              <button key={id} onClick={() => setModalTab(id)}
                className={`flex-1 py-1 text-xs rounded font-medium ${modalTab === id ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {modalTab === 'form' && (
          <div className="space-y-3">
            {/* 카테고리 선택 (최상단) */}
            <div>
              <label className="text-xs text-gray-500">카테고리 *</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {CATEGORIES.map(c => {
                  const active = form.category === c
                  const color = CATEGORY_COLORS[c] || '#64748B'
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        category: c,
                        // 특진/재특진 선택 시 clinicType도 동기화
                        clinicType: c === '특진' || c === '재특진' ? c : f.clinicType,
                      }))}
                      className="px-2 py-1 text-xs rounded border transition-colors"
                      style={active
                        ? { backgroundColor: color, color: '#fff', borderColor: color }
                        : { borderColor: '#ddd', color: '#555' }}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>

            {!free && (
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
                          onChange={() => setForm(f => ({ ...f, clinicType: t, category: t }))} />
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
                <div>
                  <label className="text-xs text-gray-500">담당자</label>
                  <input value={form.assignedStaff} onChange={e => setForm(f => ({ ...f, assignedStaff: e.target.value }))} placeholder="참석 담당자명" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">참석 여부</label>
                  <div className="flex gap-3 mt-1.5">
                    {([['true', '참석'], ['false', '불참'], ['', '미정']] as const).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="radio" name="attended" checked={form.attended === (val === '' ? null : val === 'true')}
                          onChange={() => setForm(f => ({ ...f, attended: val === '' ? null : val === 'true' }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={!!form.isPickup}
                      onChange={e => setForm(f => ({ ...f, isPickup: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>🚗 <b>픽업 필요</b></span>
                    <span className="text-[11px] text-gray-500 ml-auto">
                      사건 상세 페이지의 {form.clinicType} {form.examRound}차 픽업과 동기화
                    </span>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">메모</label>
                  <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className={`${inputCls} h-16`} />
                </div>
              </div>
            )}

            {free && (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">제목 *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={`${form.category} 일정 제목을 입력하세요`}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">TF명 (선택)</label>
                  <input
                    list="tf-list"
                    value={form.tfName}
                    onChange={e => setForm(f => ({ ...f, tfName: e.target.value }))}
                    placeholder="예) 울산TF"
                    className={inputCls}
                  />
                  <datalist id="tf-list">
                    {tfList.map(tf => <option key={tf} value={tf} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-gray-500">날짜</label>
                  <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">시간 (선택)</label>
                  <input type="time" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">내용</label>
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="자유롭게 기술하세요 (향후 카테고리별 전용 필드가 추가될 예정)"
                    className={`${inputCls} h-28`}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">메모 (선택)</label>
                  <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className={`${inputCls} h-12`} />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={handleFormSave} disabled={saving}
                className="px-4 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50">
                {saving ? '저장 중...' : editTarget ? '수정 완료' : '저장'}
              </button>
            </div>
          </div>
        )}

        {modalTab === 'paste' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-gray-500">메시지 출처:</label>
              {([
                ['neutral', '통합방', 'TF명 원본 보존'],
                ['이산', '이산 전용방', 'TF명 앞에 "이산" 자동 부여'],
                ['더보상', '더보상 전용방', 'TF명 앞에 "더보상" 자동 부여'],
              ] as const).map(([val, label, desc]) => (
                <label key={val} className="flex items-center gap-1 text-xs cursor-pointer" title={desc}>
                  <input
                    type="radio"
                    name="pasteTfOrg"
                    checked={pasteTfOrg === val}
                    onChange={() => setPasteTfOrg(val)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 -mt-1">
              {pasteTfOrg === 'neutral' && '※ 메시지의 TF명(예: 울산TF, 진폐TF)을 그대로 저장'}
              {pasteTfOrg === '이산' && '※ 접두어 없는 TF명에 "이산" 자동 부여 (예: 울산TF → 이산울산TF)'}
              {pasteTfOrg === '더보상' && '※ 접두어 없는 TF명에 "더보상" 자동 부여 (예: 부산TF → 더보상부산TF)'}
            </div>
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
