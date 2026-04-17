'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 클라이언트 측 정책 체크 (서버에서도 동일 검증)
  const policyCheck = (pw: string): string | null => {
    if (pw.length < 8) return '8자 이상 입력해주세요.'
    if (!/[a-zA-Z]/.test(pw)) return '영문자를 1자 이상 포함해주세요.'
    if (!/[0-9]/.test(pw)) return '숫자를 1자 이상 포함해주세요.'
    if (/\s/.test(pw)) return '공백은 사용할 수 없습니다.'
    return null
  }

  const newPasswordError = newPassword.length > 0 ? policyCheck(newPassword) : null
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!currentPassword) {
      setError('현재 비밀번호를 입력해주세요.')
      return
    }
    const policy = policyCheck(newPassword)
    if (policy) {
      setError(`새 비밀번호 규칙: ${policy}`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (currentPassword === newPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '변경에 실패했습니다.')
        return
      }
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('서버와의 통신에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        불러오는 중...
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
        로그인이 필요합니다.
      </div>
    )
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8,
    fontSize: 14, background: '#f9fafb', color: '#111827', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 32,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
          비밀번호 변경
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>
          {session?.user?.email ? `${session.user.email} 계정의 비밀번호를 변경합니다.` : ''}
        </p>

        {/* 정책 안내 */}
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
          padding: '12px 14px', marginBottom: 20, fontSize: 12, color: '#0369a1',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>비밀번호 규칙</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>8자 이상</li>
            <li>영문자와 숫자를 각각 1자 이상 포함</li>
            <li>공백 사용 불가</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>현재 비밀번호</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              style={inputStyle}
              placeholder="현재 비밀번호 입력"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor: newPasswordError ? '#dc2626' : inputStyle.border as string,
              }}
              placeholder="8자 이상, 영문+숫자"
            />
            {newPasswordError && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626' }}>
                {newPasswordError}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor: mismatch ? '#dc2626' : inputStyle.border as string,
              }}
              placeholder="동일한 비밀번호 재입력"
            />
            {mismatch && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626' }}>
                비밀번호가 일치하지 않습니다.
              </div>
            )}
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, fontSize: 13, color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: 16, padding: '10px 14px',
              background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: 8, fontSize: 13, color: '#166534',
            }}>
              비밀번호가 성공적으로 변경되었습니다.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              style={{
                padding: '10px 20px', border: '1.5px solid #e5e7eb', borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: '#475569',
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 24px', border: 'none', borderRadius: 8,
                background: submitting
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #006838, #29ABE2)',
                color: '#fff', cursor: submitting ? 'wait' : 'pointer',
                fontSize: 13, fontWeight: 700,
              }}
            >
              {submitting ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
