"use client";

import { useEffect, useState } from "react";

type SignupRequest = {
  id: string; name: string; email: string; department: string | null;
  jobTitle: string | null; message: string | null; status: string; createdAt: string;
};
type User = { id: string; email: string; name: string; role: string; createdAt: string };
type UserDetail = { personalId?: string | null };

const ROLES = ["ADMIN", "STAFF", "READONLY"];

const statusBadge: Record<string, React.CSSProperties> = {
  PENDING:  { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" },
  APPROVED: { background: "#d1fae5", color: "#065f46", border: "1px solid #6ee7b7" },
  REJECTED: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
};
const statusLabel: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "거절" };

export default function AccountsPage() {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // 계정 직접 생성 폼
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [adding, setAdding] = useState(false);

  // personalId 편집 모달 상태
  const [pidUser, setPidUser] = useState<User | null>(null);
  const [pidValue, setPidValue] = useState("");
  const [pidSaving, setPidSaving] = useState(false);

  // 승인 모달 상태
  const [approveReq, setApproveReq] = useState<SignupRequest | null>(null);
  const [approvePassword, setApprovePassword] = useState("");
  const [approveRole, setApproveRole] = useState("STAFF");
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, []);

  async function fetchRequests() {
    setReqLoading(true);
    const res = await fetch("/api/admin/signup-requests");
    if (res.ok) setRequests(await res.json());
    else setError("가입 요청 목록을 불러오지 못했습니다.");
    setReqLoading(false);
  }

  async function fetchUsers() {
    setUsersLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setUsersLoading(false);
  }

  async function handleApprove() {
    if (!approveReq) return;
    if (!approvePassword) { alert("초기 비밀번호를 입력하세요."); return; }
    setApproving(true);
    // 1. 요청 승인
    const patchRes = await fetch(`/api/admin/signup-requests/${approveReq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (!patchRes.ok) { alert("승인 처리 실패"); setApproving(false); return; }

    // 2. 계정 생성
    const createRes = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: approveReq.name,
        email: approveReq.email,
        password: approvePassword,
        role: approveRole,
      }),
    });
    if (!createRes.ok) {
      const d = await createRes.json();
      alert(`계정 생성 실패: ${d.error}`);
      setApproving(false); return;
    }
    setApproveReq(null);
    setApprovePassword("");
    setApproveRole("STAFF");
    setApproving(false);
    await Promise.all([fetchRequests(), fetchUsers()]);
  }

  async function handleReject(id: string) {
    if (!confirm("이 요청을 거절하시겠습니까?")) return;
    await fetch(`/api/admin/signup-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    await fetchRequests();
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", email: "", password: "", role: "STAFF" });
      await fetchUsers();
    } else {
      const d = await res.json();
      setError(d.error ?? "계정 생성 실패");
    }
    setAdding(false);
  }

  async function openPidModal(user: User) {
    setPidUser(user);
    // 현재 저장된 personalId 조회
    const res = await fetch(`/api/admin/users/${user.id}`);
    if (res.ok) {
      const d: UserDetail = await res.json();
      setPidValue(d.personalId ?? "");
    } else {
      setPidValue("");
    }
  }

  async function handleSavePid() {
    if (!pidUser) return;
    setPidSaving(true);
    await fetch(`/api/admin/users/${pidUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalId: pidValue }),
    });
    setPidSaving(false);
    setPidUser(null);
    setPidValue("");
  }

  async function handleRoleChange(id: string, role: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await fetchUsers();
  }

  async function handleDeleteUser(id: string, name: string) {
    if (!confirm(`"${name}" 계정을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.status === 204) await fetchUsers();
    else { const d = await res.json(); alert(d.error); }
  }

  return (
    <div>
      {error && <p style={s.err}>{error}</p>}

      {/* 섹션 1: 가입 요청 */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>가입 요청 목록</h2>
        {reqLoading ? <p style={s.dim}>불러오는 중…</p> : (
          requests.length === 0 ? <p style={s.dim}>접수된 가입 요청이 없습니다.</p> : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>{["이름", "이메일", "소속", "직책", "요청사유", "요청일시", "상태", "액션"].map(h =>
                    <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td style={s.td}>{r.name}</td>
                      <td style={s.td}>{r.email}</td>
                      <td style={s.td}>{r.department ?? "-"}</td>
                      <td style={s.td}>{r.jobTitle ?? "-"}</td>
                      <td style={{ ...s.td, maxWidth: 180, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.message ?? "-"}</td>
                      <td style={s.td}>{new Date(r.createdAt).toLocaleString("ko-KR")}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, ...statusBadge[r.status] }}>
                          {statusLabel[r.status] ?? r.status}
                        </span>
                      </td>
                      <td style={s.td}>
                        {r.status === "PENDING" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setApproveReq(r); setApprovePassword(""); setApproveRole("STAFF"); }} style={s.approveBtn}>승인</button>
                            <button onClick={() => handleReject(r.id)} style={s.rejectBtn}>거절</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* 섹션 2: 계정 직접 생성 */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>계정 직접 생성</h2>
        <form onSubmit={handleAddUser} style={s.formBox}>
          <div style={s.formRow}>
            <input placeholder="이름" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={s.inp} required />
            <input placeholder="이메일" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} style={s.inp} required />
            <input placeholder="초기 비밀번호" type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} style={s.inp} required />
            <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))} style={s.sel}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit" disabled={adding} style={s.addBtn}>{adding ? "생성 중…" : "계정 생성"}</button>
          </div>
        </form>
      </div>

      {/* 섹션 3: 전체 계정 목록 */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>전체 계정 목록</h2>
        <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="이름 또는 이메일 검색"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: "7px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, width: 240, outline: "none" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ padding: "7px 12px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13 }}
            >
              초기화
            </button>
          )}
          <span style={{ color: "#64748b", fontSize: 13 }}>
            총 {users.filter(u => !searchQuery || u.name?.includes(searchQuery) || u.email?.includes(searchQuery)).length}명
          </span>
        </div>
        {usersLoading ? <p style={s.dim}>불러오는 중…</p> : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>{["이름", "이메일", "권한", "가입일", "노무사 정보", ""].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {users.filter(u => !searchQuery || u.name?.includes(searchQuery) || u.email?.includes(searchQuery)).map(u => (
                  <tr key={u.id}>
                    <td style={s.td}>{u.name}</td>
                    <td style={s.td}>{u.email}</td>
                    <td style={s.td}>
                      <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} style={s.roleSelect}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={s.td}>{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td style={s.td}>
                      <button onClick={() => openPidModal(u)} style={{ padding: "3px 8px", fontSize: 11, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 4, cursor: "pointer" }}>
                        주민번호 등록
                      </button>
                    </td>
                    <td style={s.td}>
                      <button onClick={() => handleDeleteUser(u.id, u.name)} style={s.delBtn}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* personalId 편집 모달 */}
      {pidUser && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>주민번호 등록 (서식 자동생성용)</h3>
            <p style={s.modalDesc}>
              <b>{pidUser.name}</b> ({pidUser.email})<br/>
              <span style={{ fontSize: 11, color: "#6b7280" }}>공인노무사 주민번호는 정보공개청구서 등 서식 자동생성 시 사용됩니다.</span>
            </p>
            <div>
              <label style={s.label}>주민등록번호</label>
              <input
                type="text"
                value={pidValue}
                onChange={e => setPidValue(e.target.value)}
                style={s.modalInp}
                placeholder="예: 920109-1113615"
                maxLength={14}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
              <button onClick={() => { setPidUser(null); setPidValue(""); }} style={s.cancelBtn}>취소</button>
              <button onClick={handleSavePid} disabled={pidSaving} style={{ ...s.approveBtn, background: "#1d4ed8" }}>
                {pidSaving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승인 모달 */}
      {approveReq && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>가입 요청 승인</h3>
            <p style={s.modalDesc}>
              <b>{approveReq.name}</b> ({approveReq.email}) 계정을 생성합니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={s.label}>초기 비밀번호</label>
                <input
                  type="password" value={approvePassword}
                  onChange={e => setApprovePassword(e.target.value)}
                  style={s.modalInp} placeholder="초기 비밀번호 입력"
                />
              </div>
              <div>
                <label style={s.label}>권한</label>
                <select value={approveRole} onChange={e => setApproveRole(e.target.value)} style={s.sel}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
              <button onClick={() => setApproveReq(null)} style={s.cancelBtn}>취소</button>
              <button onClick={handleApprove} disabled={approving} style={s.approveBtn}>
                {approving ? "처리 중…" : "승인 및 계정 생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  err:          { color: "#dc2626", fontSize: 13, marginBottom: 12 } as React.CSSProperties,
  section:      { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", marginBottom: 20 } as React.CSSProperties,
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 14px" } as React.CSSProperties,
  dim:          { fontSize: 13, color: "#9ca3af", margin: 0 } as React.CSSProperties,
  tableWrap:    { overflowX: "auto" as const },
  table:        { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th:           { background: "#29ABE2", padding: "9px 12px", textAlign: "left" as const, fontWeight: 600, color: "#fff", borderBottom: "2px solid #1A8BBF", whiteSpace: "nowrap" as const },
  td:           { padding: "9px 12px", borderBottom: "1px solid #f3f4f6", color: "#111827", verticalAlign: "top" as const } as React.CSSProperties,
  badge:        { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 } as React.CSSProperties,
  approveBtn:   { padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#065f46", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" } as React.CSSProperties,
  rejectBtn:    { padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer" } as React.CSSProperties,
  formBox:      { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 20px" } as React.CSSProperties,
  formRow:      { display: "flex", gap: 8, flexWrap: "wrap" as const },
  inp:          { padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, flex: 1, minWidth: 120 } as React.CSSProperties,
  sel:          { padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6 } as React.CSSProperties,
  addBtn:       { padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" } as React.CSSProperties,
  roleSelect:   { padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 } as React.CSSProperties,
  delBtn:       { padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, background: "#fef2f2", cursor: "pointer" } as React.CSSProperties,
  // 모달
  overlay:      { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modal:        { background: "#fff", borderRadius: 12, padding: 28, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" } as React.CSSProperties,
  modalTitle:   { fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 10px" } as React.CSSProperties,
  modalDesc:    { fontSize: 13, color: "#374151", margin: "0 0 16px" } as React.CSSProperties,
  label:        { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 } as React.CSSProperties,
  modalInp:     { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" as const } as React.CSSProperties,
  cancelBtn:    { padding: "8px 16px", fontSize: 13, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" } as React.CSSProperties,
};
