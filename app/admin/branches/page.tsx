'use client'

import { useState, useEffect, useCallback } from 'react'
import ContactSelector from '@/components/ui/ContactSelector'

const REGIONS = ['부울경남권역', '대구경북권역', '수도권역', '전라권역']

interface Branch {
  id: string
  name: string
  shortName: string | null
  address: string | null
  phone: string | null
  fax: string | null
  region: string | null
  assignedTFs: string[] | null
  branchManagerId: string | null
  firmType: string
  isActive: boolean
  displayOrder: number
  bizNumber: string | null
  bankAccount: string | null
  staffCount?: number
}

interface StaffMember {
  id: string
  name: string
  title: string
  jobGrade: string
  mobile: string
  email: string
  hireDate: string | null
  leaveDate: string | null
}

const EMPTY_FORM = {
  name: '', shortName: '', address: '', phone: '', fax: '',
  region: '', assignedTFs: [] as string[], branchManagerId: '',
  firmType: 'TBOSANG', isActive: true, displayOrder: 0,
  bizNumber: '', bankAccount: '',
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [regionFilter, setRegionFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [tfInput, setTfInput] = useState('')
  const [saving, setSaving] = useState(false)

  const [staffPopup, setStaffPopup] = useState<{ branch: Branch; staff: StaffMember[] } | null>(null)
  const [staffLoading, setStaffLoading] = useState(false)

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ includeStaff: 'true' })
    if (regionFilter) params.set('region', regionFilter)
    const res = await fetch(`/api/branches?${params}`)
    const data = await res.json()
    setBranches(data.branches || [])
    setLoading(false)
  }, [regionFilter])

  useEffect(() => { fetchBranches() }, [fetchBranches])

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setTfInput('')
    setModalOpen(true)
  }

  const openEdit = (b: Branch) => {
    setEditingId(b.id)
    setForm({
      name: b.name, shortName: b.shortName || '', address: b.address || '',
      phone: b.phone || '', fax: b.fax || '', region: b.region || '',
      assignedTFs: b.assignedTFs || [], branchManagerId: b.branchManagerId || '',
      firmType: b.firmType, isActive: b.isActive, displayOrder: b.displayOrder,
      bizNumber: b.bizNumber || '', bankAccount: b.bankAccount || '',
    })
    setTfInput('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name?.trim()) { alert('지사명을 입력해주세요.'); return }
    setSaving(true)
    const url = editingId ? `/api/branches/${editingId}` : '/api/branches'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, displayOrder: Number(form.displayOrder) || 0 }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`저장 실패: ${err.error || JSON.stringify(err)}`)
      setSaving(false)
      return
    }
    setModalOpen(false)
    setSaving(false)
    fetchBranches()
  }

  const handleDeactivate = async (b: Branch) => {
    if (!confirm(`"${b.name}"을 비활성화하시겠습니까?`)) return
    await fetch(`/api/branches/${b.id}`, { method: 'DELETE' })
    fetchBranches()
  }

  const openStaff = async (b: Branch) => {
    setStaffLoading(true)
    setStaffPopup({ branch: b, staff: [] })
    const res = await fetch(`/api/branches/${b.id}`)
    const data = await res.json()
    setStaffPopup({ branch: b, staff: data.staff || [] })
    setStaffLoading(false)
  }

  const addTf = () => {
    const v = tfInput.trim()
    if (!v) return
    if (!form.assignedTFs.includes(v)) {
      setForm((p: any) => ({ ...p, assignedTFs: [...p.assignedTFs, v] }))
    }
    setTfInput('')
  }

  const removeTf = (tf: string) => {
    setForm((p: any) => ({ ...p, assignedTFs: p.assignedTFs.filter((t: string) => t !== tf) }))
  }

  const th = { padding: '10px 12px', backgroundColor: '#29ABE2', color: '#fff', fontWeight: 600, fontSize: 13, textAlign: 'left' as const, whiteSpace: 'nowrap' as const }
  const td = (i: number): React.CSSProperties => ({ padding: '9px 12px', fontSize: 13, backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0', verticalAlign: 'middle' })

  return (
    <div>
      {/* 상단 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>지사 관리</h2>
        <button onClick={openAdd}
          style={{ padding: '8px 18px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + 지사 등록
        </button>
      </div>

      {/* 권역 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', ...REGIONS].map(r => (
          <button key={r || 'all'} onClick={() => setRegionFilter(r)}
            style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              backgroundColor: regionFilter === r ? '#29ABE2' : '#fff',
              color: regionFilter === r ? '#fff' : '#475569' }}>
            {r || '전체'}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>불러오는 중...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>순서</th>
                <th style={th}>지사명</th>
                <th style={th}>약칭</th>
                <th style={th}>권역</th>
                <th style={th}>담당 TF</th>
                <th style={th}>소속 인원</th>
                <th style={th}>전화번호</th>
                <th style={{ ...th, textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>지사가 없습니다. 시드 데이터를 먼저 실행해주세요.</td></tr>
              ) : branches.map((b, i) => (
                <tr key={b.id}>
                  <td style={{ ...td(i), color: '#94a3b8', fontSize: 12 }}>{b.displayOrder}</td>
                  <td style={{ ...td(i), fontWeight: 700 }}>{b.name}</td>
                  <td style={{ ...td(i), color: '#475569' }}>{b.shortName || '-'}</td>
                  <td style={td(i)}>
                    {b.region ? (
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: '#f0f9ff', color: '#0369a1' }}>
                        {b.region}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={td(i)}>
                    {b.assignedTFs && b.assignedTFs.length > 0 ? (
                      <button onClick={() => alert((b.assignedTFs || []).join('\n'))}
                        style={{ padding: '2px 8px', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 11, backgroundColor: '#f8fafc', color: '#475569' }}>
                        {b.assignedTFs.length}개 보기
                      </button>
                    ) : '-'}
                  </td>
                  <td style={td(i)}>
                    <button onClick={() => openStaff(b)}
                      style={{ padding: '2px 8px', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 11, backgroundColor: '#f8fafc', color: '#0369a1' }}>
                      {b.staffCount ?? 0}명
                    </button>
                  </td>
                  <td style={{ ...td(i), fontFamily: 'monospace', fontSize: 12 }}>{b.phone || '-'}</td>
                  <td style={{ ...td(i), textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(b)}
                      style={{ padding: '4px 12px', marginRight: 4, fontSize: 11, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>
                      수정
                    </button>
                    <button onClick={() => handleDeactivate(b)}
                      style={{ padding: '4px 10px', fontSize: 11, backgroundColor: '#fff1f2', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', color: '#dc2626' }}>
                      비활성화
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 소속 인원 팝업 */}
      {staffPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 28, width: 640, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{staffPopup.branch.name} 소속 인원</h3>
              <button onClick={() => setStaffPopup(null)}
                style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>닫기</button>
            </div>
            {staffLoading ? (
              <p style={{ textAlign: 'center', color: '#94a3b8' }}>불러오는 중...</p>
            ) : staffPopup.staff.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8' }}>소속 인원이 없습니다.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['이름', '직군', '직위', '연락처', '입사일'].map(h => (
                      <th key={h} style={{ ...th, backgroundColor: '#1e3a5f' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffPopup.staff.map((s, i) => (
                    <tr key={s.id}>
                      <td style={td(i)}><strong>{s.name}</strong></td>
                      <td style={td(i)}>{s.jobGrade || '-'}</td>
                      <td style={td(i)}>{s.title || '-'}</td>
                      <td style={{ ...td(i), fontFamily: 'monospace' }}>
                        {s.mobile ? <a href={`tel:${s.mobile}`} style={{ color: '#29ABE2', textDecoration: 'none' }}>{s.mobile}</a> : '-'}
                      </td>
                      <td style={{ ...td(i), fontSize: 12 }}>
                        {s.hireDate ? new Date(s.hireDate).toLocaleDateString('ko-KR') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 28, width: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>{editingId ? '지사 수정' : '지사 등록'}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {[
                { key: 'name', label: '지사명 *' },
                { key: 'shortName', label: '약칭' },
                { key: 'phone', label: '전화번호' },
                { key: 'fax', label: '팩스' },
                { key: 'bizNumber', label: '사업자등록번호' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
                  <input type="text" value={form[key] || ''}
                    onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>계좌번호 (예금주 포함)</label>
              <input type="text" value={form.bankAccount || ''}
                onChange={e => setForm((p: any) => ({ ...p, bankAccount: e.target.value }))}
                placeholder="예: 농협 301-0000-0000-00 노무법인 더보상"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>주소</label>
              <input type="text" value={form.address || ''}
                onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginTop: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>권역</label>
                <select value={form.region || ''}
                  onChange={e => setForm((p: any) => ({ ...p, region: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
                  <option value="">선택</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>표시 순서</label>
                <input type="number" value={form.displayOrder || 0}
                  onChange={e => setForm((p: any) => ({ ...p, displayOrder: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
              </div>
            </div>

            {/* TF 관리 */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>담당 TF 목록</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, padding: '8px', border: '1px solid #e2e8f0', borderRadius: 6, minHeight: 36 }}>
                {form.assignedTFs.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>배정된 TF 없음</span>
                ) : form.assignedTFs.map((tf: string) => (
                  <span key={tf} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, fontSize: 11, color: '#0369a1' }}>
                    {tf}
                    <button onClick={() => removeTf(tf)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={tfInput} onChange={e => setTfInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTf() } }}
                  placeholder="TF명 입력 후 Enter 또는 추가 클릭"
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }} />
                <button onClick={addTf}
                  style={{ padding: '7px 14px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>+ 추가</button>
              </div>
            </div>

            {/* 지사장 */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>지사장 (Contact ID)</label>
              <input type="text" value={form.branchManagerId || ''}
                onChange={e => setForm((p: any) => ({ ...p, branchManagerId: e.target.value }))}
                placeholder="Contact ID 또는 직접 입력"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' as const }} />
            </div>

            {/* 비활성화 */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="isActive" checked={form.isActive}
                onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))} />
              <label htmlFor="isActive" style={{ fontSize: 13, cursor: 'pointer' }}>활성 상태</label>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalOpen(false)} disabled={saving}
                style={{ padding: '8px 20px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>취소</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '8px 20px', backgroundColor: '#29ABE2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
