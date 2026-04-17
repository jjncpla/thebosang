'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBranches } from '@/lib/hooks/useBranches'
import { ROOM_TYPE_LABELS, RoomType } from '@/lib/constants/telegram'

interface ChatRoom {
  chatId: string
  chatName: string
  roomType: string
  tfName: string | null
  isActive: boolean
  registeredAt: string
  note: string | null
  lastMessageAt: string | null
  messageCount: number
}

const EMPTY_FORM = {
  chatId: '',
  chatName: '',
  roomType: 'schedule' as RoomType,
  tfName: '',
  note: '',
  isActive: true,
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '-'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function TelegramChatroomsPage() {
  const [chatrooms, setChatrooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<ChatRoom | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const { allTFs, loading: tfLoading } = useBranches()
  const tbossangTFs = allTFs.filter((tf) => tf.startsWith('더보상'))

  const fetchChatrooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/telegram-chatrooms')
      if (res.ok) setChatrooms(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChatrooms() }, [fetchChatrooms])

  const filtered = chatrooms.filter((r) => {
    if (filterType && r.roomType !== filterType) return false
    if (filterActive === 'active' && !r.isActive) return false
    if (filterActive === 'inactive' && r.isActive) return false
    return true
  })

  function openCreate() {
    setEditingChatId(null)
    setForm(EMPTY_FORM)
    setErrorMsg('')
    setModalOpen(true)
  }

  function openEdit(room: ChatRoom) {
    setEditingChatId(room.chatId)
    setForm({
      chatId: room.chatId,
      chatName: room.chatName,
      roomType: room.roomType as RoomType,
      tfName: room.tfName ?? '',
      note: room.note ?? '',
      isActive: room.isActive,
    })
    setErrorMsg('')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSubmitting(true)
    try {
      if (editingChatId) {
        const res = await fetch(`/api/admin/telegram-chatrooms/${encodeURIComponent(editingChatId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatName: form.chatName,
            roomType: form.roomType,
            tfName: form.roomType === 'tf_work' ? form.tfName : null,
            isActive: form.isActive,
            note: form.note || null,
          }),
        })
        if (!res.ok) { const d = await res.json(); setErrorMsg(d.error || '수정 실패'); return }
      } else {
        const res = await fetch('/api/admin/telegram-chatrooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: form.chatId,
            chatName: form.chatName,
            roomType: form.roomType,
            tfName: form.roomType === 'tf_work' ? form.tfName : null,
            note: form.note || null,
          }),
        })
        if (!res.ok) { const d = await res.json(); setErrorMsg(d.error || '등록 실패'); return }
      }
      setModalOpen(false)
      fetchChatrooms()
    } finally {
      setSubmitting(false)
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/telegram-chatrooms/${encodeURIComponent(deleteTarget.chatId)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        setDeleteTarget(null)
        showToast('삭제되었습니다.', 'success')
        fetchChatrooms()
      } else {
        setDeleteTarget(null)
        showToast(data.message || data.error || '삭제 실패', 'error')
      }
    } finally {
      setDeleting(false)
    }
  }

  async function toggleActive(room: ChatRoom) {
    await fetch(`/api/admin/telegram-chatrooms/${encodeURIComponent(room.chatId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !room.isActive }),
    })
    fetchChatrooms()
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>텔레그램 채팅방 관리</h2>
        <button
          onClick={openCreate}
          style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
        >
          + 신규 채팅방 등록
        </button>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}
        >
          <option value="">전체 유형</option>
          {(Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}
        >
          <option value="all">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
      </div>

      {/* 테이블 */}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>
          등록된 채팅방이 없습니다. 우측 상단 버튼으로 등록해주세요.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['채팅방명', '유형', '매핑 TF', '활성', '최근 수신', '비고', '액션'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((room) => (
                <tr key={room.chatId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                    <button onClick={() => openEdit(room)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: '#1e3a5f', fontSize: 13, padding: 0 }}>
                      {room.chatName}
                    </button>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{room.chatId}</div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>
                    {ROOM_TYPE_LABELS[room.roomType as RoomType] ?? room.roomType}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{room.tfName ?? '-'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => toggleActive(room)}
                      style={{
                        background: room.isActive ? '#10b981' : '#d1d5db',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '3px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {room.isActive ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{timeAgo(room.lastMessageAt)}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {room.note ?? '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => openEdit(room)}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', marginRight: 6 }}
                    >
                      편집
                    </button>
                    <button
                      onClick={() => room.messageCount === 0 && setDeleteTarget(room)}
                      disabled={room.messageCount > 0}
                      title={room.messageCount > 0 ? '메시지가 수신된 방은 삭제할 수 없습니다 (비활성화 이용)' : '삭제'}
                      style={{
                        background: room.messageCount > 0 ? '#f3f4f6' : '#fee2e2',
                        color: room.messageCount > 0 ? '#9ca3af' : '#dc2626',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: room.messageCount > 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록/편집 모달 */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 480, maxWidth: '95vw', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, margin: '0 0 20px' }}>
              {editingChatId ? '채팅방 편집' : '신규 채팅방 등록'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* chatId */}
                <label style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Chat ID <span style={{ color: '#ef4444' }}>*</span></div>
                  <input
                    value={form.chatId}
                    onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                    readOnly={!!editingChatId}
                    placeholder="-1001234567890"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, background: editingChatId ? '#f9fafb' : '#fff', boxSizing: 'border-box' }}
                    required={!editingChatId}
                  />
                  {!editingChatId && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      텔레그램 봇을 방에 초대 후, 첫 메시지가 오면 webhook 로그에서 chatId를 확인할 수 있습니다. 숫자로 시작하는 값 예: -1001234567890
                    </div>
                  )}
                </label>

                {/* chatName */}
                <label style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>채팅방명 <span style={{ color: '#ef4444' }}>*</span></div>
                  <input
                    value={form.chatName}
                    onChange={(e) => setForm({ ...form, chatName: e.target.value })}
                    placeholder="예: 더보상 울산TF 업무방"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }}
                    required
                  />
                </label>

                {/* roomType */}
                <label style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>유형 <span style={{ color: '#ef4444' }}>*</span></div>
                  <select
                    value={form.roomType}
                    onChange={(e) => setForm({ ...form, roomType: e.target.value as RoomType, tfName: '' })}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }}
                    required
                  >
                    {(Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>

                {/* tfName - tf_work일 때만 표시 */}
                {form.roomType === 'tf_work' && (
                  <label style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>매핑 TF <span style={{ color: '#ef4444' }}>*</span></div>
                    <select
                      value={form.tfName}
                      onChange={(e) => setForm({ ...form, tfName: e.target.value })}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }}
                      required
                    >
                      <option value="">TF 선택</option>
                      {tfLoading ? (
                        <option disabled>불러오는 중...</option>
                      ) : tbossangTFs.length > 0 ? (
                        tbossangTFs.map((tf) => <option key={tf} value={tf}>{tf}</option>)
                      ) : (
                        <option disabled>등록된 TF 없음</option>
                      )}
                    </select>
                  </label>
                )}

                {/* isActive (편집 모드만) */}
                {editingChatId && (
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    <span style={{ fontWeight: 600 }}>활성 상태</span>
                  </label>
                )}

                {/* note */}
                <label style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>비고</div>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={2}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </label>
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: 13, marginTop: 12 }}>{errorMsg}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                >
                  {submitting ? '처리 중...' : editingChatId ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 420, maxWidth: '95vw', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#111827' }}>채팅방 삭제</h3>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 20px' }}>
              <strong>{deleteTarget.chatName}</strong> 채팅방을 삭제합니다.<br />
              이 작업은 되돌릴 수 없습니다. 계속하시겠어요?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 2000,
          background: toast.type === 'success' ? '#10b981' : '#dc2626',
          color: '#fff', borderRadius: 8, padding: '12px 20px',
          fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
