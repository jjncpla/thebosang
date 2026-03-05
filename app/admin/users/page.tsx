"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type User = { id: string; email: string; name: string; role: string; createdAt: string };
const ROLES = ["ADMIN", "STAFF", "READONLY"];

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // 추가 폼 상태
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "READONLY" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && session.user.role !== "ADMIN") { router.replace("/"); return; }
    if (status === "authenticated") fetchUsers();
  }, [status]);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    else setError("사용자 목록을 불러오지 못했습니다.");
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ email: "", password: "", name: "", role: "READONLY" });
      await fetchUsers();
    } else {
      const d = await res.json();
      setError(d.error ?? "추가 실패");
    }
    setAdding(false);
  }

  async function handleRoleChange(id: string, role: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await fetchUsers();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 계정을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.status === 204) await fetchUsers();
    else { const d = await res.json(); alert(d.error); }
  }

  if (status === "loading" || loading) return <div style={s.loading}>불러오는 중…</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <Link href="/" style={s.back}>← 메인으로</Link>
        <h1 style={s.title}>사용자 관리</h1>
      </div>

      {error && <p style={s.err}>{error}</p>}

      {/* 사용자 추가 폼 */}
      <form onSubmit={handleAdd} style={s.addForm}>
        <h2 style={s.sectionTitle}>새 계정 추가</h2>
        <div style={s.formRow}>
          <input placeholder="이름" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={s.inp} required />
          <input placeholder="이메일" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} style={s.inp} required />
          <input placeholder="비밀번호" type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} style={s.inp} required />
          <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))} style={s.sel}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" disabled={adding} style={s.addBtn}>{adding ? "추가 중…" : "추가"}</button>
        </div>
      </form>

      {/* 사용자 목록 */}
      <div style={s.tableWrap}>
        <h2 style={s.sectionTitle}>계정 목록 ({users.length}명)</h2>
        <table style={s.table}>
          <thead>
            <tr>
              {["이름", "이메일", "권한", "가입일", ""].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={u.id === session?.user?.id ? s.selfRow : {}}>
                <td style={s.td}>{u.name}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}>
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    style={s.roleSelect}
                    disabled={u.id === session?.user?.id}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td style={s.td}>{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                <td style={s.td}>
                  {u.id !== session?.user?.id && (
                    <button onClick={() => handleDelete(u.id, u.name)} style={s.delBtn}>삭제</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  page:         { maxWidth: 860, margin: "0 auto", padding: "32px 20px", fontFamily: "'Pretendard','Noto Sans KR',sans-serif" } as React.CSSProperties,
  loading:      { textAlign: "center" as const, padding: 80, color: "#9ca3af" },
  header:       { display: "flex", alignItems: "center", gap: 16, marginBottom: 28 } as React.CSSProperties,
  back:         { fontSize: 13, color: "#6b7280", textDecoration: "none" } as React.CSSProperties,
  title:        { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 } as React.CSSProperties,
  err:          { color: "#dc2626", fontSize: 13, margin: "0 0 12px" } as React.CSSProperties,
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#374151", margin: "0 0 12px" } as React.CSSProperties,
  addForm:      { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 20px", marginBottom: 28 } as React.CSSProperties,
  formRow:      { display: "flex", gap: 8, flexWrap: "wrap" as const },
  inp:          { padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, flex: 1, minWidth: 120 } as React.CSSProperties,
  sel:          { padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6 } as React.CSSProperties,
  addBtn:       { padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" } as React.CSSProperties,
  tableWrap:    { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20 } as React.CSSProperties,
  table:        { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th:           { background: "#f9fafb", padding: "10px 12px", textAlign: "left" as const, fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb" },
  td:           { padding: "10px 12px", borderBottom: "1px solid #f3f4f6", color: "#111827" } as React.CSSProperties,
  selfRow:      { background: "#eff6ff" } as React.CSSProperties,
  roleSelect:   { padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" } as React.CSSProperties,
  delBtn:       { padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, background: "#fef2f2", cursor: "pointer" } as React.CSSProperties,
};
