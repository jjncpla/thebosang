'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Todo {
  id: string
  title: string
  dueDate: string | null
  type: string
  caseId: string | null
  patientName: string | null
  isDone: boolean
  memo: string | null
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  ALL: '전체',
  OBJECTION_DEADLINE: '이의제기',
  WAGE_REQUEST: '평정청구',
  GENERAL: '일반',
}

const TYPE_COLORS: Record<string, string> = {
  OBJECTION_DEADLINE: '#dc2626',
  WAGE_REQUEST: '#d97706',
  GENERAL: '#6b7280',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function fmtDate(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function TodoPage() {
  const router = useRouter()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showDone, setShowDone] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  // 추가 폼
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', type: 'GENERAL', dueDate: '', memo: '' })
  const [adding, setAdding] = useState(false)

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      const res = await fetch(`/api/todos?${params}`)
      const data = await res.json()
      setTodos(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  const toggleDone = async (t: Todo) => {
    await fetch(`/api/todos/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: !t.isDone }),
    })
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, isDone: !x.isDone } : x))
  }

  const deleteTodo = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    setTodos(prev => prev.filter(x => x.id !== id))
  }

  const handleAdd = async () => {
    if (!addForm.title.trim()) { alert('제목을 입력해주세요.'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addForm.title,
          type: addForm.type,
          dueDate: addForm.dueDate || null,
          memo: addForm.memo || null,
        }),
      })
      const created = await res.json()
      setTodos(prev => [created, ...prev])
      setAddForm({ title: '', type: 'GENERAL', dueDate: '', memo: '' })
      setAddOpen(false)
    } finally {
      setAdding(false)
    }
  }

  // 달력용 — 해당 달 todo
  const todosInMonth = todos.filter(t => {
    if (!t.dueDate) return false
    const d = new Date(t.dueDate)
    return d.getFullYear() === calYear && d.getMonth() === calMonth
  })

  const todosByDate: Record<string, Todo[]> = {}
  todosInMonth.forEach(t => {
    const key = t.dueDate!.slice(0, 10)
    if (!todosByDate[key]) todosByDate[key] = []
    todosByDate[key].push(t)
  })

  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // 목록 필터
  const displayTodos = todos.filter(t => {
    if (!showDone && t.isDone) return false
    if (selectedDate) {
      const key = t.dueDate?.slice(0, 10) ?? null
      return key === selectedDate
    }
    return true
  })

  const pending = todos.filter(t => !t.isDone).length
  const urgent = todos.filter(t => {
    if (t.isDone || !t.dueDate) return false
    const diff = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000)
    return diff >= 0 && diff <= 7
  }).length

  const S: React.CSSProperties = { fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif" }

  return (
    <div style={{ ...S, minHeight: '100vh', background: '#f1f5f9', padding: 20 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>☑ To Do List</h1>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>미완료 <strong style={{ color: '#111827' }}>{pending}건</strong></span>
            {urgent > 0 && <span style={{ fontSize: 12, color: '#dc2626' }}>7일 이내 마감 <strong>{urgent}건</strong></span>}
          </div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          style={{ padding: '8px 18px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          + 할일 추가
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
        {/* 왼쪽: 달력 */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* 달력 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#29ABE2', color: 'white' }}>
            <button onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setSelectedDate(null) }}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{calYear}년 {calMonth + 1}월</span>
            <button onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setSelectedDate(null) }}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>›</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 700, color: i === 0 ? '#dc2626' : i === 6 ? '#2563eb' : '#6b7280' }}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 0 8px' }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayTodos = todosByDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dayOfWeek = (firstDay + i) % 7
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={{
                    textAlign: 'center', padding: '4px 2px', cursor: 'pointer',
                    background: isSelected ? '#e0f2fe' : 'transparent',
                    borderRadius: 6, margin: '1px',
                  }}
                >
                  <div style={{
                    width: 26, height: 26, margin: '0 auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    background: isToday ? '#29ABE2' : 'transparent',
                    color: isToday ? 'white' : dayOfWeek === 0 ? '#dc2626' : dayOfWeek === 6 ? '#2563eb' : '#374151',
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                  }}>{day}</div>
                  {dayTodos.length > 0 && (
                    <div style={{ marginTop: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                      {dayTodos.slice(0, 3).map(t => (
                        <div key={t.id} style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: t.isDone ? '#d1d5db' : (TYPE_COLORS[t.type] || '#29ABE2'),
                        }} />
                      ))}
                      {dayTodos.length > 3 && <span style={{ fontSize: 8, color: '#9ca3af' }}>+{dayTodos.length - 3}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {selectedDate && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', background: '#f8fafc' }}>
              <span style={{ fontSize: 12, color: '#29ABE2', fontWeight: 600 }}>{selectedDate} 선택됨</span>
              <button onClick={() => setSelectedDate(null)} style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>× 해제</button>
            </div>
          )}
        </div>

        {/* 오른쪽: 필터 + 목록 */}
        <div>
          {/* 필터 탭 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setTypeFilter(k)}
                style={{
                  padding: '6px 14px', border: '1px solid #e5e7eb', borderRadius: 20,
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  backgroundColor: typeFilter === k ? '#29ABE2' : 'white',
                  color: typeFilter === k ? 'white' : '#6b7280',
                }}>
                {v}
              </button>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
              완료 항목 포함
            </label>
          </div>

          {/* Todo 목록 */}
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>불러오는 중...</div>
            ) : displayTodos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>
                {selectedDate ? `${selectedDate}에 할일이 없습니다.` : '할일이 없습니다.'}
              </div>
            ) : (
              displayTodos.map((t, i) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                  borderBottom: i < displayTodos.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: t.isDone ? '#fafafa' : 'white',
                  opacity: t.isDone ? 0.7 : 1,
                }}>
                  <input
                    type="checkbox"
                    checked={t.isDone}
                    onChange={() => toggleDone(t)}
                    style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer', accentColor: '#29ABE2' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: t.isDone ? '#9ca3af' : '#111827',
                        textDecoration: t.isDone ? 'line-through' : 'none',
                      }}>{t.title}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                        background: t.isDone ? '#f3f4f6' : `${TYPE_COLORS[t.type] || '#e5e7eb'}20`,
                        color: t.isDone ? '#9ca3af' : (TYPE_COLORS[t.type] || '#6b7280'),
                        border: `1px solid ${t.isDone ? '#e5e7eb' : (TYPE_COLORS[t.type] || '#e5e7eb')}`,
                      }}>
                        {TYPE_LABELS[t.type] || t.type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                      {t.dueDate && (
                        <span style={{ fontSize: 11, color: (() => {
                          const diff = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000)
                          return !t.isDone && diff <= 7 && diff >= 0 ? '#dc2626' : '#9ca3af'
                        })() }}>
                          📅 {fmtDate(t.dueDate)}
                          {!t.isDone && (() => {
                            const diff = Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000)
                            if (diff < 0) return <span style={{ color: '#dc2626' }}> (D+{Math.abs(diff)})</span>
                            if (diff <= 7) return <span style={{ color: '#dc2626' }}> (D-{diff})</span>
                            return null
                          })()}
                        </span>
                      )}
                      {t.patientName && <span style={{ fontSize: 11, color: '#6b7280' }}>👤 {t.patientName}</span>}
                      {t.memo && <span style={{ fontSize: 11, color: '#9ca3af' }}>{t.memo}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {t.caseId && (
                      <button
                        onClick={() => router.push(`/patients?caseId=${t.caseId}`)}
                        style={{ padding: '3px 9px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 4, color: '#29ABE2', background: 'white', cursor: 'pointer' }}
                      >
                        사건 보기
                      </button>
                    )}
                    <button
                      onClick={() => deleteTodo(t.id)}
                      style={{ padding: '3px 9px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 4, color: '#dc2626', background: 'white', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 추가 모달 */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>할일 추가</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>제목 *</label>
                <input type="text" value={addForm.title} onChange={e => setAddForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="할일 제목을 입력하세요"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>유형</label>
                  <select value={addForm.type} onChange={e => setAddForm(p => ({ ...p, type: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
                    <option value="GENERAL">일반</option>
                    <option value="OBJECTION_DEADLINE">이의제기</option>
                    <option value="WAGE_REQUEST">평정청구</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>마감일</label>
                  <input type="date" value={addForm.dueDate} onChange={e => setAddForm(p => ({ ...p, dueDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>메모 (선택)</label>
                <textarea value={addForm.memo} onChange={e => setAddForm(p => ({ ...p, memo: e.target.value }))}
                  rows={2} placeholder="메모를 입력하세요..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setAddOpen(false)} disabled={adding}
                style={{ padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 13 }}>취소</button>
              <button onClick={handleAdd} disabled={adding}
                style={{ padding: '8px 20px', backgroundColor: '#29ABE2', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {adding ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
