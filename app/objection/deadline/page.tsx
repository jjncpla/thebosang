"use client";

import { useCallback, useEffect, useState } from "react";

const TF_OPTIONS = ["울산TF", "울산동부TF", "울산남부TF", "울산북부TF"];
const BRANCH_TF_MAP: Record<string, string[]> = {
  "울산지사": ["울산TF", "이산울산북부TF"],
  "울산동부지사": ["울산동부TF", "이산울산동부TF"],
  "울산남부지사": ["울산남부TF", "이산울산남부TF"],
};
const APPROVAL_OPTIONS = ["승인", "불승인", "일부승인"];
const PROGRESS_OPTIONS = ["진행중", "종결", "송무인계", "검토중"];
const EXAM_RESULT_OPTIONS = ["기각", "인용", "취하", "진행중"];

type Manager = { id: string; name: string };
type ObjectionCase = {
  id: string;
  tfName: string;
  patientName: string;
  caseType: string;
  approvalStatus: string;
  progressStatus: string;
  decisionDate: string | null;
  examClaimDate: string | null;
  examResult: string | null;
  examResultDate: string | null;
  reExamClaimDate: string | null;
  reExamResult: string | null;
  reExamResultDate: string | null;
  isQualityReview: boolean;
  manager: Manager | null;
  managerId: string | null;
  memo: string | null;
  litigationHandover: boolean;
  litigationMemo: string | null;
  needsReDecision: boolean;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toInputDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string | null, days: number): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d;
}

function getDeadline(item: ObjectionCase): Date | null {
  if (item.reExamResultDate) return addDays(item.reExamResultDate, 90);
  if (item.examResultDate && (item.examResult === "기각" || item.examResult === "인용")) return addDays(item.examResultDate, 90);
  return addDays(item.decisionDate, 90);
}

function getRowBg(item: ObjectionCase): string {
  const d = getDeadline(item);
  if (!d) return "white";
  const diff = (d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "#fef2f2";
  if (diff <= 7) return "#fefce8";
  return "white";
}

function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    승인: { bg: "#052e16", color: "#86efac" },
    불승인: { bg: "#450a0a", color: "#fca5a5" },
    일부승인: { bg: "#431407", color: "#fdba74" },
  };
  const s = map[status] ?? { bg: "#1e293b", color: "#94a3b8" };
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>{status}</span>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CaseForm = Record<string, any>;

function CaseModal({ initial, managers, onClose, onSave }: {
  initial: ObjectionCase | null;
  managers: Manager[];
  onClose: () => void;
  onSave: (form: CaseForm, id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<CaseForm>(() =>
    initial ? {
      ...initial,
      decisionDate: toInputDate(initial.decisionDate),
      examClaimDate: toInputDate(initial.examClaimDate),
      examResultDate: toInputDate(initial.examResultDate),
      reExamClaimDate: toInputDate(initial.reExamClaimDate),
      reExamResultDate: toInputDate(initial.reExamResultDate),
    } : { tfName: "", patientName: "", caseType: "", approvalStatus: "불승인", progressStatus: "진행중", isQualityReview: false }
  );
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setForm((f: CaseForm) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form, initial?.id); onClose(); }
    catch { alert("저장 오류"); }
    finally { setSaving(false); }
  };

  const inputStyle = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", width: "100%" };
  const labelStyle = { fontSize: 11, color: "#6b7280", fontWeight: 700 as const, display: "block" as const, marginBottom: 3 };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 24, zIndex: 1000, maxWidth: 640, width: "95%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" }}>{initial ? "수정" : "등록"} — 기일관리</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
          <div><label style={labelStyle}>TF</label><select style={inputStyle} value={form.tfName ?? ""} onChange={e => set("tfName", e.target.value)}><option value="">선택</option>{TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={labelStyle}>성명</label><input style={inputStyle} value={form.patientName ?? ""} onChange={e => set("patientName", e.target.value)} /></div>
          <div><label style={labelStyle}>사건분류</label><input style={inputStyle} value={form.caseType ?? ""} onChange={e => set("caseType", e.target.value)} /></div>
          <div><label style={labelStyle}>승인여부</label><select style={inputStyle} value={form.approvalStatus ?? ""} onChange={e => set("approvalStatus", e.target.value)}>{APPROVAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label style={labelStyle}>처분일</label><input type="date" style={inputStyle} value={form.decisionDate ?? ""} onChange={e => set("decisionDate", e.target.value)} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 16 }}>
            <input type="checkbox" checked={!!form.isQualityReview} onChange={e => set("isQualityReview", e.target.checked)} id="qr" />
            <label htmlFor="qr" style={{ fontSize: 12, color: "#374151", cursor: "pointer" }}>질판위 해당 사건</label>
          </div>
        </div>

        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", marginBottom: 10 }}>심사청구</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 12px" }}>
            <div><label style={labelStyle}>심사청구일</label><input type="date" style={{ ...inputStyle, opacity: form.isQualityReview ? 0.4 : 1 }} disabled={!!form.isQualityReview} value={form.examClaimDate ?? ""} onChange={e => set("examClaimDate", e.target.value)} /></div>
            <div><label style={labelStyle}>심사결과</label><select style={{ ...inputStyle, opacity: form.isQualityReview ? 0.4 : 1 }} disabled={!!form.isQualityReview} value={form.examResult ?? ""} onChange={e => set("examResult", e.target.value)}><option value="">진행중</option>{EXAM_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
            <div><label style={labelStyle}>심사송달일</label><input type="date" style={{ ...inputStyle, opacity: (form.isQualityReview || !["기각","인용"].includes(form.examResult)) ? 0.4 : 1 }} disabled={!!form.isQualityReview || !["기각","인용"].includes(form.examResult)} value={form.examResultDate ?? ""} onChange={e => set("examResultDate", e.target.value)} /></div>
          </div>
        </div>

        <div style={{ background: "#fdf4ff", border: "1px solid #e9d5ff", borderRadius: 8, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 10 }}>재심사청구</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 12px" }}>
            <div><label style={labelStyle}>재심사청구일</label><input type="date" style={inputStyle} value={form.reExamClaimDate ?? ""} onChange={e => set("reExamClaimDate", e.target.value)} /></div>
            <div><label style={labelStyle}>재심사결과</label><select style={inputStyle} value={form.reExamResult ?? ""} onChange={e => set("reExamResult", e.target.value)}><option value="">진행중</option>{EXAM_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
            <div><label style={labelStyle}>재심사송달일</label><input type="date" style={inputStyle} value={form.reExamResultDate ?? ""} onChange={e => set("reExamResultDate", e.target.value)} /></div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginTop: 12 }}>
          <div><label style={labelStyle}>담당자</label><select style={inputStyle} value={form.managerId ?? ""} onChange={e => set("managerId", e.target.value)}><option value="">선택 안 함</option>{managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label style={labelStyle}>진행상태</label><select style={inputStyle} value={form.progressStatus ?? ""} onChange={e => set("progressStatus", e.target.value)}>{PROGRESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
        </div>

        {form.progressStatus === "송무인계" && (
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>소송인계 메모</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 50 }} value={form.litigationMemo ?? ""} onChange={e => set("litigationMemo", e.target.value)} />
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>메모</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 50 }} value={form.memo ?? ""} onChange={e => set("memo", e.target.value)} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ObjectionDeadlinePage() {
  const [items, setItems] = useState<ObjectionCase[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [filterProgress, setFilterProgress] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [target, setTarget] = useState<ObjectionCase | null>(null);
  const [viewSection, setViewSection] = useState<"main" | "litigation">("main");

  const fetchItems = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterTf) p.set("tfName", filterTf);
    if (filterProgress) p.set("progressStatus", filterProgress);
    if (search) p.set("search", search);
    const res = await fetch(`/api/objection/cases?${p}`);
    if (res.ok) setItems(await res.json());
  }, [filterTf, filterProgress, search]);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => setManagers(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSave = async (form: CaseForm, id?: string) => {
    const method = id ? "PATCH" : "POST";
    const url = id ? `/api/objection/cases/${id}` : "/api/objection/cases";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) throw new Error();
    await fetchItems();
  };

  const tfList = filterBranch ? BRANCH_TF_MAP[filterBranch] ?? [] : [];

  const now = new Date();
  const stats = {
    ongoing: items.filter(i => i.progressStatus === "진행중").length,
    urgent: items.filter(i => { const d = getDeadline(i); return d && (d.getTime() - now.getTime()) / (1000*60*60*24) <= 7 && (d.getTime() - now.getTime()) / (1000*60*60*24) >= 0; }).length,
    expired: items.filter(i => { const d = getDeadline(i); return d && d < now; }).length,
    litigation: items.filter(i => i.progressStatus === "송무인계").length,
  };

  const litigationItems = items.filter(i => i.progressStatus === "송무인계");
  const needsRedecision = items.filter(i => { const d = getDeadline(i); return d && d < now; });

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
      {modal && <CaseModal initial={target} managers={managers} onClose={() => { setModal(false); setTarget(null); }} onSave={handleSave} />}

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>OBJECTION DEADLINE</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>이의제기 — 기일 관리</h1>
        </div>
        <button onClick={() => { setTarget(null); setModal(true); }} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ 등록</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "진행 중", value: stats.ongoing, color: "#2563eb" },
          { label: "제척 임박 (7일 이내)", value: stats.urgent, color: "#d97706" },
          { label: "제척 도과 / 재처분 필요", value: stats.expired, color: "#dc2626" },
          { label: "송무 인계", value: stats.litigation, color: "#9333ea" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Section toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["main", "litigation"] as const).map(v => (
          <button key={v} onClick={() => setViewSection(v)} style={{ padding: "6px 16px", fontSize: 12, borderRadius: 6, cursor: "pointer", border: viewSection === v ? "1px solid #2563eb" : "1px solid #e5e7eb", background: viewSection === v ? "#eff6ff" : "white", color: viewSection === v ? "#2563eb" : "#374151", fontWeight: viewSection === v ? 700 : 400 }}>
            {v === "main" ? "전체 기일 관리" : `소송 인계 (${litigationItems.length})`}
          </button>
        ))}
      </div>

      {viewSection === "main" && (
        <>
          {/* Filters */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>지사</div>
              <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setFilterTf(""); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}>
                <option value="">전체</option>
                {Object.keys(BRANCH_TF_MAP).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {filterBranch && (
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>TF</div>
                <select value={filterTf} onChange={e => setFilterTf(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}>
                  <option value="">전체</option>
                  {tfList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>진행상태</div>
              <select value={filterProgress} onChange={e => setFilterProgress(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}>
                <option value="">전체</option>
                {PROGRESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>검색</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="성명 검색" style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", width: 140 }} />
            </div>
          </div>

          {/* Main table */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                    {["승인여부","TF","성명","사건분류","처분일","제척도래일","심사청구일","심사결과","심사송달일","재심사청구일","재심사결과","재심사송달일","담당자","진행상태","관리"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={15} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>데이터가 없습니다</td></tr>
                  )}
                  {items.map(item => {
                    const deadline = getDeadline(item);
                    const bg = getRowBg(item);
                    const diff = deadline ? (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : null;
                    return (
                      <tr key={item.id} onClick={() => { setTarget(item); setModal(true); }} style={{ background: bg, borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                        <td style={{ padding: "8px 10px" }}><ApprovalBadge status={item.approvalStatus} />{item.isQualityReview && <span style={{ marginLeft: 4, fontSize: 9, background: "#7c3aed", color: "white", borderRadius: 3, padding: "1px 5px" }}>질판위</span>}</td>
                        <td style={{ padding: "8px 10px", color: "#374151" }}>{item.tfName}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                        <td style={{ padding: "8px 10px", color: "#6b7280" }}>{item.caseType}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{formatDate(item.decisionDate)}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: diff !== null && diff <= 7 ? "#dc2626" : "#374151", fontWeight: diff !== null && diff <= 7 ? 700 : 400 }}>
                          {deadline ? formatDate(deadline.toISOString()) : "-"}{diff !== null && diff <= 7 && diff >= 0 && " ⚠️"}{diff !== null && diff < 0 && " 🔴"}
                        </td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{formatDate(item.examClaimDate)}</td>
                        <td style={{ padding: "8px 10px", color: "#374151" }}>{item.examResult ?? "진행중"}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{formatDate(item.examResultDate)}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{formatDate(item.reExamClaimDate)}</td>
                        <td style={{ padding: "8px 10px", color: "#374151" }}>{item.reExamResult ?? "-"}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{formatDate(item.reExamResultDate)}</td>
                        <td style={{ padding: "8px 10px", color: "#374151" }}>{item.manager?.name ?? "-"}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: item.progressStatus === "진행중" ? "#eff6ff" : item.progressStatus === "종결" ? "#f1f5f9" : "#fdf4ff", color: item.progressStatus === "진행중" ? "#2563eb" : item.progressStatus === "종결" ? "#6b7280" : "#7c3aed" }}>{item.progressStatus}</span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <button onClick={async e => { e.stopPropagation(); if (!confirm("삭제?")) return; await fetch(`/api/objection/cases/${item.id}`, { method: "DELETE" }); fetchItems(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "#dc2626", background: "white", cursor: "pointer" }}>삭제</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 재처분 필요 패널 */}
          {needsRedecision.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "16px 18px", marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 12 }}>🔴 재처분 필요 사건 ({needsRedecision.length}건)</div>
              {needsRedecision.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid #fecaca", fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{item.patientName}</span>
                  <span style={{ color: "#6b7280" }}>{item.tfName} / {item.caseType}</span>
                  <span style={{ color: "#9ca3af" }}>처분일: {formatDate(item.decisionDate)}</span>
                  <button onClick={() => { setTarget(item); setModal(true); }} style={{ marginLeft: "auto", border: "1px solid #fecaca", borderRadius: 5, padding: "3px 10px", fontSize: 11, color: "#dc2626", background: "white", cursor: "pointer" }}>처분일 업데이트</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {viewSection === "litigation" && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                {["TF","성명","사건분류","처분일","심사결과","재심사결과","소송인계메모"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {litigationItems.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>소송 인계 사건이 없습니다</td></tr>
              )}
              {litigationItems.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{item.tfName}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{item.caseType}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{formatDate(item.decisionDate)}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{item.examResult ?? "-"}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{item.reExamResult ?? "-"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.litigationMemo ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
