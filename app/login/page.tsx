"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

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
        {/* 상단 2단 박스 */}
        <div style={s.topRow}>
          <div style={s.card}>
            <p style={s.cardTitle}>대표 인사말</p>
            <p style={s.cardEmpty}>(준비 중입니다)</p>
          </div>
          <div style={s.card}>
            <p style={s.cardTitle}>공지사항</p>
            <p style={s.cardEmpty}>(등록된 공지사항이 없습니다)</p>
          </div>
        </div>

        {/* 하단 로그인 카드 */}
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
              onClick={() => alert("가입 요청은 관리자에게 문의하세요. (담당자 연락처 추후 추가)")}
            >
              계정 가입 요청
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:         { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif" } as React.CSSProperties,
  container:    { width: "100%", maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column" as const, gap: 16, padding: "0 16px" },
  topRow:       { display: "flex", gap: 16 },
  card:         { flex: 1, background: "#fff", borderRadius: 10, padding: 24, border: "1px solid #e5e7eb" } as React.CSSProperties,
  cardTitle:    { fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 12px" } as React.CSSProperties,
  cardEmpty:    { fontSize: 13, color: "#9ca3af", margin: 0 } as React.CSSProperties,
  loginCard:    { width: "100%", background: "#fff", borderRadius: 10, padding: "32px 36px", border: "1px solid #e5e7eb", boxSizing: "border-box" as const },
  loginTitle:   { fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 24px", textAlign: "center" as const },
  form:         { display: "flex", flexDirection: "column" as const, gap: 14 },
  field:        { display: "flex", flexDirection: "column" as const, gap: 6 },
  label:        { fontSize: 13, fontWeight: 600, color: "#374151" } as React.CSSProperties,
  input:        { padding: "10px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 7, outline: "none", color: "#111" } as React.CSSProperties,
  error:        { fontSize: 13, color: "#dc2626", margin: 0, textAlign: "center" as const },
  btn:          { marginTop: 4, padding: "11px", fontSize: 15, fontWeight: 700, background: "#1e40af", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
  btnDisabled:  { background: "#93c5fd", cursor: "wait" } as React.CSSProperties,
  btnSecondary: { padding: "10px", fontSize: 14, fontWeight: 500, background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
};
