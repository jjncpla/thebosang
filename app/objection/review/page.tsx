"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";
import { useBranches } from "@/lib/hooks/useBranches";
const APPROVAL_OPTIONS = ["승인", "불승인", "일부승인"];
const PROGRESS_OPTIONS = ["종결", "검토중", "이의제기 진행", "송무 검토", "송무 인계", "평정청구 진행"];
const PROGRESS_FILTER_OPTIONS = ["미검토", "검토중", "이의제기 진행", "송무 인계", "평정청구 진행"];
const WAGE_RESULT_OPTIONS = ["종결", "평정청구 진행", "검토중"];
// 정공(정보공개청구) 상태값 — 엑셀 매크로 입력 기준
const INFO_DISCLOSURE_OPTIONS = ["요청", "요청중", "확보", "평임확보", "평임 부존재", "불필요"];

// ─── Types ───────────────────────────────────────────────────────────────────

type ReviewItem = {
  id: string;
  tfName: string;
  patientName: string;
  caseType: string;
  approvalStatus: string;
  progressStatus: string;
  decisionDate: string | null;
  hasInfoDisclosure: boolean;
  infoDisclosureStatus: string | null;
  memo: string | null;
  caseId: string | null;
  isAutoFilled?: boolean;
  assignedTo: string | null;
};

type WageItem = {
  id: string;
  tfName: string;
  patientName: string;
  caseType: string;
  decisionDate: string | null;
  retirementDate: string | null;
  appliedWage: string | null;
  finalSelectedWage: number | null;
  finalAvgWage: number | null;
  statWageFinal: number | null;
  reviewResult: string | null;
  reviewManagerName: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function getRowStyle(item: ReviewItem): React.CSSProperties {
  const deadline = addDays(item.decisionDate, 90);
  if (!deadline) return {};
  const now = new Date();
  const diff = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return { background: "#fef2f2" };
  if (diff <= 7) return { background: "#fefce8" };
  return {};
}

function fmtWage(v: number | null | undefined) {
  if (v == null) return "-";
  return v.toLocaleString() + "원/일";
}

function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    승인: { bg: "#052e16", color: "#86efac", border: "1px solid #15803d" },
    불승인: { bg: "#450a0a", color: "#fca5a5", border: "1px solid #b91c1c" },
    일부승인: { bg: "#431407", color: "#fdba74", border: "1px solid #c2410c" },
  };
  const s = map[status] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      {status}
    </span>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

type ReviewForm = {
  tfName: string; patientName: string; caseType: string;
  approvalStatus: string; progressStatus: string;
  decisionDate: string; hasInfoDisclosure: boolean; infoDisclosureStatus: string; memo: string;
};
const emptyReviewForm: ReviewForm = {
  tfName: "", patientName: "", caseType: "",
  approvalStatus: "불승인", progressStatus: "검토중",
  decisionDate: "", hasInfoDisclosure: false, infoDisclosureStatus: "", memo: "",
};

function ReviewModal({ initial, onClose, onSave }: {
  initial: ReviewItem | null;
  onClose: () => void;
  onSave: (form: ReviewForm, id?: string) => Promise<void>;
}) {
  const { tfByBranch: BRANCH_TF_MAP } = useBranches();
  const router = useRouter();
  const [form, setForm] = useState<ReviewForm>(() =>
    initial ? { tfName: initial.tfName, patientName: initial.patientName, caseType: initial.caseType, approvalStatus: initial.approvalStatus, progressStatus: initial.progressStatus, decisionDate: toInputDate(initial.decisionDate), hasInfoDisclosure: initial.hasInfoDisclosure, infoDisclosureStatus: initial.infoDisclosureStatus ?? "", memo: initial.memo ?? "" }
      : emptyReviewForm
  );
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ReviewForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form, initial?.id); onClose(); }
    catch { alert("저장 오류"); }
    finally { setSaving(false); }
  };

  const inputStyle = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "#374151", background: "#f9fafb", outline: "none", width: "100%" };
  const labelStyle = { fontSize: 11, color: "#6b7280", fontWeight: 700 as const, display: "block" as const, marginBottom: 4 };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 24, zIndex: 1000, maxWidth: 560, width: "95%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" }}>{initial ? "수정" : "등록"} — 처분 검토</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          <div>
            <label style={labelStyle}>TF</label>
            <select style={inputStyle} value={form.tfName} onChange={e => set("tfName", e.target.value)}>
              <option value="">선택</option>
              {Object.entries(BRANCH_TF_MAP).map(([branch, tfs]) => (
                <optgroup key={branch} label={branch}>
                  {tfs.map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div><label style={labelStyle}>성명</label><input style={inputStyle} value={form.patientName} onChange={e => set("patientName", e.target.value)} /></div>
          <div><label style={labelStyle}>사건분류</label><select style={inputStyle} value={form.caseType} onChange={e => set("caseType", e.target.value)}><option value="">선택</option>{Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label style={labelStyle}>처분일</label><input type="date" style={inputStyle} value={form.decisionDate} onChange={e => set("decisionDate", e.target.value)} /></div>
          <div><label style={labelStyle}>승인여부</label><select style={inputStyle} value={form.approvalStatus} onChange={e => set("approvalStatus", e.target.value)}>{APPROVAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div>
            <label style={labelStyle}>사건진행여부</label>
            <select style={{ ...inputStyle, opacity: form.approvalStatus === "승인" ? 0.6 : 1, background: form.approvalStatus === "승인" ? "#f1f5f9" : "#f9fafb" }} value={form.progressStatus} onChange={e => set("progressStatus", e.target.value)} disabled={form.approvalStatus === "승인"}>
              {PROGRESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {form.approvalStatus === "승인" && (
              <span style={{ fontSize: 11, color: "#15803d", display: "block", marginTop: 4 }}>승인 사건의 진행여부는 평균임금 검토 탭의 결과로 반영됩니다</span>
            )}
            {form.approvalStatus !== "승인" && form.progressStatus === "이의제기 진행" && (
              <button onClick={() => router.push("/objection/deadline")} style={{ fontSize: 11, color: "#29ABE2", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0, textDecoration: "underline" }}>기일관리 페이지에서 확인 →</button>
            )}
            {form.approvalStatus !== "승인" && form.progressStatus === "평정청구 진행" && (
              <span style={{ fontSize: 11, color: "#15803d", display: "block", marginTop: 4 }}>평균임금 데이터 검토 탭에 반영됩니다</span>
            )}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>정공 (정보공개청구)</label>
          <select
            style={inputStyle}
            value={form.infoDisclosureStatus}
            onChange={e => {
              const v = e.target.value;
              set("infoDisclosureStatus", v);
              set("hasInfoDisclosure", v === "확보" || v === "평임확보");
            }}
          >
            <option value="">(공란 — 해당없음)</option>
            {INFO_DISCLOSURE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span style={{ fontSize: 11, color: "#6b7280", display: "block", marginTop: 4 }}>
            요청 → 직원에게 정보공개청구 요청 / 확보 → 자료 수령 완료 → 최종 결정 단계
          </span>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>메모</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.memo} onChange={e => set("memo", e.target.value)} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── 지사-TF-사건진행여부 필터 컴포넌트 ─────────────────────────────────────

function BranchTfFilter({
  filterBranch, setFilterBranch,
  filterTf, setFilterTf,
  filterProgress, setFilterProgress,
  progressOptions,
  progressLabel,
}: {
  filterBranch: string; setFilterBranch: (v: string) => void;
  filterTf: string; setFilterTf: (v: string) => void;
  filterProgress: string; setFilterProgress: (v: string) => void;
  progressOptions: string[];
  progressLabel: string;
}) {
  const { tfByBranch: BRANCH_TF_MAP, branchNames: BRANCH_LIST, allTFs: ALL_TF_OPTIONS } = useBranches();
  const tfList = filterBranch ? BRANCH_TF_MAP[filterBranch] ?? [] : ALL_TF_OPTIONS;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>지사</div>
        <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setFilterTf(""); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "white", minWidth: 120, outline: "none", cursor: "pointer" }}>
          <option value="">전체</option>
          {BRANCH_LIST.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>TF</div>
        <select value={filterTf} onChange={e => setFilterTf(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "white", minWidth: 120, outline: "none", cursor: "pointer" }}>
          <option value="">전체</option>
          {tfList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{progressLabel}</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["", ...progressOptions].map(p => (
            <button key={p} onClick={() => setFilterProgress(p)}
              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer", border: filterProgress === p ? "1px solid #29ABE2" : "1px solid #e5e7eb", background: filterProgress === p ? "#eff6ff" : "#f9fafb", color: filterProgress === p ? "#29ABE2" : "#374151", fontWeight: filterProgress === p ? 700 : 400 }}>
              {p || "전체"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ObjectionReviewPage() {
  const { tfByBranch, branchNames: BRANCH_LIST, allTFs: ALL_TF_OPTIONS } = useBranches();
  const BRANCH_TF_MAP = tfByBranch;
  const router = useRouter();
  const [tab, setTab] = useState<"review" | "wage">("review");

  // Review tab state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [filterProgress, setFilterProgress] = useState("");
  const [filterCaseType, setFilterCaseType] = useState("");
  const [filterInfo, setFilterInfo] = useState(""); // "" | 요청 | 확보 | 확보대기 (요청+요청중)
  const [searchReview, setSearchReview] = useState("");
  // 페이지네이션: 기본 200행, 필요시 "더 보기"
  const PAGE_SIZE = 200;
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewItem | null>(null);

  // 담당자 목록
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(data => setUsers(data ?? []));
  }, []);

  // Wage tab state
  const [wages, setWages] = useState<WageItem[]>([]);
  const [filterWageBranch, setFilterWageBranch] = useState("");
  const [filterWageTf, setFilterWageTf] = useState("");
  const [filterWageResult, setFilterWageResult] = useState("");
  const [searchWage, setSearchWage] = useState("");

  const handleLaborRecordDownload = async (targetCaseId: string) => {
    const res = await fetch(`/api/cases/${targetCaseId}/forms?type=LABOR_ATTORNEY_RECORD`);
    if (!res.ok) { alert("생성 실패"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "공인노무사업무처리부.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchReviews = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterTf) p.set("tfName", filterTf);
    // 송무 인계 = 송무 검토 + 송무 인계 둘 다 포함 → 별도 처리
    if (filterProgress === "송무 인계") {
      // fetch 둘 다 가져온 후 클라이언트에서 합치기 — 이미 전체를 가져와서 클라이언트 필터
    } else if (filterProgress === "미검토") {
      // progressStatus null or empty → 전체 가져와서 클라이언트 필터
    } else if (filterProgress) {
      p.set("progressStatus", filterProgress);
    }
    if (filterCaseType) p.set("caseType", filterCaseType);
    if (searchReview) p.set("search", searchReview);
    const res = await fetch(`/api/objection/review?${p}`);
    if (res.ok) setReviews(await res.json());
  }, [filterTf, filterProgress, filterCaseType, searchReview]);

  const fetchWages = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterWageTf) p.set("tfName", filterWageTf);
    if (filterWageResult) p.set("reviewResult", filterWageResult);
    if (searchWage) p.set("search", searchWage);
    const res = await fetch(`/api/objection/wage-review?${p}`);
    if (res.ok) setWages(await res.json());
  }, [filterWageTf, filterWageResult, searchWage]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);
  useEffect(() => { if (tab === "wage") fetchWages(); }, [tab, fetchWages]);

  // 필터 변경 시 페이지 리밋 초기화
  useEffect(() => { setPageLimit(PAGE_SIZE); }, [filterBranch, filterTf, filterProgress, filterCaseType, filterInfo, searchReview]);

  // 클라이언트 사이드 필터 적용
  const filteredReviews = reviews.filter(r => {
    if (filterProgress === "미검토" && (r.progressStatus && r.progressStatus !== "")) return false;
    if (filterProgress === "송무 인계" && !(r.progressStatus === "송무 검토" || r.progressStatus === "송무 인계")) return false;
    if (filterInfo === "요청중" && !(r.infoDisclosureStatus === "요청" || r.infoDisclosureStatus === "요청중")) return false;
    if (filterInfo === "확보") {
      const s = r.infoDisclosureStatus;
      if (!(s === "확보" || s === "평임확보")) return false;
    }
    if (filterInfo === "결정대기") {
      // 검토중 + 정공 확보/평임확보 → 최종 결정 단계
      const s = r.infoDisclosureStatus;
      if (r.progressStatus !== "검토중") return false;
      if (!(s === "확보" || s === "평임확보")) return false;
    }
    if (filterInfo === "지사별") {
      // placeholder: branch selector로 커버되어 이 케이스는 없음
    }
    return true;
  });

  const AUTO_TODO_STATUSES = ["이의제기 진행", "평정청구 진행", "송무 검토", "송무 인계"];

  const handleSaveReview = async (form: ReviewForm, id?: string) => {
    const method = id ? "PATCH" : "POST";
    const url = id ? `/api/objection/review/${id}` : "/api/objection/review";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) throw new Error();
    await fetchReviews();
    if (AUTO_TODO_STATUSES.includes(form.progressStatus)) {
      alert("To Do List에 할일이 자동 추가되었습니다.");
    }
  };

  // stats (전체 reviews 기준)
  const stats = {
    unreviewed: reviews.filter(r => !r.progressStatus || r.progressStatus === "").length,
    reviewing: reviews.filter(r => r.progressStatus === "검토중").length,
    ongoing: reviews.filter(r => r.progressStatus === "이의제기 진행").length,
    litigation: reviews.filter(r => r.progressStatus === "송무 검토" || r.progressStatus === "송무 인계").length,
    wage: reviews.filter(r => r.progressStatus === "평정청구 진행").length,
    infoRequested: reviews.filter(r => r.infoDisclosureStatus === "요청" || r.infoDisclosureStatus === "요청중").length,
    infoObtained: reviews.filter(r => r.progressStatus === "검토중" && (r.infoDisclosureStatus === "확보" || r.infoDisclosureStatus === "평임확보")).length,
  };

  const btnStyle = (active: boolean) => ({
    padding: "8px 20px", fontSize: 13, borderRadius: "8px 8px 0 0", cursor: "pointer" as const,
    border: active ? "1px solid #e5e7eb" : "none",
    borderBottom: active ? "1px solid white" : "1px solid #e5e7eb",
    background: active ? "white" : "#f8fafc",
    color: active ? "#1d4ed8" : "#6b7280",
    fontWeight: active ? 700 : 400,
    marginBottom: -1,
  });

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
      {reviewModal && <ReviewModal initial={reviewTarget} onClose={() => { setReviewModal(false); setReviewTarget(null); }} onSave={handleSaveReview} />}

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>OBJECTION MANAGEMENT</p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: 0 }}>처분 검토</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", marginBottom: 0 }}>
        <button style={btnStyle(tab === "review")} onClick={() => setTab("review")}>최초총현황</button>
        <button style={btnStyle(tab === "wage")} onClick={() => setTab("wage")}>평균임금 데이터 검토</button>
      </div>

      <div style={{ background: "white", borderRadius: "0 10px 10px 10px", border: "1px solid #e5e7eb", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {/* ── 최초총현황 탭 ────────────────────────── */}
        {tab === "review" && (
          <>
            {/* Stats: 진행상태 5개 + 정공 관련 2개 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "미검토", value: stats.unreviewed, color: "#6b7280", kind: "progress" as const, filter: "미검토" },
                { label: "검토중", value: stats.reviewing, color: "#29ABE2", kind: "progress" as const, filter: "검토중" },
                { label: "이의제기 진행", value: stats.ongoing, color: "#d97706", kind: "progress" as const, filter: "이의제기 진행" },
                { label: "송무 인계", value: stats.litigation, color: "#9333ea", kind: "progress" as const, filter: "송무 인계" },
                { label: "평정청구 진행", value: stats.wage, color: "#ea580c", kind: "progress" as const, filter: "평정청구 진행" },
                { label: "정공 요청중", value: stats.infoRequested, color: "#b45309", kind: "info" as const, filter: "요청중" },
                { label: "결정대기 (검토중+확보)", value: stats.infoObtained, color: "#15803d", kind: "info" as const, filter: "결정대기" },
              ].map(s => {
                const active = s.kind === "progress" ? filterProgress === s.filter : filterInfo === s.filter;
                return (
                  <div key={s.label} onClick={() => {
                    if (s.kind === "progress") {
                      setFilterProgress(filterProgress === s.filter ? "" : s.filter);
                      setFilterInfo("");
                    } else {
                      setFilterInfo(filterInfo === s.filter ? "" : s.filter);
                      if (s.filter === "결정대기") setFilterProgress(""); // 결정대기는 자체적으로 검토중 포함
                    }
                  }}
                    style={{ background: active ? "#f0f9ff" : "#f8fafc", borderRadius: 8, border: `1px solid ${active ? s.color : "#e5e7eb"}`, padding: "12px 14px", cursor: "pointer" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Filters 3단계 */}
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
              <BranchTfFilter
                filterBranch={filterBranch} setFilterBranch={setFilterBranch}
                filterTf={filterTf} setFilterTf={setFilterTf}
                filterProgress={filterProgress} setFilterProgress={setFilterProgress}
                progressOptions={PROGRESS_FILTER_OPTIONS}
                progressLabel="사건진행여부"
              />
              <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>사건분류</div>
                  <select value={filterCaseType} onChange={e => setFilterCaseType(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "white" }}>
                    <option value="">전체</option>
                    {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>검색</div>
                  <input value={searchReview} onChange={e => setSearchReview(e.target.value)} placeholder="성명 검색" style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "white", width: 140 }} />
                </div>
                <button onClick={() => { setReviewTarget(null); setReviewModal(true); }} style={{ marginLeft: "auto", background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ 등록</button>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                    {["승인여부", "TF", "성명", "사건분류", "처분일", "제척도래일", "사건진행여부", "담당자", "정공여부", "관리"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>데이터가 없습니다</td></tr>
                  )}
                  {filteredReviews.slice(0, pageLimit).map(item => {
                    const deadline = addDays(item.decisionDate, 90);
                    const now = new Date();
                    const diff = deadline ? (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : null;
                    const rowStyle = item.isAutoFilled ? { background: "#eff6ff" } : getRowStyle(item);
                    return (
                      <tr key={item.id} onClick={() => { if (!item.isAutoFilled) { setReviewTarget(item); setReviewModal(true); } }} style={{ ...rowStyle, borderBottom: "1px solid #f1f5f9", cursor: item.isAutoFilled ? "default" : "pointer" }} onMouseEnter={e => { if (!rowStyle.background) e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={e => { e.currentTarget.style.background = (rowStyle.background as string) ?? "white"; }}>
                        <td style={{ padding: "10px 12px" }}>
                          {item.isAutoFilled
                            ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA" }}>결정수령</span>
                            : <ApprovalBadge status={item.approvalStatus} />
                          }
                        </td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{item.tfName}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                        <td style={{ padding: "10px 12px", color: "#6b7280" }}>{CASE_TYPE_LABELS[item.caseType] || item.caseType}</td>
                        <td style={{ padding: "10px 12px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{formatDate(item.decisionDate)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: diff !== null && diff <= 7 ? "#dc2626" : "#374151", fontWeight: diff !== null && diff <= 7 ? 700 : 400 }}>
                          {deadline ? `${deadline.getFullYear()}-${String(deadline.getMonth()+1).padStart(2,"0")}-${String(deadline.getDate()).padStart(2,"0")}` : "-"}
                          {diff !== null && diff <= 7 && diff >= 0 && " ⚠️"}
                          {diff !== null && diff < 0 && " 🔴"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>
                          {item.isAutoFilled
                            ? <span style={{ color: "#9ca3af" }}>미검토</span>
                            : <>
                                {item.progressStatus || <span style={{ color: "#9ca3af" }}>미검토</span>}
                                {item.progressStatus === "이의제기 진행" && (
                                  <a href="/objection/deadline" onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: "#29ABE2", textDecoration: "underline", marginLeft: 6 }}>기일 관리 →</a>
                                )}
                              </>
                          }
                        </td>
                        <td style={{ padding: "10px 12px" }} onClick={e => e.stopPropagation()}>
                          <select
                            value={item.assignedTo ?? ""}
                            onChange={async (e) => {
                              const assignedTo = e.target.value || null;
                              await fetch(`/api/objection/review/${item.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ assignedTo }),
                              });
                              fetchReviews();
                              if (assignedTo) alert("담당자에게 처분 검토 요청 Todo가 생성되었습니다.");
                            }}
                            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#374151", background: "#f9fafb", cursor: "pointer", minWidth: 90 }}
                          >
                            <option value="">미지정</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "10px 12px" }} onClick={e => e.stopPropagation()}>
                          {item.isAutoFilled ? (
                            <span style={{ color: "#9ca3af", fontSize: 11 }}>-</span>
                          ) : (
                            <select
                              value={item.infoDisclosureStatus ?? ""}
                              onChange={async (e) => {
                                const status = e.target.value || null;
                                await fetch(`/api/objection/review/${item.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    tfName: item.tfName,
                                    patientName: item.patientName,
                                    caseType: item.caseType,
                                    approvalStatus: item.approvalStatus,
                                    progressStatus: item.progressStatus,
                                    decisionDate: item.decisionDate,
                                    memo: item.memo,
                                    caseId: item.caseId,
                                    infoDisclosureStatus: status,
                                  }),
                                });
                                fetchReviews();
                              }}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 6,
                                padding: "3px 8px",
                                fontSize: 11,
                                color: item.infoDisclosureStatus === "확보" || item.infoDisclosureStatus === "평임확보" ? "#15803d"
                                  : item.infoDisclosureStatus === "요청" || item.infoDisclosureStatus === "요청중" ? "#d97706"
                                  : "#6b7280",
                                background: item.infoDisclosureStatus === "확보" || item.infoDisclosureStatus === "평임확보" ? "#f0fdf4"
                                  : item.infoDisclosureStatus === "요청" || item.infoDisclosureStatus === "요청중" ? "#fffbeb"
                                  : "#f9fafb",
                                cursor: "pointer",
                                minWidth: 96,
                                fontWeight: item.infoDisclosureStatus ? 600 : 400,
                              }}
                            >
                              <option value="">(공란)</option>
                              {INFO_DISCLOSURE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {item.isAutoFilled ? (
                            <button onClick={async e => {
                              e.stopPropagation();
                              await fetch('/api/objection/review', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ caseId: item.caseId, approvalStatus: '불승인', progressStatus: '검토중' }),
                              });
                              fetchReviews();
                            }} style={{ border: "none", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 600, color: "white", background: "#29ABE2", cursor: "pointer" }}>검토 시작</button>
                          ) : (
                            <>
                              {item.caseId && (
                                <button onClick={(e) => { e.stopPropagation(); handleLaborRecordDownload(item.caseId!); }} style={{ border: "none", borderRadius: 4, padding: "3px 8px", fontSize: 11, color: "white", background: "#006838", cursor: "pointer", marginRight: 4 }}>📋 업무처리부</button>
                              )}
                              <button onClick={async e => { e.stopPropagation(); if (!confirm("삭제하시겠습니까?")) return; await fetch(`/api/objection/review/${item.id}`, { method: "DELETE" }); fetchReviews(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#dc2626", background: "white", cursor: "pointer" }}>삭제</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredReviews.length > pageLimit && (
              <div style={{ padding: "14px 0 4px", textAlign: "center" }}>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 12 }}>
                  {pageLimit.toLocaleString()} / {filteredReviews.length.toLocaleString()}건 표시
                </span>
                <button
                  onClick={() => setPageLimit(p => p + PAGE_SIZE)}
                  style={{ padding: "6px 16px", fontSize: 12, borderRadius: 6, border: "1px solid #29ABE2", background: "#eff6ff", color: "#29ABE2", fontWeight: 600, cursor: "pointer", marginRight: 6 }}
                >
                  + {PAGE_SIZE}건 더 보기
                </button>
                <button
                  onClick={() => setPageLimit(filteredReviews.length)}
                  style={{ padding: "6px 16px", fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#374151", cursor: "pointer" }}
                >
                  전체 보기
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 평임 데이터 검토 탭 ──────────────────── */}
        {tab === "wage" && (
          <>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#1d4ed8" }}>
              정보공개청구를 통해 수령한 평균임금 산정내역서의 내용을 직접 입력하는 탭입니다.
            </div>

            {/* Filters */}
            <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
              <BranchTfFilter
                filterBranch={filterWageBranch} setFilterBranch={setFilterWageBranch}
                filterTf={filterWageTf} setFilterTf={setFilterWageTf}
                filterProgress={filterWageResult} setFilterProgress={setFilterWageResult}
                progressOptions={WAGE_RESULT_OPTIONS}
                progressLabel="검토결과"
              />
              <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>검색</div>
                  <input value={searchWage} onChange={e => setSearchWage(e.target.value)} placeholder="성명 검색" style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "white", width: 140 }} />
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                    {["TF", "성명", "사건분류", "처분일", "근기법 평균임금", "산재법 특례임금", "최종 적용임금", "검토결과", "검토담당자", "관리"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wages.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>데이터가 없습니다</td></tr>
                  )}
                  {wages.map(item => (
                    <tr key={item.id} onClick={() => router.push(`/objection/wage-review/${item.id}`)} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.tfName}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{CASE_TYPE_LABELS[item.caseType] || item.caseType}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{formatDate(item.decisionDate)}</td>
                      <td style={{ padding: "10px 12px", color: "#1d4ed8", fontSize: 12 }}>{fmtWage(item.finalAvgWage)}</td>
                      <td style={{ padding: "10px 12px", color: "#15803d", fontSize: 12 }}>{fmtWage(item.statWageFinal)}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827", fontSize: 12 }}>{fmtWage(item.finalSelectedWage)}</td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.reviewResult ?? "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{item.reviewManagerName ?? "-"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <button onClick={e => { e.stopPropagation(); router.push(`/objection/wage-review/${item.id}`); }} style={{ border: "1px solid #29ABE2", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#29ABE2", background: "#eff6ff", cursor: "pointer" }}>상세</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
