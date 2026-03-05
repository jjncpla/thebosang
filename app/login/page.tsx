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
      <div style={s.card}>
        <div style={s.logo}>
          <p style={s.title}>노무법인 더보상</p>
          <p style={s.sub}>업무 지원 시스템</p>
        </div>
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
        </form>
      </div>
    </div>
  );
}

const s = {
  page:       { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "'Pretendard','Noto Sans KR',sans-serif" } as React.CSSProperties,
  card:       { background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,.10)", padding: "40px 36px", width: "100%", maxWidth: 380 } as React.CSSProperties,
  logo:       { textAlign: "center" as const, marginBottom: 28 },
  title:      { fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 } as React.CSSProperties,
  sub:        { fontSize: 13, color: "#6b7280", margin: "6px 0 0" } as React.CSSProperties,
  form:       { display: "flex", flexDirection: "column" as const, gap: 16 },
  field:      { display: "flex", flexDirection: "column" as const, gap: 6 },
  label:      { fontSize: 13, fontWeight: 600, color: "#374151" } as React.CSSProperties,
  input:      { padding: "10px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 7, outline: "none", color: "#111" } as React.CSSProperties,
  error:      { fontSize: 13, color: "#dc2626", margin: 0, textAlign: "center" as const },
  btn:        { marginTop: 4, padding: "11px", fontSize: 15, fontWeight: 700, background: "#1e40af", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
  btnDisabled:{ background: "#93c5fd", cursor: "wait" } as React.CSSProperties,
};
