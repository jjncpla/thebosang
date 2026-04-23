'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Attachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  category: string | null
  description: string | null
  createdAt: string
  uploadedById: string | null
}

const CATEGORIES = [
  { value: '', label: '전체' },
  { value: 'SENT', label: '발신' },
  { value: 'RECEIVED', label: '수신' },
  { value: 'INTERNAL', label: '내부' },
  { value: 'OTHER', label: '기타' },
  { value: 'LABOR_ATTORNEY_RECORD', label: '업무처리부' },
]

const CATEGORY_LABELS: Record<string, string> = {
  SENT: '발신', RECEIVED: '수신', INTERNAL: '내부', OTHER: '기타',
  LABOR_ATTORNEY_RECORD: '업무처리부',
}

// 자동 생성되는 카테고리 — 사용자가 수동 업로드·삭제 불가
const AUTO_GENERATED_CATEGORIES = new Set(['LABOR_ATTORNEY_RECORD'])

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function fileIcon(mimeType: string, fileName: string): string {
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.startsWith('image/')) return '🖼'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return '📊'
  if (mimeType.includes('word') || mimeType.includes('document') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) return '📝'
  if (mimeType.includes('hwp') || fileName.endsWith('.hwp')) return '📋'
  return '📎'
}

function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

export default function CaseAttachments({ caseId }: { caseId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [uploadCategory, setUploadCategory] = useState('RECEIVED')
  const [uploadDesc, setUploadDesc] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchAttachments = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterCategory ? `?category=${filterCategory}` : ''
      const res = await fetch(`/api/cases/${caseId}/attachments${params}`)
      const data = await res.json()
      setAttachments(data.attachments || [])
    } finally {
      setLoading(false)
    }
  }, [caseId, filterCategory])

  useEffect(() => { fetchAttachments() }, [fetchAttachments])

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files)
    for (const file of fileArr) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`"${file.name}"이 10MB를 초과합니다.`)
        continue
      }
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        if (uploadCategory) fd.append('category', uploadCategory)
        if (uploadDesc) fd.append('description', uploadDesc)
        const res = await fetch(`/api/cases/${caseId}/attachments`, { method: 'POST', body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          showToast(`업로드 실패: ${err.error || '알 수 없는 오류'}`, 'err')
        } else {
          showToast(`"${file.name}" 업로드 완료`, 'ok')
          setUploadDesc('')
          fetchAttachments()
        }
      } catch {
        showToast('업로드 중 오류 발생', 'err')
      } finally {
        setUploading(false)
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }

  const handleDelete = async (a: Attachment) => {
    if (!confirm(`"${a.fileName}"을 삭제하시겠습니까?`)) return
    setDeleting(a.id)
    try {
      const res = await fetch(`/api/cases/${caseId}/attachments/${a.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(`삭제 실패: ${err.error || '권한 없음'}`, 'err')
      } else {
        showToast('삭제되었습니다', 'ok')
        fetchAttachments()
      }
    } finally {
      setDeleting(null)
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, marginBottom: 4 }
  const selectStyle: React.CSSProperties = { padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, color: '#374151', background: 'white' }

  return (
    <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: 10 }}>
      {/* 헤더 */}
      <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1 }}>첨부파일</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{attachments.length}개</span>
      </div>

      <div style={{ padding: 12 }}>
        {/* 업로드 옵션 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>분류</label>
            <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              {CATEGORIES.filter(c => c.value && !AUTO_GENERATED_CATEGORIES.has(c.value)).map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>설명 (선택)</label>
            <input
              type="text"
              value={uploadDesc}
              onChange={e => setUploadDesc(e.target.value)}
              placeholder="파일 설명..."
              style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#29ABE2' : '#d1d5db'}`,
            borderRadius: 8,
            padding: '12px 8px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragOver ? '#f0f9ff' : '#fafafa',
            transition: 'all 0.15s',
            marginBottom: 10,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files) { uploadFiles(e.target.files); e.target.value = '' } }}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.hwp"
          />
          {uploading ? (
            <span style={{ fontSize: 12, color: '#29ABE2' }}>업로드 중...</span>
          ) : (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>📎 파일을 드래그하거나 클릭하여 첨부 (최대 10MB)</span>
          )}
        </div>

        {/* 분류 필터 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.value || 'all'}
              onClick={() => setFilterCategory(c.value)}
              style={{
                padding: '3px 10px', border: '1px solid #e5e7eb', borderRadius: 12,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                backgroundColor: filterCategory === c.value ? '#29ABE2' : 'white',
                color: filterCategory === c.value ? 'white' : '#6b7280',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 파일 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#9ca3af', fontSize: 12 }}>불러오는 중...</div>
        ) : attachments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#9ca3af', fontSize: 12 }}>첨부파일이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attachments.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(a.mimeType, a.fileName)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', gap: 6 }}>
                    <span>{formatSize(a.fileSize)}</span>
                    {a.category && <span style={{ color: '#29ABE2' }}>{CATEGORY_LABELS[a.category] || a.category}</span>}
                    {a.description && <span>{a.description}</span>}
                    <span>{new Date(a.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {isPreviewable(a.mimeType) && (
                    <a
                      href={`/api/cases/${caseId}/attachments/${a.id}/preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: '3px 7px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 4, color: '#6b7280', textDecoration: 'none', background: 'white' }}
                    >
                      미리보기
                    </a>
                  )}
                  <a
                    href={`/api/cases/${caseId}/attachments/${a.id}`}
                    download={a.fileName}
                    style={{ padding: '3px 7px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 4, color: '#29ABE2', textDecoration: 'none', background: 'white' }}
                  >
                    다운로드
                  </a>
                  {!AUTO_GENERATED_CATEGORIES.has(a.category ?? '') && (
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={deleting === a.id}
                      style={{ padding: '3px 7px', fontSize: 10, border: '1px solid #fecaca', borderRadius: 4, color: '#dc2626', background: 'white', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  )}
                  {AUTO_GENERATED_CATEGORIES.has(a.category ?? '') && (
                    <span style={{ padding: '3px 7px', fontSize: 10, border: '1px solid #fde68a', borderRadius: 4, color: '#92400e', background: '#fffbeb' }}>
                      🔒 자동
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          backgroundColor: toast.type === 'ok' ? '#dcfce7' : '#fee2e2',
          color: toast.type === 'ok' ? '#166534' : '#991b1b',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
