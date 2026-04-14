"use client";

import { useCallback, useEffect, useState } from "react";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";
import ContactSelector from "@/components/ui/ContactSelector";

const BRANCH_TF_MAP: Record<string, string[]> = {
  "울산지사": ["울산TF", "이산울산북부TF"],
  "울산동부지사": ["울산동부TF", "이산울산동부TF"],
  "울산남부지사": ["울산남부TF", "이산울산남부TF"],
  "부산경남지사": ["부산경남TF"],
  "서울북부지사": ["서울북부TF"],
  "경기안산지사": ["경기안산TF"],
  "전북익산지사": ["전북익산TF"],
  "경북구미지사": ["경북구미TF"],
};

const TF_OPTIONS = Object.values(BRANCH_TF_MAP).flat();

const branchGroups: Record<string, { label: string; tfNames: string[] }> = {
  ulsan: {
    label: '울산지사',
    tfNames: ['울산', '울산 '],
  },
  ulsan_east: {
    label: '울산동부지사',
    tfNames: ['울동', '울산동부', '울산동부TF'],
  },
  ulsan_combined: {
    label: '울산 통합 (울산+동부)',
    tfNames: ['울산', '울산 ', '울동', '울산동부', '울산동부TF'],
  },
};
const APPROVAL_OPTIONS = ["승인", "불승인", "일부승인"];
const PROGRESS_OPTIONS = ["진행중", "종결", "송무인계", "검토중"];
const EXAM_RESULT_OPTIONS = ["기각", "인용", "취하", "진행중"];
const LITIGATION_STATUS_OPTIONS = ["소송 검토중", "소송 검토 완료", "소송 진행중", "소송 종료"];

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
  litigationStatus: string | null;
  needsReDecision: boolean;
  wageCorrectStatus: string | null;
  caseId?: string | null;
  isAutoFilled?: boolean;
};

type WageItem = {
  id: string;
  tfName: string;
  patientName: string;
  caseType: string;
  decisionDate: string | null;
  finalSelectedWage: number | null;
  claimDate: string | null;
  decisionResultDate: string | null;
  reviewManagerName: string | null;
  reviewResult: string | null;
  reviewDetail: string | null;
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

/** 날짜만 비교하기 위해 시분초를 제거한 일수 차이 (deadline 당일 = 0) */
function dayDiff(deadline: Date, today: Date): number {
  const d = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
}

function getDeadline(item: ObjectionCase): Date | null {
  if (item.reExamResultDate) return addDays(item.reExamResultDate, 90);
  if (item.examResultDate && (item.examResult === "기각" || item.examResult === "인용")) return addDays(item.examResultDate, 90);
  return addDays(item.decisionDate, 90);
}

function getRowBg(item: ObjectionCase): string {
  if (item.progressStatus === "종결") return "#f0fdf4";
  const d = getDeadline(item);
  if (!d) return "white";
  const diff = dayDiff(d, new Date());
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
      caseId: initial.caseId ?? null,
    } : { tfName: "", patientName: "", caseType: "", approvalStatus: "불승인", progressStatus: "진행중", isQualityReview: false, caseId: null as string | null }
  );
  const [saving, setSaving] = useState(false);
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [caseSearchResults, setCaseSearchResults] = useState<{ id: string; patient?: { name: string }; tfName?: string; caseType?: string; branch?: string }[]>([]);
  const [caseSearchLoading, setCaseSearchLoading] = useState(false);
  const set = (k: string, v: unknown) => setForm((f: CaseForm) => ({ ...f, [k]: v }));

  const handleCaseSearch = async () => {
    if (!caseSearchQuery.trim()) return;
    setCaseSearchLoading(true);
    try {
      const res = await fetch(`/api/cases?search=${encodeURIComponent(caseSearchQuery)}&limit=10`);
      const data = await res.json();
      setCaseSearchResults(data.cases || data || []);
    } catch (e) { console.error(e); }
    finally { setCaseSearchLoading(false); }
  };

  const handleCaseSelect = (c: { id: string; patient?: { name: string }; tfName?: string; caseType?: string }) => {
    const caseTypeMap: Record<string, string> = { HEARING_LOSS: "난청", COPD: "COPD", PNEUMOCONIOSIS: "진폐", MUSCULOSKELETAL: "근골격계" };
    setForm(prev => ({
      ...prev,
      caseId: c.id,
      tfName: c.tfName || prev.tfName,
      patientName: c.patient?.name || prev.patientName,
      caseType: caseTypeMap[c.caseType ?? ""] || c.caseType || prev.caseType,
    }));
    setCaseSearchResults([]);
    setCaseSearchQuery("");
  };

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
        {/* 사건 DB 연결 */}
        <div style={{ marginBottom: 14, padding: "10px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>사건 DB 연결 <span style={{ fontWeight: 400, color: "#60a5fa" }}>(선택 — 연결 시 TF·성명 자동 채움)</span></p>
          {form.caseId ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderRadius: 6, padding: "6px 10px", border: "1px solid #93c5fd" }}>
              <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>✓ 사건 연결됨</span>
              <button type="button" onClick={() => set("caseId", null)} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>연결 해제</button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="text" placeholder="성명 또는 TF명으로 검색..." value={caseSearchQuery} onChange={e => setCaseSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCaseSearch()} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 10px", fontSize: 12, outline: "none" }} />
                <button type="button" onClick={handleCaseSearch} disabled={caseSearchLoading} style={{ padding: "5px 12px", background: "#3b82f6", color: "white", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", opacity: caseSearchLoading ? 0.5 : 1 }}>{caseSearchLoading ? "..." : "검색"}</button>
              </div>
              {caseSearchResults.length > 0 && (
                <div style={{ marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, background: "white", maxHeight: 140, overflowY: "auto" }}>
                  {caseSearchResults.map((c) => (
                    <div key={c.id} onClick={() => handleCaseSelect(c)} style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }} onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"} onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <span><b>{c.patient?.name}</b> <span style={{ color: "#9ca3af", marginLeft: 4 }}>{c.tfName}</span></span>
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>{c.branch}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
          <div><label style={labelStyle}>TF</label><select style={inputStyle} value={form.tfName ?? ""} onChange={e => set("tfName", e.target.value)}><option value="">선택</option>{TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={labelStyle}>성명</label><input style={inputStyle} value={form.patientName ?? ""} onChange={e => set("patientName", e.target.value)} /></div>
          <div><label style={labelStyle}>사건분류</label><select style={inputStyle} value={form.caseType ?? ""} onChange={e => set("caseType", e.target.value)}><option value="">선택</option>{Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
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
            <div><label style={labelStyle}>심사청구일</label><input type="date" style={inputStyle} value={form.examClaimDate ?? ""} onChange={e => set("examClaimDate", e.target.value)} /></div>
            <div><label style={labelStyle}>심사결과</label><select style={inputStyle} value={form.examResult ?? ""} onChange={e => set("examResult", e.target.value)}><option value="">진행중</option>{EXAM_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
            <div><label style={labelStyle}>심사송달일</label><input type="date" style={inputStyle} value={form.examResultDate ?? ""} onChange={e => set("examResultDate", e.target.value)} /></div>
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
          <div><label style={labelStyle}>담당자</label><ContactSelector value={form.manager?.name ?? ""} onChange={(name, mobile, userId) => set("managerId", userId ?? "")} placeholder="담당자 이름 검색" firmType="TBOSANG" /></div>
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
          <button onClick={handleSave} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── WageDateModal ──────────────────────────────────────────────────────────────
function WageDateModal({ item, onClose, onSave }: {
  item: WageItem;
  onClose: () => void;
  onSave: (id: string, claimDate: string, decisionResultDate: string) => Promise<void>;
}) {
  const [claimDate, setClaimDate] = useState(toInputDate(item.claimDate));
  const [decisionResultDate, setDecisionResultDate] = useState(toInputDate(item.decisionResultDate));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(item.id, claimDate, decisionResultDate); onClose(); }
    catch { alert("저장 오류"); }
    finally { setSaving(false); }
  };

  const inputStyle = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", width: "100%" };
  const labelStyle = { fontSize: 11, color: "#6b7280", fontWeight: 700 as const, display: "block" as const, marginBottom: 3 };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 24, zIndex: 1000, width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#111827" }}>{item.patientName} — 일정 업데이트</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><label style={labelStyle}>청구일</label><input type="date" style={inputStyle} value={claimDate} onChange={e => setClaimDate(e.target.value)} /></div>
          <div><label style={labelStyle}>결정일</label><input type="date" style={inputStyle} value={decisionResultDate} onChange={e => setDecisionResultDate(e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 14px", fontSize: 12, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ObjectionDeadlinePage() {
  const [tab, setTab] = useState<"objection" | "litigation" | "wage">("objection");
  const [items, setItems] = useState<ObjectionCase[]>([]);
  const [litigationItems, setLitigationItems] = useState<ObjectionCase[]>([]);
  const [wageItems, setWageItems] = useState<WageItem[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [branchGroups, setBranchGroups] = useState<Record<string, { label: string; tfNames: string[] }>>(branchGroups);

  // 이의제기 탭 filters
  const [filterBranch, setFilterBranch] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [filterProgress, setFilterProgress] = useState("");
  const [filterCaseType, setFilterCaseType] = useState("");
  const [search, setSearch] = useState("");
  const [statsFilter, setStatsFilter] = useState("");

  // Modal
  const [modal, setModal] = useState(false);
  const [target, setTarget] = useState<ObjectionCase | null>(null);

  // Wage date modal
  const [wageModal, setWageModal] = useState<WageItem | null>(null);

  // Date info
  const today = new Date();
  const exclusionBase = new Date(today);
  exclusionBase.setDate(exclusionBase.getDate() - 90);
  const fmtKorDate = (d: Date) => {
    const days = ["일","월","화","수","목","금","토"];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const fetchItems = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterTf) p.set("tfName", filterTf);
    if (filterProgress && filterProgress !== "송무인계") p.set("progressStatus", filterProgress);
    if (filterCaseType) p.set("caseType", filterCaseType);
    const res = await fetch(`/api/objection/cases?${p}`);
    if (res.ok) setItems(await res.json());
  }, [filterTf, filterProgress, filterCaseType]);

  const fetchLitigation = useCallback(async () => {
    const res = await fetch("/api/objection/cases?type=litigation");
    if (res.ok) setLitigationItems(await res.json());
  }, []);

  const fetchWage = useCallback(async () => {
    const res = await fetch("/api/objection/wage-review?reviewResult=평정청구%20진행");
    if (res.ok) setWageItems(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => setManagers(Array.isArray(d) ? d : []));
  }, []);

  // Branch DB에서 지사-TF 매핑 로드 (fallback: 하드코딩 branchGroups)
  useEffect(() => {
    fetch('/api/branches/all-tfs')
      .then(r => r.json())
      .then(data => {
        if (data.branches?.length > 0) {
          const groups: Record<string, { label: string; tfNames: string[] }> = {}
          data.branches.forEach((b: any) => {
            groups[b.name] = { label: b.name, tfNames: (b.assignedTFs as string[]) || [] }
          })
          setBranchGroups(groups)
        }
      })
      .catch(() => { /* fallback to branchGroups */ })
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchLitigation(); }, [fetchLitigation]);
  useEffect(() => { fetchWage(); }, [fetchWage]);

  const handleSave = async (form: CaseForm, id?: string) => {
    const method = id ? "PATCH" : "POST";
    const url = id ? `/api/objection/cases/${id}` : "/api/objection/cases";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) throw new Error();
    await fetchItems();
    await fetchLitigation();
  };

  const handleLitigationStatusChange = async (id: string, litigationStatus: string) => {
    const item = litigationItems.find(i => i.id === id);
    if (!item) return;
    await fetch(`/api/objection/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, managerId: item.manager?.id ?? null, litigationStatus }),
    });
    await fetchLitigation();
  };

  const handleWageDateSave = async (id: string, claimDate: string, decisionResultDate: string) => {
    const fullRes = await fetch(`/api/objection/wage-review/${id}`);
    if (!fullRes.ok) throw new Error();
    const fullItem = await fullRes.json();
    const res = await fetch(`/api/objection/wage-review/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fullItem, claimDate: claimDate || null, decisionResultDate: decisionResultDate || null }),
    });
    if (!res.ok) throw new Error();
    await fetchWage();
  };

  const now = new Date();

  // 지사 선택 시 관할 TF 목록 (통합 그룹은 포함된 지사들의 TF 합산)
  const availableTfs = (() => {
    if (!filterBranch || !branchGroups[filterBranch]) return TF_OPTIONS;
    const branchLabel = branchGroups[filterBranch].label;
    if (BRANCH_TF_MAP[branchLabel]) return BRANCH_TF_MAP[branchLabel];
    // 통합 그룹: BRANCH_TF_MAP에서 tfNames에 매칭되는 지사들의 TF를 합산
    const matchedTfs = new Set<string>();
    for (const [branchName, tfs] of Object.entries(BRANCH_TF_MAP)) {
      if (branchGroups[filterBranch].tfNames.some(tn => branchName.includes(tn.trim()))) {
        tfs.forEach(tf => matchedTfs.add(tf));
      }
    }
    return matchedTfs.size > 0 ? Array.from(matchedTfs) : TF_OPTIONS;
  })();

  // 이의제기 탭 stats (종결 건은 별도 집계, 다른 카드에서 제외)
  const branchItems = filterBranch && branchGroups[filterBranch]
    ? items.filter(i => branchGroups[filterBranch].tfNames.includes(i.tfName.trim()))
    : items;
  // TF 필터 적용
  const tfFiltered = filterTf ? branchItems.filter(i => i.tfName.trim() === filterTf) : branchItems;
  const activeItems = tfFiltered.filter(i => i.progressStatus !== "종결" && i.progressStatus !== "송무인계");

  // 심사청구일 또는 재심사청구일이 있으면 청구 중단 → 제척도과 아님
  const isClaimInProgress = (i: ObjectionCase) => !!(i.examClaimDate || i.reExamClaimDate);

  const objStats = {
    waiting: activeItems.filter(i => !isClaimInProgress(i)).length,
    ongoing: activeItems.filter(i => (i.examClaimDate && !i.examResult) || (i.reExamClaimDate && !i.reExamResult)).length,
    urgent: activeItems.filter(i => {
      if (isClaimInProgress(i)) return false;
      const d = getDeadline(i);
      if (!d) return false;
      const diff = dayDiff(d, now);
      return diff >= 0 && diff <= 7;
    }).length,
    expired: activeItems.filter(i => {
      if (isClaimInProgress(i)) return false;
      const d = getDeadline(i);
      if (!d) return false;
      return dayDiff(d, now) < 0;
    }).length,
    litigation: tfFiltered.filter(i => i.progressStatus === "송무인계").length,
    closed: tfFiltered.filter(i => i.progressStatus === "종결").length,
  };

  // Apply stats filter client-side (종결 건은 종결 필터에서만 표시)
  const statsFiltered = statsFilter === "접수대기" ? activeItems.filter(i => !isClaimInProgress(i))
    : statsFilter === "진행중" ? activeItems.filter(i => (i.examClaimDate && !i.examResult) || (i.reExamClaimDate && !i.reExamResult))
    : statsFilter === "제척임박" ? activeItems.filter(i => { if (isClaimInProgress(i)) return false; const d = getDeadline(i); if (!d) return false; const diff = dayDiff(d, now); return diff >= 0 && diff <= 7; })
    : statsFilter === "제척도과" ? activeItems.filter(i => { if (isClaimInProgress(i)) return false; const d = getDeadline(i); if (!d) return false; return dayDiff(d, now) < 0; })
    : statsFilter === "송무인계" ? tfFiltered.filter(i => i.progressStatus === "송무인계")
    : statsFilter === "종결" ? tfFiltered.filter(i => i.progressStatus === "종결")
    : tfFiltered;

  // 검색어 클라이언트 필터링 (API race condition 방지)
  const searchTrimmed = search.trim();
  const filteredItems = searchTrimmed
    ? statsFiltered.filter(i => i.patientName.includes(searchTrimmed))
    : statsFiltered;

  // 소송 인계 stats
  const litStats = {
    검토중: litigationItems.filter(i => i.litigationStatus === "소송 검토중").length,
    완료: litigationItems.filter(i => i.litigationStatus === "소송 검토 완료").length,
    진행중: litigationItems.filter(i => i.litigationStatus === "소송 진행중").length,
    종료: litigationItems.filter(i => i.litigationStatus === "소송 종료").length,
  };

  // 평균임금 정정 stats
  const wageStats = {
    waiting: wageItems.filter(i => !i.claimDate).length,
    ongoing: wageItems.filter(i => i.claimDate && !i.decisionResultDate).length,
    done: wageItems.filter(i => !!i.decisionResultDate).length,
  };

  const cardStyle = (color: string, active: boolean): React.CSSProperties => ({
    background: active ? color + "15" : "white",
    borderRadius: 10,
    border: `1px solid ${active ? color : "#e5e7eb"}`,
    padding: "14px 18px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    cursor: "pointer",
  });

  const inputStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" };
  const thStyle: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
      {modal && <CaseModal initial={target} managers={managers} onClose={() => { setModal(false); setTarget(null); }} onSave={handleSave} />}
      {wageModal && <WageDateModal item={wageModal} onClose={() => setWageModal(null)} onSave={handleWageDateSave} />}

      {/* Header */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>OBJECTION DEADLINE</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: 0 }}>이의제기 — 기일 관리</h1>
        </div>
        <button onClick={() => { setTarget(null); setModal(true); }} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ 등록</button>
      </div>

      {/* Date bar */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 16px", marginBottom: 14, display: "flex", gap: 32, alignItems: "center", fontSize: 13 }}>
        <div>
          <span style={{ fontWeight: 700, color: "#374151" }}>오늘: </span>
          <span style={{ color: "#29ABE2", fontWeight: 600 }}>{fmtKorDate(today)}</span>
        </div>
        <div title="이 날짜 이후 송달된 결정에 대해 제척기간이 진행 중입니다" style={{ cursor: "help" }}>
          <span style={{ fontWeight: 700, color: "#374151" }}>제척 기준일: </span>
          <span style={{ color: "#dc2626", fontWeight: 600 }}>{fmtKorDate(exclusionBase)}</span>
          <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>ⓘ 오늘 -90일</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {([
          { id: "objection", label: "이의제기" },
          { id: "litigation", label: `소송 인계 (${litigationItems.length})` },
          { id: "wage", label: `평균임금 정정 (${wageItems.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{ padding: "7px 18px", fontSize: 13, borderRadius: 7, cursor: "pointer", border: tab === t.id ? "1px solid #29ABE2" : "1px solid #e5e7eb", background: tab === t.id ? "#eff6ff" : "white", color: tab === t.id ? "#29ABE2" : "#374151", fontWeight: tab === t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: 이의제기 ── */}
      {tab === "objection" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { key: "접수대기", label: "접수 대기", value: objStats.waiting, color: "#6b7280" },
              { key: "진행중", label: "진행 중", value: objStats.ongoing, color: "#29ABE2" },
              { key: "제척임박", label: "제척 임박 (7일 이내)", value: objStats.urgent, color: "#d97706" },
              { key: "제척도과", label: "제척도과/재처분 필요", value: objStats.expired, color: "#dc2626" },
              { key: "송무인계", label: "송무 인계", value: objStats.litigation, color: "#9333ea" },
              { key: "종결", label: "종결", value: objStats.closed, color: "#059669" },
            ].map(s => (
              <div key={s.key} onClick={() => setStatsFilter(statsFilter === s.key ? "" : s.key)} style={cardStyle(s.color, statsFilter === s.key)}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>지사</div>
              <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setFilterTf(""); }} style={inputStyle}>
                <option value="">전체</option>
                {Object.entries(branchGroups).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>TF</div>
              <select value={filterTf} onChange={e => setFilterTf(e.target.value)} style={inputStyle}>
                <option value="">전체</option>
                {availableTfs.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>진행상태</div>
              <select value={filterProgress} onChange={e => setFilterProgress(e.target.value)} style={inputStyle}>
                <option value="">전체</option>
                {PROGRESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>사건분류</div>
              <select value={filterCaseType} onChange={e => setFilterCaseType(e.target.value)} style={inputStyle}>
                <option value="">전체</option>
                {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>검색</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="성명 검색" style={{ ...inputStyle, width: 140 }} />
            </div>
            {statsFilter && (
              <button onClick={() => setStatsFilter("")} style={{ padding: "6px 12px", fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fef9c3", color: "#92400e", cursor: "pointer" }}>
                {statsFilter} 필터 해제
              </button>
            )}
          </div>

          {/* Main table */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#29ABE2", borderBottom: "2px solid #1A8BBF" }}>
                    {["승인여부","TF","성명","사건분류","처분일","제척도래일","심사청구일","심사결과","심사송달일","재심사청구일","재심사결과","재심사송달일","담당자","진행상태","관리"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 && (
                    <tr><td colSpan={15} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>데이터가 없습니다</td></tr>
                  )}
                  {filteredItems.map(item => {
                    const deadline = getDeadline(item);
                    const bg = item.isAutoFilled ? "#eff6ff" : getRowBg(item);
                    const diff = deadline ? dayDiff(deadline, now) : null;
                    return (
                      <tr key={item.id} onClick={() => { if (!item.isAutoFilled) { setTarget(item); setModal(true); } }} style={{ background: bg, borderBottom: "1px solid #f1f5f9", cursor: item.isAutoFilled ? "default" : "pointer" }}>
                        <td style={{ padding: "8px 10px" }}>
                          {item.isAutoFilled
                            ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA" }}>이의제기</span>
                            : <><ApprovalBadge status={item.approvalStatus} />{item.isQualityReview && <span style={{ marginLeft: 4, fontSize: 9, background: "#7c3aed", color: "white", borderRadius: 3, padding: "1px 5px" }}>질판위</span>}</>
                          }
                        </td>
                        <td style={{ padding: "8px 10px", color: "#374151" }}>{item.tfName}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                        <td style={{ padding: "8px 10px", color: "#6b7280" }}>{CASE_TYPE_LABELS[item.caseType] || item.caseType}</td>
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
                          <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: item.progressStatus === "진행중" ? "#eff6ff" : item.progressStatus === "종결" ? "#f1f5f9" : "#fdf4ff", color: item.progressStatus === "진행중" ? "#29ABE2" : item.progressStatus === "종결" ? "#6b7280" : "#7c3aed" }}>{item.progressStatus}</span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {item.isAutoFilled ? (
                            <button onClick={async e => {
                              e.stopPropagation();
                              await fetch('/api/objection/cases', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ caseId: item.caseId, tfName: item.tfName, patientName: item.patientName, caseType: item.caseType, approvalStatus: '불승인', progressStatus: '진행중' }),
                              });
                              fetchItems();
                            }} style={{ border: "none", borderRadius: 5, padding: "3px 10px", fontSize: 10, fontWeight: 600, color: "white", background: "#29ABE2", cursor: "pointer" }}>등록</button>
                          ) : (
                            <button onClick={async e => { e.stopPropagation(); if (!confirm("삭제?")) return; await fetch(`/api/objection/cases/${item.id}`, { method: "DELETE" }); fetchItems(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 7px", fontSize: 10, color: "#dc2626", background: "white", cursor: "pointer" }}>삭제</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: 소송 인계 ── */}
      {tab === "litigation" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { label: "소송 검토중", value: litStats.검토중, color: "#29ABE2" },
              { label: "소송 검토 완료", value: litStats.완료, color: "#0891b2" },
              { label: "소송 진행중", value: litStats.진행중, color: "#9333ea" },
              { label: "소송 종료", value: litStats.종료, color: "#6b7280" },
            ].map(s => (
              <div key={s.label} style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#29ABE2", borderBottom: "2px solid #1A8BBF" }}>
                    {["TF","성명","사건분류","심사결과","재심사결과","소송 상태","소송 메모","관리"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {litigationItems.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>소송 인계 사건이 없습니다</td></tr>
                  )}
                  {litigationItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.tfName}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{CASE_TYPE_LABELS[item.caseType] || item.caseType}</td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.examResult ?? "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.reExamResult ?? "-"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {item.litigationStatus
                          ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: "#f0f9ff", color: "#0369a1" }}>{item.litigationStatus}</span>
                          : <span style={{ color: "#9ca3af", fontSize: 11 }}>미설정</span>}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.litigationMemo ?? "-"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <select
                          value={item.litigationStatus ?? ""}
                          onChange={e => handleLitigationStatusChange(item.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#374151", background: "#f9fafb", cursor: "pointer" }}
                        >
                          <option value="">-- 상태 변경 --</option>
                          {LITIGATION_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: 평균임금 정정 ── */}
      {tab === "wage" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { label: "접수 대기", value: wageStats.waiting, color: "#6b7280" },
              { label: "진행 중", value: wageStats.ongoing, color: "#29ABE2" },
              { label: "처분 완료", value: wageStats.done, color: "#16a34a" },
            ].map(s => (
              <div key={s.label} style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#29ABE2", borderBottom: "2px solid #1A8BBF" }}>
                    {["TF","성명","사건분류","최종 적용임금","상세 쟁점","검토담당자","진행상태","관리"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wageItems.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>평정청구 진행 사건이 없습니다</td></tr>
                  )}
                  {wageItems.map(item => {
                    const status = item.decisionResultDate ? "처분완료" : item.claimDate ? "진행중" : "접수대기";
                    const statusColor = status === "처분완료" ? "#16a34a" : status === "진행중" ? "#29ABE2" : "#6b7280";
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{item.tfName}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                        <td style={{ padding: "10px 12px", color: "#6b7280" }}>{CASE_TYPE_LABELS[item.caseType] || item.caseType}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#374151", fontWeight: 600 }}>
                          {item.finalSelectedWage != null ? item.finalSelectedWage.toLocaleString("ko-KR") + "원/일" : "-"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#374151", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.reviewDetail ?? "-"}</td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{item.reviewManagerName ?? "-"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600, background: statusColor + "15", color: statusColor }}>{status}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => setWageModal(item)} style={{ border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 9px", fontSize: 11, color: "#29ABE2", background: "white", cursor: "pointer" }}>일정 업데이트</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
