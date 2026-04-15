'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface UserInfo {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}
interface Contact {
  id: string
  firmType: string
  firm: string
  branch: string
  name: string
  title: string
  mobile: string
  officePhone: string
  email: string
  jobGrade: string
  hireDate: string | null
  leaveDate: string | null
  userId?: string | null
  user?: UserInfo | null
}
interface IsanOffice {
  id: string; name: string; tel: string; fax: string; address: string
}

const EMPTY_FORM = {
  firmType: 'TBOSANG', firm: '', branch: '', name: '',
  title: '', mobile: '', officePhone: '', email: '',
  jobGrade: '외근직', hireDate: null as string | null, leaveDate: null as string | null,
}

export default function ContactsTab() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const [activeTab, setActiveTab] = useState<'TBOSANG' | 'ISAN'>('TBOSANG')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [offices, setOffices] = useState<IsanOffice[]>([])
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [showOffices, setShowOffices] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>(EMPTY_FORM)

  // 계정 관리 상태
  const [accountFilter, setAccountFilter] = useState<'all' | 'has' | 'none'>('all')
  const [accountModal, setAccountModal] = useState<{ mode: 'create' | 'edit'; contact: Contact } | null>(null)
  const [accountForm, setAccountForm] = useState({ email: '', password: '1234', role: 'STAFF' })
  const [accountSubmitting, setAccountSubmitting] = useState(false)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ firmType: activeTab })
    if (search) params.set('search', search)
    if (branchFilter) params.set('branch', branchFilter)
    if (gradeFilter) params.set('jobGrade', gradeFilter)
    const res = await fetch(`/api/contacts?${params}`)
    const data = await res.json()
    setContacts(data.contacts || [])
    setOffices(data.offices || [])
    setLoading(false)
  }, [activeTab, search, branchFilter, gradeFilter])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const branches = Array.from(new Set(contacts.map(c => c.branch))).filter(Boolean).sort()

  const openAdd = () => {
    setEditingId(null)
    setFormData({ ...EMPTY_FORM, firmType: activeTab })
    setModalOpen(true)
  }
  const openEdit = (c: Contact) => {
    setEditingId(c.id)
    setFormData({ ...c })
    setModalOpen(true)
  }
  const handleSave = async () => {
    if (!formData.name?.trim()) { alert('이름을 입력해주세요.'); return }
    const url = editingId ? `/api/contacts/${editingId}` : '/api/contacts'
    const method = editingId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`저장 실패: ${JSON.stringify(err)}`)
      return
    }
    setModalOpen(false)
    fetchContacts()
  }
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} 님의 연락처를 삭제하시겠습니까?`)) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    fetchContacts()
  }

  const openAccountCreate = (c: Contact) => {
    setAccountForm({ email: c.email || '', password: '1234', role: 'STAFF' })
    setAccountModal({ mode: 'create', contact: c })
  }
  const openAccountEdit = (c: Contact) => {
    setAccountForm({ email: c.user?.email || '', password: '', role: c.user?.role || 'STAFF' })
    setAccountModal({ mode: 'edit', contact: c })
  }

  const handleCreateAccount = async () => {
    if (!accountModal) return
    if (!accountForm.email.trim()) { alert('이메일을 입력해주세요.'); return }
    if (!accountForm.password.trim()) { alert('비밀번호를 입력해주세요.'); return }
    setAccountSubmitting(true)
    // 1) 계정 생성
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: accountModal.contact.name,
        email: accountForm.email,
        password: accountForm.password,
        role: accountForm.role,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`계정 생성 실패: ${err.error || JSON.stringify(err)}`)
      setAccountSubmitting(false)
      return
    }
    const user = await res.json()
    // 2) Contact에 userId 연결
    await fetch(`/api/contacts/${accountModal.contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    setAccountModal(null)
    setAccountSubmitting(false)
    fetchContacts()
  }

  const handleUpdateAccountRole = async () => {
    if (!accountModal?.contact.userId) return
    setAccountSubmitting(true)
    await fetch(`/api/admin/users/${accountModal.contact.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: accountForm.role }),
    })
    setAccountModal(null)
    setAccountSubmitting(false)
    fetchContacts()
  }

  const handleResetPassword = async () => {
    if (!accountModal?.contact.userId) return
    if (!confirm('비밀번호를 1234로 초기화하시겠습니까?')) return
    setAccountSubmitting(true)
    await fetch(`/api/admin/users/${accountModal.contact.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: '1234' }),
    })
    alert('비밀번호가 1234로 초기화되었습니다.')
    setAccountSubmitting(false)
  }

  const handleDeleteAccount = async () => {
    if (!accountModal?.contact.userId) return
    if (!confirm(`${accountModal.contact.name} 님의 계정을 삭제하시겠습니까?`)) return
    setAccountSubmitting(true)
    await fetch(`/api/admin/users/${accountModal.contact.userId}`, { method: 'DELETE' })
    await fetch(`/api/contacts/${accountModal.contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: null }),
    })
    setAccountModal(null)
    setAccountSubmitting(false)
    fetchContacts()
  }

  const handleBulkCreateAccounts = async () => {
    const targets = contacts.filter(c => c.firmType === 'TBOSANG' && !c.userId && c.jobGrade === '외근직')
    if (targets.length === 0) { alert('일괄 생성할 대상이 없습니다.'); return }
    if (!confirm(`계정이 없는 더보상 소속 외근직 ${targets.length}명의 계정을 일괄 생성합니다.\n초기 비밀번호: 1234\n\n계속하시겠습니까?`)) return
    setAccountSubmitting(true)
    let created = 0
    for (const c of targets) {
      if (!c.email) continue
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, email: c.email, password: '1234', role: 'STAFF' }),
      })
      if (res.ok) {
        const user = await res.json()
        await fetch(`/api/contacts/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
        created++
      }
    }
    alert(`${created}명의 계정이 생성되었습니다.`)
    setAccountSubmitting(false)
    fetchContacts()
  }

  const th = { padding: '10px 12px', backgroundColor: '#29ABE2', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' as const, whiteSpace: 'nowrap' as const }
  const td = (i: number) => ({ padding: '8px 12px', fontSize: 13, backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' })

  return (
    <div>
      {/* 법인 탭 */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
        {(['TBOSANG', 'ISAN'] as const).map(t => (
          <button key={t} onClick={() => { setActiveTab(t); setBranchFilter(''); setSearch('') }}
            style={{ padding: '8px 20px', border: 'none', marginBottom: -2, background: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: activeTab === t ? 700 : 400,
              color: activeTab === t ? '#29ABE2' : '#64748b',
              borderBottom: activeTab === t ? '2px solid #29ABE2' : '2px solid transparent' }}>
            {t === 'TBOSANG' ? '노무법인 더보상' : '노무법인 이산'}
          </button>
        ))}
      </div>

      {/* 검색·필터 영역 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="이름·직책·지사 검색" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, width: 200, outline: 'none' }} />
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, outline: 'none' }}>
          <option value="">전체 지사</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, outline: 'none' }}>
          <option value="">전체 직군</option>
          <option value="외근직">외근직</option>
          <option value="내근직">내근직</option>
          <option value="노무사">노무사</option>
          <option value="등기노무사">등기노무사</option>
          <option value="변호사">변호사</option>
          <option value="기타">기타</option>
        </select>
        {isAdmin && activeTab === 'TBOSANG' && (
          <div style={{ display: 'flex', gap: 4, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'has', 'none'] as const).map(f => (
              <button key={f} onClick={() => setAccountFilter(f)}
                style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  backgroundColor: accountFilter === f ? '#29ABE2' : '#fff',
                  color: accountFilter === f ? '#fff' : '#64748b' }}>
                {f === 'all' ? '전체' : f === 'has' ? '계정있음' : '계정없음'}
              </button>
            ))}
          </div>
        )}
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13 }}>총 {contacts.length}명</span>
        {isAdmin && activeTab === 'TBOSANG' && (
          <button onClick={handleBulkCreateAccounts} disabled={accountSubmitting}
            style={{ padding: '7px 14px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            미생성 일괄 계정 생성
          </button>
        )}
        {isAdmin && (
          <button onClick={openAdd}
            style={{ padding: '7px 16px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            + 추가
          </button>
        )}
      </div>

      {/* 연락처 테이블 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>지사/소속</th>
                <th style={th}>이름</th>
                <th style={th}>직책</th>
                <th style={th}>직군</th>
                <th style={th}>핸드폰</th>
                <th style={th}>{activeTab === 'TBOSANG' ? '사무실번호' : '직통번호'}</th>
                <th style={th}>입사일</th>
                <th style={th}>퇴사일</th>
                {activeTab === 'ISAN' && <th style={th}>이메일</th>}
                {isAdmin && activeTab === 'TBOSANG' && <th style={{ ...th, textAlign: 'center' }}>계정 상태</th>}
                {isAdmin && <th style={{ ...th, textAlign: 'center' }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = contacts.filter(c => {
                  if (activeTab !== 'TBOSANG' || !isAdmin || accountFilter === 'all') return true
                  if (accountFilter === 'has') return !!c.user
                  return !c.user
                })
                return filtered.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>검색 결과가 없습니다.</td></tr>
                ) : filtered.map((c, i) => (
                <tr key={c.id}>
                  <td style={td(i)}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, backgroundColor: '#f0f9ff', color: '#0369a1', fontSize: 11, fontWeight: 600 }}>
                      {c.branch || c.firm}
                    </span>
                  </td>
                  <td style={{ ...td(i), fontWeight: 600 }}>{c.name}</td>
                  <td style={{ ...td(i), color: '#475569' }}>{c.title || '-'}</td>
                  <td style={td(i)}>
                    {(() => {
                      const g = c.jobGrade || '기타'
                      const s = g === '외근직' ? { bg: '#fef3c7', c: '#92400e' }
                        : g === '내근직' ? { bg: '#f0f9ff', c: '#0369a1' }
                        : g === '노무사' ? { bg: '#f0fdf4', c: '#166534' }
                        : g === '등기노무사' ? { bg: '#fdf4ff', c: '#7e22ce' }
                        : g === '변호사' ? { bg: '#fff1f2', c: '#be123c' }
                        : { bg: '#f1f5f9', c: '#334155' }
                      return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: s.bg, color: s.c }}>{g}</span>
                    })()}
                  </td>
                  <td style={td(i)}>
                    {c.mobile
                      ? <a href={`tel:${c.mobile}`} style={{ color: '#29ABE2', textDecoration: 'none', fontFamily: 'monospace' }}>{c.mobile}</a>
                      : '-'}
                  </td>
                  <td style={{ ...td(i), fontFamily: 'monospace', color: '#475569' }}>{c.officePhone || '-'}</td>
                  <td style={{ ...td(i), fontSize: 12, color: '#475569' }}>
                    {c.hireDate ? new Date(c.hireDate).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
                  </td>
                  <td style={{ ...td(i), fontSize: 12, color: '#475569' }}>
                    {c.leaveDate ? new Date(c.leaveDate).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
                  </td>
                  {activeTab === 'ISAN' && <td style={{ ...td(i), fontSize: 12, color: '#475569' }}>{c.email || '-'}</td>}
                  {isAdmin && activeTab === 'TBOSANG' && (
                    <td style={{ ...td(i), textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {c.user ? (
                        <button onClick={() => openAccountEdit(c)}
                          style={{ padding: '3px 10px', fontSize: 11, backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer', color: '#166534', fontWeight: 600 }}>
                          ✅ {c.user.role}
                        </button>
                      ) : (
                        <button onClick={() => openAccountCreate(c)}
                          style={{ padding: '3px 10px', fontSize: 11, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', color: '#64748b' }}>
                          ⬜ 계정 생성
                        </button>
                      )}
                    </td>
                  )}
                  {isAdmin && (
                    <td style={{ ...td(i), textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(c)}
                        style={{ padding: '3px 10px', marginRight: 4, fontSize: 11, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>
                        수정
                      </button>
                      <button onClick={() => handleDelete(c.id, c.name)}
                        style={{ padding: '3px 10px', fontSize: 11, backgroundColor: '#fff1f2', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', color: '#dc2626' }}>
                        삭제
                      </button>
                    </td>
                  )}
                </tr>
              ))
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* 이산 지사 사무실 전화번호 */}
      {activeTab === 'ISAN' && offices.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setShowOffices(v => !v)}
            style={{ padding: '8px 16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}>
            {showOffices ? '▲' : '▼'} 이산 지사 사무실 전화번호 ({offices.length}개)
          </button>
          {showOffices && (
            <div style={{ marginTop: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['지사명', '전화번호'].map(h => (
                      <th key={h} style={{ ...th, backgroundColor: '#006838' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {offices.map((o, i) => (
                    <tr key={o.id}>
                      <td style={{ ...td(i), fontWeight: 600 }}>{o.name}</td>
                      <td style={td(i)}>
                        {o.tel ? <a href={`tel:${o.tel}`} style={{ color: '#29ABE2', textDecoration: 'none', fontFamily: 'monospace' }}>{o.tel}</a> : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 계정 생성 모달 */}
      {isAdmin && accountModal?.mode === 'create' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>계정 생성</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569' }}>
              <b>{accountModal.contact.name}</b> ({accountModal.contact.branch || accountModal.contact.firm})
            </p>
            {[
              { key: 'email', label: '이메일', type: 'email', placeholder: 'example@thebosang.kr' },
              { key: 'password', label: '초기 비밀번호', type: 'text', placeholder: '1234' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
                <input type={type} value={(accountForm as any)[key]}
                  onChange={e => setAccountForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>권한</label>
              <select value={accountForm.role} onChange={e => setAccountForm(p => ({ ...p, role: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
                <option value="ADMIN">ADMIN (관리자)</option>
                <option value="MANAGER">조직관리자</option>
                <option value="STAFF">STAFF (직원)</option>
                <option value="READONLY">READONLY (이산계정)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAccountModal(null)} disabled={accountSubmitting}
                style={{ padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                취소
              </button>
              <button onClick={handleCreateAccount} disabled={accountSubmitting}
                style={{ padding: '8px 20px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {accountSubmitting ? '생성 중...' : '계정 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 계정 수정 모달 */}
      {isAdmin && accountModal?.mode === 'edit' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>계정 수정</h3>
            <div style={{ marginBottom: 12, padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569' }}>
              <div><b>이름:</b> {accountModal.contact.name}</div>
              <div><b>이메일:</b> {accountModal.contact.user?.email}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>권한</label>
              <select value={accountForm.role} onChange={e => setAccountForm(p => ({ ...p, role: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
                <option value="ADMIN">ADMIN (관리자)</option>
                <option value="MANAGER">조직관리자</option>
                <option value="STAFF">STAFF (직원)</option>
                <option value="READONLY">READONLY (이산계정)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
              <button onClick={handleDeleteAccount} disabled={accountSubmitting}
                style={{ padding: '8px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                계정 삭제
              </button>
              <button onClick={handleResetPassword} disabled={accountSubmitting}
                style={{ padding: '8px 14px', backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                비번 초기화(1234)
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setAccountModal(null)} disabled={accountSubmitting}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
                취소
              </button>
              <button onClick={handleUpdateAccountRole} disabled={accountSubmitting}
                style={{ padding: '8px 20px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {accountSubmitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {isAdmin && modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 28, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editingId ? '연락처 수정' : '연락처 추가'}</h3>
            {[
              { key: 'firmType', label: '소속 법인', type: 'select', opts: [['TBOSANG','노무법인 더보상'],['ISAN','노무법인 이산']] },
              { key: 'branch', label: '지사/부서' },
              { key: 'name', label: '이름 *' },
              { key: 'title', label: '직책' },
              { key: 'mobile', label: '핸드폰' },
              { key: 'officePhone', label: '사무실/직통번호' },
              { key: 'email', label: '이메일' },
              { key: 'jobGrade', label: '직군', type: 'select', opts: [['외근직','외근직'],['내근직','내근직'],['노무사','노무사'],['등기노무사','등기노무사'],['변호사','변호사'],['기타','기타']] },
            ].map(({ key, label, type, opts }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
                {type === 'select' ? (
                  <select value={formData[key] || ''} onChange={e => setFormData((p: any) => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
                    {(opts as [string,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <input type="text" value={formData[key] || ''} onChange={e => setFormData((p: any) => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>입사일</label>
                <input type="date"
                  value={formData.hireDate ? new Date(formData.hireDate).toISOString().split('T')[0] : ''}
                  onChange={e => setFormData((p: any) => ({ ...p, hireDate: e.target.value || null }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>퇴사일</label>
                <input type="date"
                  value={formData.leaveDate ? new Date(formData.leaveDate).toISOString().split('T')[0] : ''}
                  onChange={e => setFormData((p: any) => ({ ...p, leaveDate: e.target.value || null }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                취소
              </button>
              <button onClick={handleSave}
                style={{ padding: '8px 20px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
