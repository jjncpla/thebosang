"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    <div style={s.page}>
      <div style={s.container}>
        {/* 상단 행: 로고 + 로그인 카드 */}
        <div style={s.topRow}>
          <div style={s.logoWrap}>
            <svg viewBox="0 0 100 130" width="100%" height="100%">
              <circle cx="23" cy="13" r="11" fill="#29ABE2"/>
              <circle cx="72" cy="13" r="11" fill="#8DC63F"/>
              <rect x="5"  y="28" width="22" height="22" fill="#006838"/>
              <rect x="27" y="28" width="68" height="22" fill="#8DC63F"/>
              <rect x="73" y="50" width="22" height="50" fill="#8DC63F"/>
              <rect x="5"  y="50" width="22" height="50" fill="#29ABE2"/>
              <rect x="27" y="78" width="46" height="22" fill="#29ABE2"/>
              <rect x="73" y="78" width="22" height="22" fill="#006838"/>
              <rect x="27" y="50" width="46" height="28" fill="#f1f5f9"/>
            </svg>
          </div>
          <div style={s.loginCard}>
            <p style={s.loginTitle}>노무법인 더보상 TBSS</p>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>이메일</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  style={s.input} placeholder="admin@dbs.com" required autoFocus
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>비밀번호</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  style={s.input} required
                />
              </div>
              {error && <p style={s.error}>{error}</p>}
              <button type="submit" disabled={loading} style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}>
                {loading ? "로그인 중…" : "로그인"}
              </button>
              <button
                type="button"
                style={s.btnSecondary}
                onClick={() => setShowModal(true)}
              >
                계정 가입 요청
              </button>
            </form>
          </div>
        </div>

        {/* 하단 행: 대표인사말 + 공지사항 */}
        <div style={s.bottomRow}>
          <div style={s.card}>
            <p style={s.cardTitle}>대표 인사말</p>
            {greeting?.content
              ? <p style={s.cardContent}>{greeting.content}</p>
              : <p style={s.cardEmpty}>(준비 중입니다)</p>
            }
          </div>
          <div style={s.card}>
            <p style={s.cardTitle}>{notice?.title || "공지사항"}</p>
            {notice?.content
              ? <p style={s.cardContent}>{notice.content}</p>
              : <p style={s.cardEmpty}>(등록된 공지사항이 없습니다)</p>
            }
          </div>
        </div>
      </div>

      {/* 가입 요청 모달 */}
      {showModal && <SignupModal onClose={() => setShowModal(false)} />}
    </div>
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
        <h3 style={ms.title}>계정 가입 요청</h3>
        {success ? (
          <div>
            <p style={ms.successMsg}>가입 요청이 접수되었습니다.<br/>관리자 승인 후 계정이 생성됩니다.</p>
            <button onClick={onClose} style={ms.btnPrimary}>닫기</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={ms.form}>
            <div style={ms.field}>
              <label style={ms.label}>이름 *</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={ms.inp} required />
            </div>
            <div style={ms.field}>
              <label style={ms.label}>이메일 *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} style={ms.inp} required />
            </div>
            <div style={ms.field}>
              <label style={ms.label}>소속 지사</label>
              <input value={form.department} onChange={e => setForm(p => ({...p, department: e.target.value}))} style={ms.inp} placeholder="예: 서울 지사" />
            </div>
            <div style={ms.field}>
              <label style={ms.label}>직책</label>
              <input value={form.jobTitle} onChange={e => setForm(p => ({...p, jobTitle: e.target.value}))} style={ms.inp} placeholder="예: 노무사" />
            </div>
            <div style={ms.field}>
              <label style={ms.label}>요청 사유</label>
              <textarea value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value}))} style={ms.textarea} rows={3} placeholder="가입 요청 사유를 입력하세요." />
            </div>
            {error && <p style={ms.err}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={ms.btnCancel}>취소</button>
              <button type="submit" disabled={loading} style={ms.btnPrimary}>{loading ? "제출 중…" : "요청 제출"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const s = {
  page:         { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef6f0", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif" } as React.CSSProperties,
  container:    { width: "100%", maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column" as const, gap: 16, padding: "0 16px" },
  topRow:       { display: "flex", gap: 16, alignItems: "stretch" } as React.CSSProperties,
  logoWrap:     { width: 200, flexShrink: 0, height: "100%" } as React.CSSProperties,
  bottomRow:    { display: "flex", gap: 16 } as React.CSSProperties,
  card:         { flex: 1, background: "#fff", borderRadius: 10, padding: 24, border: "1px solid #e5e7eb", minHeight: 180 } as React.CSSProperties,
  cardTitle:    { fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 12px" } as React.CSSProperties,
  cardEmpty:    { fontSize: 13, color: "#9ca3af", margin: 0 } as React.CSSProperties,
  cardContent:  { fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap" as const, lineHeight: 1.7 } as React.CSSProperties,
  loginCard:    { flex: 1, background: "#fff", borderRadius: 10, padding: "32px 36px", border: "1px solid #e5e7eb", boxSizing: "border-box" as const },
  loginTitle:   { fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 24px", textAlign: "center" as const },
  form:         { display: "flex", flexDirection: "column" as const, gap: 14 },
  field:        { display: "flex", flexDirection: "column" as const, gap: 6 },
  label:        { fontSize: 13, fontWeight: 600, color: "#374151" } as React.CSSProperties,
  input:        { padding: "10px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 7, outline: "none", color: "#111" } as React.CSSProperties,
  error:        { fontSize: 13, color: "#dc2626", margin: 0, textAlign: "center" as const },
  btn:          { marginTop: 4, padding: "11px", fontSize: 15, fontWeight: 700, background: "#29ABE2", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
  btnDisabled:  { background: "#93c5fd", cursor: "wait" } as React.CSSProperties,
  btnSecondary: { padding: "10px", fontSize: 14, fontWeight: 500, background: "#fff", color: "#006838", border: "1px solid #8DC63F", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
};

const ms = {
  overlay:    { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modal:      { background: "#fff", borderRadius: 12, padding: "28px 32px", width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" as const } as React.CSSProperties,
  title:      { fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 20px" } as React.CSSProperties,
  form:       { display: "flex", flexDirection: "column" as const, gap: 12 },
  field:      { display: "flex", flexDirection: "column" as const, gap: 5 },
  label:      { fontSize: 13, fontWeight: 600, color: "#374151" } as React.CSSProperties,
  inp:        { padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, outline: "none" } as React.CSSProperties,
  textarea:   { padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical" as const, fontFamily: "inherit", outline: "none" } as React.CSSProperties,
  err:        { fontSize: 13, color: "#dc2626", margin: 0 } as React.CSSProperties,
  successMsg: { fontSize: 14, color: "#065f46", background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "14px 16px", margin: "0 0 16px", lineHeight: 1.7 } as React.CSSProperties,
  btnPrimary: { padding: "10px 20px", fontSize: 14, fontWeight: 700, background: "#29ABE2", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
  btnCancel:  { padding: "10px 20px", fontSize: 14, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
};
