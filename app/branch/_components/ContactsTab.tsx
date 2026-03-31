'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

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
}
interface IsanOffice {
  id: string; name: string; tel: string; fax: string; address: string
}

const EMPTY_FORM = {
  firmType: 'TBOSANG', firm: '', branch: '', name: '',
  title: '', mobile: '', officePhone: '', email: '',
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
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13 }}>총 {contacts.length}명</span>
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
                {isAdmin && <th style={{ ...th, textAlign: 'center' }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>검색 결과가 없습니다.</td></tr>
              ) : contacts.map((c, i) => (
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
              ))}
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
