"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AgentOffice from "@/components/AgentOffice";

type Notice = { id: string; type: string; title: string | null; content: string } | null;

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  const [greeting, setGreeting] = useState<Notice>(null);
  const [notice,   setNotice]   = useState<Notice>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch("/api/admin/notices?type=GREETING").then(r => r.json()).then(setGreeting).catch(() => {});
    fetch("/api/admin/notices?type=NOTICE").then(r => r.json()).then(setNotice).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.push("/");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
          background: linear-gradient(135deg, #003d20 0%, #005a30 30%, #007040 60%, #004d2a 100%);
          position: relative;
          overflow: hidden;
        }

        .login-page::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 30%, rgba(41,171,226,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 80% 70%, rgba(141,198,63,0.08) 0%, transparent 60%);
          pointer-events: none;
        }

        .login-page::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .login-container {
          width: 100%;
          max-width: 1000px;
          padding: 24px 20px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── 헤더 ── */
        .login-header {
          text-align: center;
          margin-bottom: 8px;
        }

        .logo-area {
          display: inline-flex;
          align-items: center;
          gap: 18px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 18px 32px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .logo-svg-wrap {
          width: 56px;
          height: 72px;
          flex-shrink: 0;
          filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
        }

        .logo-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .logo-text-ko {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.7);
          letter-spacing: 0.05em;
        }

        .logo-text-main {
          font-size: 26px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .logo-text-sub {
          font-size: 11px;
          font-weight: 400;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 2px;
        }

        /* ── Claude Code 사무실 영역 ── */
        .agent-office-wrap {
          width: 100%;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
        }

        /* ── 메인 행 ── */
        .main-row {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
          align-items: start;
        }

        /* ── 로그인 카드 ── */
        .login-card {
          background: rgba(255,255,255,0.97);
          border-radius: 20px;
          padding: 40px 40px 36px;
          box-shadow:
            0 24px 80px rgba(0,0,0,0.3),
            0 0 0 1px rgba(255,255,255,0.15);
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .login-card-title {
          font-size: 22px;
          font-weight: 800;
          color: #0a2e18;
          margin: 0 0 6px;
          letter-spacing: -0.03em;
        }

        .login-card-subtitle {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 28px;
          font-weight: 400;
        }

        .login-divider {
          height: 1px;
          background: linear-gradient(90deg, #e5e7eb, transparent);
          margin-bottom: 24px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .form-input {
          padding: 12px 15px;
          font-size: 14px;
          font-family: inherit;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          outline: none;
          color: #111827;
          background: #f9fafb;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }

        .form-input:focus {
          border-color: #29ABE2;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(41,171,226,0.12);
        }

        .form-input::placeholder {
          color: #9ca3af;
          font-size: 13px;
        }

        .form-error {
          font-size: 12px;
          color: #dc2626;
          text-align: center;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 9px 14px;
          margin: 0;
        }

        .btn-login {
          margin-top: 6px;
          padding: 14px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          background: linear-gradient(135deg, #006838 0%, #29ABE2 100%);
          box-shadow: 0 4px 16px rgba(0,104,56,0.35);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          letter-spacing: 0.03em;
          position: relative;
          overflow: hidden;
        }

        .btn-login::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%);
          pointer-events: none;
        }

        .btn-login:hover:not(:disabled) {
          opacity: 0.93;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,104,56,0.4);
        }

        .btn-login:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-login:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .btn-signup {
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          color: #006838;
          background: #fff;
          border: 1.5px solid #8DC63F;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
          letter-spacing: 0.02em;
        }

        .btn-signup:hover {
          background: #f0faf0;
          border-color: #006838;
        }

        /* ── 오른쪽 패널 ── */
        .info-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .info-card {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          padding: 22px 24px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: background 0.2s;
        }

        .info-card:hover {
          background: rgba(255,255,255,0.11);
        }

        .info-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .info-card-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .info-card-icon.green {
          background: rgba(141, 198, 63, 0.2);
        }

        .info-card-icon.blue {
          background: rgba(41, 171, 226, 0.2);
        }

        .info-card-title {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,0.95);
          margin: 0;
        }

        .info-card-content {
          font-size: 13px;
          color: rgba(255,255,255,0.65);
          line-height: 1.75;
          margin: 0;
          white-space: pre-wrap;
        }

        .info-card-empty {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          margin: 0;
          font-style: italic;
        }

        /* ── 푸터 ── */
        .login-footer {
          text-align: center;
          font-size: 11.5px;
          color: rgba(255,255,255,0.35);
          padding-top: 4px;
          letter-spacing: 0.04em;
        }

        /* ── 반응형 ── */
        @media (max-width: 700px) {
          .main-row {
            grid-template-columns: 1fr;
          }
          .login-card {
            padding: 28px 22px 24px;
          }
          .logo-area {
            padding: 14px 20px;
          }
          .logo-text-main {
            font-size: 20px;
          }
        }
      `}</style>

      <div className="login-page">
        <div className="login-container">

          {/* 헤더: 로고 */}
          <div className="login-header">
            <div className="logo-area">
              <div className="logo-svg-wrap">
                <svg viewBox="0 0 100 130" width="100%" height="100%">
                  <circle cx="23" cy="13" r="11" fill="#29ABE2"/>
                  <circle cx="72" cy="13" r="11" fill="#8DC63F"/>
                  <rect x="5"  y="28" width="22" height="22" fill="#006838"/>
                  <rect x="27" y="28" width="68" height="22" fill="#8DC63F"/>
                  <rect x="73" y="50" width="22" height="50" fill="#8DC63F"/>
                  <rect x="5"  y="50" width="22" height="50" fill="#29ABE2"/>
                  <rect x="27" y="78" width="46" height="22" fill="#29ABE2"/>
                  <rect x="73" y="78" width="22" height="22" fill="#006838"/>
                  <rect x="27" y="50" width="46" height="28" fill="rgba(255,255,255,0.15)"/>
                </svg>
              </div>
              <div className="logo-text">
                <span className="logo-text-ko">노무법인</span>
                <span className="logo-text-main">더보상</span>
                <span className="logo-text-sub">The Bosang · TBSS</span>
              </div>
            </div>
          </div>

          {/* Claude Code 사무실 */}
          <div className="agent-office-wrap">
            <AgentOffice />
          </div>

          {/* 메인 행 */}
          <div className="main-row">

            {/* 로그인 카드 */}
            <div className="login-card">
              <p className="login-card-title">시스템 로그인</p>
              <p className="login-card-subtitle">업무지원시스템(TBSS)에 오신 것을 환영합니다</p>
              <div className="login-divider" />
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-field">
                  <label className="form-label">이메일</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="form-input" placeholder="example@thebosang.com" required autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">비밀번호</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="form-input" placeholder="••••••••" required
                  />
                </div>
                {error && <p className="form-error">{error}</p>}
                <button type="submit" disabled={loading} className="btn-login">
                  {loading ? "로그인 중…" : "로그인"}
                </button>
                <button
                  type="button"
                  className="btn-signup"
                  onClick={() => setShowModal(true)}
                >
                  계정 가입 요청
                </button>
              </form>
            </div>

            {/* 오른쪽 정보 패널 */}
            <div className="info-panel">
              <div className="info-card">
                <div className="info-card-header">
                  <div className="info-card-icon green">🌿</div>
                  <p className="info-card-title">대표 인사말</p>
                </div>
                {greeting?.content
                  ? <p className="info-card-content">{greeting.content}</p>
                  : <p className="info-card-empty">준비 중입니다</p>
                }
              </div>
              <div className="info-card">
                <div className="info-card-header">
                  <div className="info-card-icon blue">📋</div>
                  <p className="info-card-title">{notice?.title || "공지사항"}</p>
                </div>
                {notice?.content
                  ? <p className="info-card-content">{notice.content}</p>
                  : <p className="info-card-empty">등록된 공지사항이 없습니다</p>
                }
              </div>
            </div>

          </div>

          {/* 푸터 */}
          <div className="login-footer">
            © 2025 노무법인 더보상 · TBSS Business Support System · All rights reserved
          </div>

        </div>
      </div>

      {/* 가입 요청 모달 */}
      {showModal && <SignupModal onClose={() => setShowModal(false)} />}
    </>
  );
}

function SignupModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", department: "", jobTitle: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/signup-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess(true);
    } else {
      const d = await res.json();
      setError(d.error ?? "요청 실패");
    }
    setLoading(false);
  }

  return (
    <div style={ms.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={ms.modal}>
        <div style={ms.modalHeader}>
          <h3 style={ms.title}>계정 가입 요청</h3>
          <button onClick={onClose} style={ms.closeBtn}>✕</button>
        </div>
        <div style={ms.modalDivider} />
        {success ? (
          <div>
            <p style={ms.successMsg}>
              ✅ 가입 요청이 접수되었습니다.<br/>관리자 승인 후 계정이 생성됩니다.
            </p>
            <button onClick={onClose} style={ms.btnPrimary}>닫기</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={ms.form}>
            <div style={ms.field}>
              <label style={ms.label}>이름 *</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={ms.inp} required placeholder="홍길동" />
            </div>
            <div style={ms.field}>
              <label style={ms.label}>이메일 *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} style={ms.inp} required placeholder="example@thebosang.com" />
            </div>
            <div style={ms.twoCol}>
              <div style={ms.field}>
                <label style={ms.label}>소속 지사</label>
                <input value={form.department} onChange={e => setForm(p => ({...p, department: e.target.value}))} style={ms.inp} placeholder="서울 지사" />
              </div>
              <div style={ms.field}>
                <label style={ms.label}>직책</label>
                <input value={form.jobTitle} onChange={e => setForm(p => ({...p, jobTitle: e.target.value}))} style={ms.inp} placeholder="노무사" />
              </div>
            </div>
            <div style={ms.field}>
              <label style={ms.label}>요청 사유</label>
              <textarea value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value}))} style={ms.textarea} rows={3} placeholder="가입 요청 사유를 입력하세요." />
            </div>
            {error && <p style={ms.err}>{error}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" onClick={onClose} style={ms.btnCancel}>취소</button>
              <button type="submit" disabled={loading} style={ms.btnPrimary}>{loading ? "제출 중…" : "요청 제출"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const ms = {
  overlay:    { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)" },
  modal:      { background: "#fff", borderRadius: 16, padding: "28px 32px 32px", width: 480, boxShadow: "0 32px 80px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" as const } as React.CSSProperties,
  modalHeader:{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } as React.CSSProperties,
  modalDivider:{ height: 1, background: "#f3f4f6", marginBottom: 20 } as React.CSSProperties,
  title:      { fontSize: 18, fontWeight: 800, color: "#0a2e18", margin: 0, letterSpacing: "-0.02em" } as React.CSSProperties,
  closeBtn:   { background: "none", border: "none", fontSize: 16, color: "#9ca3af", cursor: "pointer", padding: "4px 8px", borderRadius: 6 } as React.CSSProperties,
  form:       { display: "flex", flexDirection: "column" as const, gap: 14 },
  twoCol:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  field:      { display: "flex", flexDirection: "column" as const, gap: 6 },
  label:      { fontSize: 11.5, fontWeight: 600, color: "#374151", textTransform: "uppercase" as const, letterSpacing: "0.06em" } as React.CSSProperties,
  inp:        { padding: "10px 13px", fontSize: 14, border: "1.5px solid #e5e7eb", borderRadius: 9, outline: "none", fontFamily: "inherit", background: "#f9fafb", color: "#111827" } as React.CSSProperties,
  textarea:   { padding: "10px 13px", fontSize: 14, border: "1.5px solid #e5e7eb", borderRadius: 9, resize: "vertical" as const, fontFamily: "inherit", outline: "none", background: "#f9fafb", color: "#111827" } as React.CSSProperties,
  err:        { fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 12px", margin: 0 } as React.CSSProperties,
  successMsg: { fontSize: 14, color: "#065f46", background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "16px 18px", margin: "0 0 18px", lineHeight: 1.8 } as React.CSSProperties,
  btnPrimary: { padding: "11px 22px", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#006838,#29ABE2)", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  btnCancel:  { padding: "11px 22px", fontSize: 14, background: "#fff", color: "#374151", border: "1.5px solid #e5e7eb", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
};
