'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
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
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Schedule | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'form' | 'paste'>('form')

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

  // TF 목록 (현재 데이터에서)
  const tfList = [...new Set(schedules.map(s => s.tfName))].sort()

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
          onClick={() => { setShowModal(true); setModalTab('form') }}
          className="px-3 py-1.5 text-sm bg-sky-500 text-white rounded hover:bg-sky-600"
        >
          + 수동 입력
        </button>
      </div>

      {/* 월 네비게이션 + 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={prevMonth} className="px-2 py-1 border rounded hover:bg-gray-50">&lt;</button>
        <span className="text-sm font-semibold min-w-[100px] text-center">{year}년 {month}월</span>
        <button onClick={nextMonth} className="px-2 py-1 border rounded hover:bg-gray-50">&gt;</button>

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

      {/* 캘린더 그리드 */}
      <div className="border rounded-lg overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DOW.map((d, i) => (
            <div key={d} className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 주별 행 */}
        {weeks.map((wk, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0" style={{ minHeight: 100 }}>
            {wk.map((day, di) => {
              const daySchedules = day ? getSchedulesForDay(day) : []
              const isToday = day && isSameDay(new Date(year, month - 1, day), now)
              const maxShow = 3
              return (
                <div key={di} className={`border-r last:border-r-0 p-1 ${day ? 'bg-white' : 'bg-gray-50'}`}>
                  {day && (
                    <>
                      <div className={`text-xs mb-1 ${isToday ? 'bg-sky-500 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold' : di === 0 ? 'text-red-400' : di === 6 ? 'text-blue-400' : 'text-gray-600'}`}>
                        {day}
                      </div>
                      {daySchedules.slice(0, maxShow).map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className="w-full text-left mb-0.5 rounded px-1 py-0.5 hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: getTFColor(s.tfName) + '18', borderLeft: `3px solid ${getTFColor(s.tfName)}` }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getTFColor(s.tfName) }} />
                            <span className="text-[10px] font-medium truncate text-gray-800">{s.patientName}</span>
                          </div>
                          <div className="text-[9px] text-gray-500 truncate pl-2.5">
                            {s.clinicType} {s.examRound}차 {fmtTime(s.scheduledHour, s.scheduledMinute)}
                          </div>
                        </button>
                      ))}
                      {daySchedules.length > maxShow && (
                        <div className="text-[9px] text-gray-400 text-center">
                          외 {daySchedules.length - maxShow}건
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* TF 범례 */}
      {tfList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tfList.map(tf => (
            <span key={tf} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
              style={{ borderColor: getTFColor(tf), color: getTFColor(tf) }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getTFColor(tf) }} />
              {tf}
            </span>
          ))}
        </div>
      )}

      {/* ── 상세 슬라이드 패널 ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative w-full max-w-md bg-white shadow-xl h-full overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800">일정 상세</h2>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getTFColor(selected.tfName) }} />
                  <span className="font-semibold text-base">{selected.patientName}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">TF</span><p className="font-medium">{selected.tfName}</p></div>
                  <div><span className="text-gray-400">병원</span><p className="font-medium">{selected.hospitalName}</p></div>
                  <div><span className="text-gray-400">유형</span><p className="font-medium">{selected.clinicType} {selected.examRound}차</p></div>
                  <div><span className="text-gray-400">날짜</span><p className="font-medium">
                    {selected.scheduledDate ? new Date(selected.scheduledDate).toLocaleDateString('ko-KR') : '-'}
                    {!selected.isAllDay && ` ${fmtTime(selected.scheduledHour, selected.scheduledMinute)}`}
                  </p></div>
                </div>

                <div>
                  <span className="text-xs text-gray-400">상태</span>
                  <div className="flex gap-1 mt-1">
                    {(['scheduled','done','cancelled'] as const).map(st => (
                      <button key={st}
                        onClick={() => handleStatusChange(selected.id, st)}
                        className="px-2 py-1 text-xs rounded border transition-colors"
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
                  <div><span className="text-xs text-gray-400">발신자</span><p className="text-xs">{selected.sender}</p></div>
                )}
                {selected.sourceDate && (
                  <div><span className="text-xs text-gray-400">메시지 발송일</span><p className="text-xs">{new Date(selected.sourceDate).toLocaleString('ko-KR')}</p></div>
                )}
                {selected.memo && (
                  <div><span className="text-xs text-gray-400">메모</span><p className="text-xs whitespace-pre-wrap bg-gray-50 p-2 rounded">{selected.memo}</p></div>
                )}
                {selected.rawMessage && (
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer">원본 메시지</summary>
                    <pre className="mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap text-[10px] max-h-48 overflow-y-auto">{selected.rawMessage}</pre>
                  </details>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => handleDelete(selected.id)}
                  className="px-3 py-1.5 text-xs border border-red-300 text-red-500 rounded hover:bg-red-50">
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 수동 입력 모달 ── */}
      {showModal && (
        <InputModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
          modalTab={modalTab}
          setModalTab={setModalTab}
          tfList={tfList}
          defaultYear={year}
          defaultMonth={month}
        />
      )}
    </div>
  )
}

// ─── 수동 입력 모달 ────────────────────────────────────────────────
function InputModal({
  onClose, onSaved, modalTab, setModalTab, tfList, defaultYear, defaultMonth,
}: {
  onClose: () => void
  onSaved: () => void
  modalTab: 'form' | 'paste'
  setModalTab: (t: 'form' | 'paste') => void
  tfList: string[]
  defaultYear: number
  defaultMonth: number
}) {
  // 직접 입력
  const [form, setForm] = useState({
    patientName: '', tfName: '', hospitalName: '', clinicType: '특진',
    examRound: 1, scheduledDate: `${defaultYear}-${pad(defaultMonth)}-01`,
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
