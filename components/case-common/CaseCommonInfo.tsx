"use client";

import React, { useEffect, useState } from "react";
import ContactSelector from "@/components/ui/ContactSelector";
import BranchSelector from "@/components/ui/BranchSelector";
import { STATUS_BY_CASE_TYPE, HEARING_LOSS_STATUS, CASE_STATUS_LABELS, CASE_STATUS_COLORS } from "@/lib/constants/case";

/**
 * 사건 공통정보 카드 — 모든 caseType에서 공통으로 표시.
 * (TF/지사/담당자/약정·접수일/원스톱/메모/진행상황/종결)
 *
 * 직업력은 별도 컴포넌트(CaseWorkHistoryCard)에서 표시.
 */

// ── 타입 ──────────────────────────────────────────────────────────────────
export type CaseCommonItem = {
  id: string;
  caseType: string;
  status: string;
  caseNumber: string | null;
  tfName: string | null;
  branch: string | null;
  subAgent: string | null;
  branchManager: string | null;
  salesManager: string | null;
  caseManager: string | null;
  salesRoute: string | null;
  contractDate: string | null;
  receptionDate: string | null;
  isOneStop: boolean;
  memo: string | null;
  kwcOfficeName: string | null;
  kwcOfficerName: string | null;
  closedReason: string | null;
};

interface Props {
  caseItem: CaseCommonItem;
  onUpdated: (updated: CaseCommonItem) => void;
}

// ── 유틸 ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  "접수대기":    { bg: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA", dot: "#29ABE2" },
  "접수완료":    { bg: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA", dot: "#29ABE2" },
  "특진예정":    { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "특진중":      { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "특진완료":    { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "재특진예정":  { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재특진중":    { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재특진완료":  { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재재특진예정":{ bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "재재특진중":  { bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "재재특진완료":{ bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "전문예정":    { bg: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", dot: "#F59E0B" },
  "전문완료":    { bg: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", dot: "#F59E0B" },
  "승인":        { bg: "#E8F5D0", color: "#5A8A1F", border: "1px solid #A2D158", dot: "#8DC63F" },
  "불승인":      { bg: "#FEF2F2", color: "#b91c1c", border: "1px solid #FECACA", dot: "#EF4444" },
  "반려":        { bg: "#FEF2F2", color: "#b91c1c", border: "1px solid #FECACA", dot: "#EF4444" },
  "보류":        { bg: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", dot: "#94A3B8" },
  "파기":        { bg: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", dot: "#94A3B8" },
};

function StatusBadge({ status }: { status: string }) {
  const label = CASE_STATUS_LABELS[status] ?? status;
  const ec = CASE_STATUS_COLORS[status];
  const s = ec
    ? { bg: ec.bg, color: ec.color, border: `1px solid ${ec.border}`, dot: ec.border }
    : STATUS_COLOR[status] ?? STATUS_COLOR[label] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {label}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#374151",
  outline: "none", background: "white", width: "100%", boxSizing: "border-box",
};

const TF_OPTIONS = [
  "더보상울산TF","더보상부산경남TF","더보상서울북부TF","더보상경기안산TF","더보상전북익산TF",
  "더보상경북구미TF","더보상경기의정부TF","더보상강원동해TF","더보상전남여수TF","더보상대구TF",
  "더보상부산중부TF","더보상경기수원TF","이산울산동부TF","이산울산남부TF","이산울산북부TF",
  "이산부산TF","이산경남TF",
];

const REFERRAL_DATA: Record<string, Record<string, string[]>> = {
  "소개": { "재해자": [], "복지관": [], "초진병원": [], "특진병원": [], "보청기광고": [], "보청기업체": [] },
  "영업": { "명함영업": [], "아파트영업": [], "공원영업": [], "특진병원인근영업": [], "지사인근영업": [], "기타영업": [], "밥차봉사": [] },
  "간판": {},
  "홍보": { "약봉투": [], "버스": [], "현수막": [], "단체복": [], "온라인": [] },
  "인계": { "기존재해자": [], "타지사": [] },
};
const ROUTE_MAIN_OPTIONS = Object.keys(REFERRAL_DATA);

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function CaseCommonInfo({ caseItem, onUpdated }: Props) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const parsedRoute = (caseItem.salesRoute ?? "").split(" > ");
  const [form, setForm] = useState({
    caseNumber: caseItem.caseNumber ?? "",
    tfName: caseItem.tfName ?? "",
    branch: caseItem.branch ?? "",
    subAgent: caseItem.subAgent ?? "",
    branchManager: caseItem.branchManager ?? "",
    salesManager: caseItem.salesManager ?? "",
    caseManager: caseItem.caseManager ?? "",
    routeMain: parsedRoute[0] ?? "",
    routeSub: parsedRoute[1] ?? "",
    contractDate: toInputDate(caseItem.contractDate),
    receptionDate: toInputDate(caseItem.receptionDate),
    isOneStop: caseItem.isOneStop,
    memo: caseItem.memo ?? "",
    kwcOfficeName: caseItem.kwcOfficeName ?? "",
    kwcOfficerName: caseItem.kwcOfficerName ?? "",
  });
  const [closedReason, setClosedReason] = useState(caseItem.closedReason ?? "");
  const [savingClosed, setSavingClosed] = useState(false);
  const [saving, setSaving] = useState(false);

  // users는 향후 ContactSelector 외 자동완성용으로 예약 (현재 사용처 없음)
  useEffect(() => {
    fetch("/api/users").catch(() => {});
  }, []);

  const handleClosedReason = async (reason: string) => {
    const next = closedReason === reason ? "" : reason;
    setSavingClosed(true);
    setClosedReason(next);
    try {
      const res = await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closedReason: next || null, status: next ? "CLOSED" : caseItem.status }),
      });
      if (res.ok) { const updated = await res.json(); onUpdated(updated); }
    } catch { /* silent */ }
    setSavingClosed(false);
  };

  const save = async () => {
    setSaving(true);
    const salesRoute = [form.routeMain, form.routeSub].filter(Boolean).join(" > ");
    try {
      const res = await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber: form.caseNumber, tfName: form.tfName, branch: form.branch,
          subAgent: form.subAgent, branchManager: form.branchManager,
          salesManager: form.salesManager, caseManager: form.caseManager,
          salesRoute, contractDate: form.contractDate || null,
          receptionDate: form.receptionDate || null,
          isOneStop: form.isOneStop, memo: form.memo,
          kwcOfficeName: form.kwcOfficeName || null,
          kwcOfficerName: form.kwcOfficerName || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdated(updated);
      setEditing(false);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", border: "none", borderBottom: open ? "1px solid #e5e7eb" : "none", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>사건 공통정보</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          {!editing ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 12, border: "1px solid #f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                {([
                  ["TF명", caseItem.tfName ?? "-"],
                  ["관할공단", caseItem.kwcOfficeName ?? "-"],
                  ["지사담당자", caseItem.kwcOfficerName ?? "-"],
                  ["영업담당", caseItem.salesManager ?? "-"],
                  ["실무담당", caseItem.caseManager ?? "-"],
                  ["영업경로", caseItem.salesRoute ?? "-"],
                  ["원스톱", caseItem.isOneStop ? "예" : "아니오"],
                  ["약정일", formatDate(caseItem.contractDate)],
                  ["접수일", formatDate(caseItem.receptionDate)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ display: "flex", gap: 8, borderBottom: "1px solid #f9fafb", padding: "7px 12px", background: "white" }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", width: 56, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              {/* 진행상황 — 소음성 난청은 자동계산 표시, 나머지는 수동 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#9ca3af", width: 56 }}>진행상황</span>
                {caseItem.caseType === "HEARING_LOSS" ? (
                  <StatusBadge status={caseItem.status ?? "CONSULTING"} />
                ) : (
                  <select value={caseItem.status ?? "CONSULTING"} onChange={(e) => {
                    fetch(`/api/cases/${caseItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: e.target.value }) })
                      .then(r => r.json()).then(onUpdated).catch(() => {});
                  }} style={{ ...inputStyle, width: 160 }}>
                    {(STATUS_BY_CASE_TYPE[caseItem.caseType] ?? HEARING_LOSS_STATUS).map((s) => <option key={s} value={s}>{CASE_STATUS_LABELS[s] ?? s}</option>)}
                  </select>
                )}
              </div>
              {/* 반려/파기 */}
              {caseItem.caseType === "HEARING_LOSS" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af", width: 56 }}>종결</span>
                  {["반려", "파기"].map((reason) => (
                    <button
                      key={reason}
                      disabled={savingClosed}
                      onClick={() => handleClosedReason(reason)}
                      style={{ padding: "4px 14px", fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: "pointer", border: "1px solid",
                        background: closedReason === reason ? (reason === "반려" ? "#fef2f2" : "#f1f5f9") : "white",
                        color: closedReason === reason ? (reason === "반려" ? "#dc2626" : "#374151") : "#6b7280",
                        borderColor: closedReason === reason ? (reason === "반려" ? "#fca5a5" : "#cbd5e1") : "#e5e7eb" }}
                    >{reason}</button>
                  ))}
                  {closedReason && <span style={{ fontSize: 11, color: "#6b7280" }}>선택됨: {closedReason}</span>}
                </div>
              )}
              {caseItem.memo && (
                <div style={{ fontSize: 12, color: "#374151", background: "#f8fafc", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>메모</div>
                  {caseItem.memo}
                </div>
              )}
              <button onClick={() => setEditing(true)} style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>수정</button>
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>사건번호</label>
                <input style={inputStyle} value={String(form.caseNumber)} onChange={(e) => setForm({ ...form, caseNumber: e.target.value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>TF명</label>
                <select style={inputStyle} value={form.tfName} onChange={(e) => setForm({ ...form, tfName: e.target.value })}>
                  <option value="">선택</option>
                  {TF_OPTIONS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>영업담당자</label>
                <ContactSelector
                  value={form.salesManager}
                  onChange={(name) => setForm({ ...form, salesManager: name })}
                  placeholder="영업담당자 이름 검색"
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>실무담당자</label>
                <ContactSelector
                  value={form.caseManager}
                  onChange={(name) => setForm({ ...form, caseManager: name })}
                  placeholder="실무담당자 이름 검색"
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>지사</label>
                <BranchSelector
                  value={form.branch}
                  onChange={(branch) => setForm({ ...form, branch })}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>영업경로(대)</label>
                <select style={inputStyle} value={form.routeMain} onChange={(e) => setForm({ ...form, routeMain: e.target.value, routeSub: "" })}>
                  <option value="">선택</option>
                  {ROUTE_MAIN_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>영업경로(소)</label>
                <select style={inputStyle} value={form.routeSub} onChange={(e) => setForm({ ...form, routeSub: e.target.value })} disabled={!form.routeMain || Object.keys(REFERRAL_DATA[form.routeMain] ?? {}).length === 0}>
                  <option value="">선택</option>
                  {Object.keys(REFERRAL_DATA[form.routeMain] ?? {}).map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>약정일자</label>
                <input type="date" style={inputStyle} value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>접수일자</label>
                <input type="date" style={inputStyle} value={form.receptionDate} onChange={(e) => setForm({ ...form, receptionDate: e.target.value })} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 16 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>원스톱</label>
                <input type="checkbox" checked={form.isOneStop} onChange={(e) => setForm({ ...form, isOneStop: e.target.checked })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>관할 공단</label>
                <input style={inputStyle} value={form.kwcOfficeName} placeholder="예: 울산, 부산동부" onChange={(e) => setForm({ ...form, kwcOfficeName: e.target.value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>지사담당자</label>
                <input style={inputStyle} value={form.kwcOfficerName} placeholder="담당자 이름" onChange={(e) => setForm({ ...form, kwcOfficerName: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>메모</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button onClick={save} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "저장중..." : "저장"}
                </button>
                <button onClick={() => setEditing(false)} style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>취소</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
