"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TF_OPTIONS = ["울산TF", "울산동부TF", "울산남부TF", "울산북부TF"];
const APPROVAL_OPTIONS = ["승인", "불승인", "일부승인"];
const PROGRESS_OPTIONS = ["종결", "검토중", "이의제기 진행", "송무 검토", "송무 인계", "평정청구 진행"];

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
  memo: string | null;
  caseId: string | null;
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
  decisionDate: string; hasInfoDisclosure: boolean; memo: string;
};
const emptyReviewForm: ReviewForm = {
  tfName: "", patientName: "", caseType: "",
  approvalStatus: "불승인", progressStatus: "검토중",
  decisionDate: "", hasInfoDisclosure: false, memo: "",
};

function ReviewModal({ initial, onClose, onSave }: {
  initial: ReviewItem | null;
  onClose: () => void;
  onSave: (form: ReviewForm, id?: string) => Promise<void>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ReviewForm>(() =>
    initial ? { tfName: initial.tfName, patientName: initial.patientName, caseType: initial.caseType, approvalStatus: initial.approvalStatus, progressStatus: initial.progressStatus, decisionDate: toInputDate(initial.decisionDate), hasInfoDisclosure: initial.hasInfoDisclosure, memo: initial.memo ?? "" }
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
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" }}>{initial ? "수정" : "등록"} — 최초총현황</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          <div><label style={labelStyle}>TF</label><select style={inputStyle} value={form.tfName} onChange={e => set("tfName", e.target.value)}><option value="">선택</option>{TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={labelStyle}>성명</label><input style={inputStyle} value={form.patientName} onChange={e => set("patientName", e.target.value)} /></div>
          <div><label style={labelStyle}>사건분류</label><input style={inputStyle} value={form.caseType} onChange={e => set("caseType", e.target.value)} /></div>
          <div><label style={labelStyle}>처분일</label><input type="date" style={inputStyle} value={form.decisionDate} onChange={e => set("decisionDate", e.target.value)} /></div>
          <div><label style={labelStyle}>승인여부</label><select style={inputStyle} value={form.approvalStatus} onChange={e => set("approvalStatus", e.target.value)}>{APPROVAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div>
            <label style={labelStyle}>사건진행여부</label>
            <select style={inputStyle} value={form.progressStatus} onChange={e => set("progressStatus", e.target.value)}>
              {PROGRESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {form.progressStatus === "이의제기 진행" && (
              <button onClick={() => router.push("/objection/deadline")} style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0, textDecoration: "underline" }}>기일관리 페이지에서 확인 →</button>
            )}
            {form.progressStatus === "평정청구 진행" && (
              <button onClick={onClose} style={{ fontSize: 11, color: "#15803d", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0, textDecoration: "underline" }}>평균임금 데이터 검토 탭으로 이동 →</button>
            )}
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={form.hasInfoDisclosure} onChange={e => set("hasInfoDisclosure", e.target.checked)} style={{ cursor: "pointer" }} />
            정공 여부
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>메모</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.memo} onChange={e => set("memo", e.target.value)} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Wage Modal ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WageForm = Record<string, any>;

function WageModal({ initial, onClose, onSave }: {
  initial: WageItem | null;
  onClose: () => void;
  onSave: (form: WageForm, id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<WageForm>(() =>
    initial ? { ...initial, decisionDate: toInputDate(initial.decisionDate), retirementDate: toInputDate(initial.retirementDate) }
      : { tfName: "", patientName: "", caseType: "", reviewResult: "", reviewManagerName: "" }
  );
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setForm((f: WageForm) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form, initial?.id); onClose(); }
    catch { alert("저장 오류"); }
    finally { setSaving(false); }
  };

  const inputStyle = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", width: "100%" };
  const labelStyle = { fontSize: 11, color: "#6b7280", fontWeight: 700 as const, display: "block" as const, marginBottom: 3 };
  const sectionStyle = { fontSize: 11, color: "#374151", fontWeight: 800 as const, background: "#f8fafc", padding: "6px 10px", borderRadius: 6, marginBottom: 10, marginTop: 14, border: "1px solid #e5e7eb" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 24, zIndex: 1000, maxWidth: 720, width: "95%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" }}>{initial ? "수정" : "등록"} — 평균임금 데이터 검토</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>

        <div style={sectionStyle}>기본 정보</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 14px" }}>
          <div><label style={labelStyle}>TF</label><select style={inputStyle} value={form.tfName ?? ""} onChange={e => set("tfName", e.target.value)}><option value="">선택</option>{TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={labelStyle}>성명</label><input style={inputStyle} value={form.patientName ?? ""} onChange={e => set("patientName", e.target.value)} /></div>
          <div><label style={labelStyle}>사건분류</label><input style={inputStyle} value={form.caseType ?? ""} onChange={e => set("caseType", e.target.value)} /></div>
          <div><label style={labelStyle}>처분일</label><input type="date" style={inputStyle} value={form.decisionDate ?? ""} onChange={e => set("decisionDate", e.target.value)} /></div>
          <div><label style={labelStyle}>퇴직일</label><input type="date" style={inputStyle} value={form.retirementDate ?? ""} onChange={e => set("retirementDate", e.target.value)} /></div>
          <div><label style={labelStyle}>진단일</label><input type="date" style={inputStyle} value={form.diagnosisDate ?? ""} onChange={e => set("diagnosisDate", e.target.value)} /></div>
          <div><label style={labelStyle}>일용/상용</label><select style={inputStyle} value={form.workerType ?? ""} onChange={e => set("workerType", e.target.value)}><option value="">선택</option><option>일용</option><option>상용</option></select></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 18 }}>
            <input type="checkbox" checked={!!form.hasNationalDisability} onChange={e => set("hasNationalDisability", e.target.checked)} id="nd" />
            <label htmlFor="nd" style={{ fontSize: 12, color: "#374151", cursor: "pointer" }}>국가장애</label>
            <input style={{ ...inputStyle, width: 60 }} placeholder="급수" value={form.disabilityGrade ?? ""} onChange={e => set("disabilityGrade", e.target.value)} />
          </div>
        </div>

        <div style={sectionStyle}>직종 정보</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: "10px 14px" }}>
          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>직종1</label><input style={inputStyle} value={form.occupation1 ?? ""} onChange={e => set("occupation1", e.target.value)} /></div>
          <div><label style={labelStyle}>직력1</label><input style={inputStyle} value={form.occupation1Years ?? ""} onChange={e => set("occupation1Years", e.target.value)} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>직종2</label><input style={inputStyle} value={form.occupation2 ?? ""} onChange={e => set("occupation2", e.target.value)} /></div>
          <div><label style={labelStyle}>직력2</label><input style={inputStyle} value={form.occupation2Years ?? ""} onChange={e => set("occupation2Years", e.target.value)} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>직종3</label><input style={inputStyle} value={form.occupation3 ?? ""} onChange={e => set("occupation3", e.target.value)} /></div>
          <div><label style={labelStyle}>직력3</label><input style={inputStyle} value={form.occupation3Years ?? ""} onChange={e => set("occupation3Years", e.target.value)} /></div>
        </div>

        <div style={sectionStyle}>실제임금</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 14px" }}>
          <div><label style={labelStyle}>최초산출평균임금</label><input type="number" style={inputStyle} value={form.baseAvgWage ?? ""} onChange={e => set("baseAvgWage", e.target.value)} /></div>
          <div><label style={labelStyle}>산정근거</label><input style={inputStyle} value={form.basisNote ?? ""} onChange={e => set("basisNote", e.target.value)} /></div>
          <div><label style={labelStyle}>증감률(%)</label><input type="number" style={inputStyle} value={form.changeRate ?? ""} onChange={e => set("changeRate", e.target.value)} /></div>
          <div><label style={labelStyle}>적용평균임금</label><input type="number" style={inputStyle} value={form.finalAvgWage ?? ""} onChange={e => set("finalAvgWage", e.target.value)} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 18 }}>
            <input type="checkbox" checked={!!form.hasCommuteCoef} onChange={e => set("hasCommuteCoef", e.target.checked)} id="cc" />
            <label htmlFor="cc" style={{ fontSize: 12, color: "#374151", cursor: "pointer" }}>통상근로계수 적용</label>
          </div>
        </div>

        <div style={sectionStyle}>동종/통계임금</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 14px" }}>
          <div><label style={labelStyle}>성별</label><input style={inputStyle} value={form.statWageGender ?? ""} onChange={e => set("statWageGender", e.target.value)} /></div>
          <div><label style={labelStyle}>규모</label><input style={inputStyle} value={form.statWageSize ?? ""} onChange={e => set("statWageSize", e.target.value)} /></div>
          <div><label style={labelStyle}>업종</label><input style={inputStyle} value={form.statWageIndustry ?? ""} onChange={e => set("statWageIndustry", e.target.value)} /></div>
          <div><label style={labelStyle}>직종</label><input style={inputStyle} value={form.statWageOccupation ?? ""} onChange={e => set("statWageOccupation", e.target.value)} /></div>
          <div><label style={labelStyle}>적용분기</label><input style={inputStyle} value={form.statWageQuarter ?? ""} onChange={e => set("statWageQuarter", e.target.value)} /></div>
          <div><label style={labelStyle}>최초산정임금</label><input type="number" style={inputStyle} value={form.statWageBase ?? ""} onChange={e => set("statWageBase", e.target.value)} /></div>
          <div><label style={labelStyle}>증감률(%)</label><input type="number" style={inputStyle} value={form.statWageChangeRate ?? ""} onChange={e => set("statWageChangeRate", e.target.value)} /></div>
          <div><label style={labelStyle}>적용평균임금</label><input type="number" style={inputStyle} value={form.statWageFinal ?? ""} onChange={e => set("statWageFinal", e.target.value)} /></div>
        </div>

        <div style={sectionStyle}>최종 산정</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
          <div><label style={labelStyle}>최종 채택 평균임금</label><input type="number" style={inputStyle} value={form.finalSelectedWage ?? ""} onChange={e => set("finalSelectedWage", e.target.value)} /></div>
          <div><label style={labelStyle}>적용임금 유형</label><input style={inputStyle} value={form.appliedWage ?? ""} onChange={e => set("appliedWage", e.target.value)} /></div>
        </div>

        <div style={sectionStyle}>검토 결과</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
          <div><label style={labelStyle}>검토담당자</label><input style={inputStyle} value={form.reviewManagerName ?? ""} onChange={e => set("reviewManagerName", e.target.value)} /></div>
          <div><label style={labelStyle}>검토결과</label><input style={inputStyle} value={form.reviewResult ?? ""} onChange={e => set("reviewResult", e.target.value)} /></div>
          <div><label style={labelStyle}>청구일</label><input type="date" style={inputStyle} value={form.claimDate ?? ""} onChange={e => set("claimDate", e.target.value)} /></div>
          <div><label style={labelStyle}>결정일</label><input type="date" style={inputStyle} value={form.decisionResultDate ?? ""} onChange={e => set("decisionResultDate", e.target.value)} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>상세 쟁점</label><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 50 }} value={form.reviewDetail ?? ""} onChange={e => set("reviewDetail", e.target.value)} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>진행경과</label><textarea style={{ ...inputStyle, resize: "vertical", minHeight: 50 }} value={form.progressNote ?? ""} onChange={e => set("progressNote", e.target.value)} /></div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
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

export default function ObjectionReviewPage() {
  const [tab, setTab] = useState<"review" | "wage">("review");

  // Review tab state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [filterTf, setFilterTf] = useState("");
  const [filterProgress, setFilterProgress] = useState("");
  const [searchReview, setSearchReview] = useState("");
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewItem | null>(null);

  // Wage tab state
  const [wages, setWages] = useState<WageItem[]>([]);
  const [filterWageTf, setFilterWageTf] = useState("");
  const [filterWageResult, setFilterWageResult] = useState("");
  const [searchWage, setSearchWage] = useState("");
  const [wageModal, setWageModal] = useState(false);
  const [wageTarget, setWageTarget] = useState<WageItem | null>(null);

  const fetchReviews = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterTf) p.set("tfName", filterTf);
    if (filterProgress) p.set("progressStatus", filterProgress);
    if (searchReview) p.set("search", searchReview);
    const res = await fetch(`/api/objection/review?${p}`);
    if (res.ok) setReviews(await res.json());
  }, [filterTf, filterProgress, searchReview]);

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

  const handleSaveReview = async (form: ReviewForm, id?: string) => {
    const method = id ? "PATCH" : "POST";
    const url = id ? `/api/objection/review/${id}` : "/api/objection/review";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) throw new Error();
    await fetchReviews();
  };

  const handleSaveWage = async (form: WageForm, id?: string) => {
    const method = id ? "PATCH" : "POST";
    const url = id ? `/api/objection/wage-review/${id}` : "/api/objection/wage-review";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) throw new Error();
    await fetchWages();
  };

  // stats
  const stats = {
    ongoing: reviews.filter(r => r.progressStatus === "이의제기 진행").length,
    expired: reviews.filter(r => { const d = addDays(r.decisionDate, 90); return d && d < new Date(); }).length,
    litigation: reviews.filter(r => r.progressStatus === "송무 인계").length,
    wage: reviews.filter(r => r.progressStatus === "평정청구 진행").length,
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
      {wageModal && <WageModal initial={wageTarget} onClose={() => { setWageModal(false); setWageTarget(null); }} onSave={handleSaveWage} />}

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>OBJECTION MANAGEMENT</p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>이의제기 관리 — 최초총현황·평임검토</h1>
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
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "이의제기 진행 중", value: stats.ongoing, color: "#2563eb" },
                { label: "재처분 필요(제척도과)", value: stats.expired, color: "#dc2626" },
                { label: "송무 인계", value: stats.litigation, color: "#9333ea" },
                { label: "평정청구 진행", value: stats.wage, color: "#ea580c" },
              ].map(s => (
                <div key={s.label} style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb", padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>TF</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["", ...TF_OPTIONS].map(t => (
                    <button key={t} onClick={() => setFilterTf(t)} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", border: filterTf === t ? "1px solid #2563eb" : "1px solid #e5e7eb", background: filterTf === t ? "#eff6ff" : "#f9fafb", color: filterTf === t ? "#2563eb" : "#374151", fontWeight: filterTf === t ? 700 : 400 }}>{t || "전체"}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>사건진행여부</div>
                <select value={filterProgress} onChange={e => setFilterProgress(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}>
                  <option value="">전체</option>
                  {PROGRESS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>검색</div>
                <input value={searchReview} onChange={e => setSearchReview(e.target.value)} placeholder="성명 검색" style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", width: 140 }} />
              </div>
              <button onClick={() => { setReviewTarget(null); setReviewModal(true); }} style={{ marginLeft: "auto", background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ 등록</button>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                    {["승인여부", "TF", "성명", "사건분류", "처분일", "제척도래일", "사건진행여부", "정공여부", "관리"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>데이터가 없습니다</td></tr>
                  )}
                  {reviews.map(item => {
                    const deadline = addDays(item.decisionDate, 90);
                    const now = new Date();
                    const diff = deadline ? (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : null;
                    const rowStyle = getRowStyle(item);
                    return (
                      <tr key={item.id} onClick={() => { setReviewTarget(item); setReviewModal(true); }} style={{ ...rowStyle, borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onMouseEnter={e => { if (!rowStyle.background) e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={e => { e.currentTarget.style.background = rowStyle.background as string ?? "white"; }}>
                        <td style={{ padding: "10px 12px" }}><ApprovalBadge status={item.approvalStatus} /></td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{item.tfName}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                        <td style={{ padding: "10px 12px", color: "#6b7280" }}>{item.caseType}</td>
                        <td style={{ padding: "10px 12px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{formatDate(item.decisionDate)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: diff !== null && diff <= 7 ? "#dc2626" : "#374151", fontWeight: diff !== null && diff <= 7 ? 700 : 400 }}>
                          {deadline ? `${deadline.getFullYear()}-${String(deadline.getMonth()+1).padStart(2,"0")}-${String(deadline.getDate()).padStart(2,"0")}` : "-"}
                          {diff !== null && diff <= 7 && diff >= 0 && " ⚠️"}
                          {diff !== null && diff < 0 && " 🔴"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{item.progressStatus}</td>
                        <td style={{ padding: "10px 12px", color: item.hasInfoDisclosure ? "#15803d" : "#9ca3af" }}>{item.hasInfoDisclosure ? "✓ 있음" : "없음"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={async e => { e.stopPropagation(); if (!confirm("삭제하시겠습니까?")) return; await fetch(`/api/objection/review/${item.id}`, { method: "DELETE" }); fetchReviews(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#dc2626", background: "white", cursor: "pointer" }}>삭제</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── 평임 데이터 검토 탭 ──────────────────── */}
        {tab === "wage" && (
          <>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#1d4ed8" }}>
              정보공개청구를 통해 수령한 평균임금 산정내역서의 내용을 직접 입력하는 탭입니다.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>TF</div>
                <select value={filterWageTf} onChange={e => setFilterWageTf(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}>
                  <option value="">전체</option>
                  {TF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>검토결과</div>
                <input value={filterWageResult} onChange={e => setFilterWageResult(e.target.value)} placeholder="검토결과 필터" style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", width: 130 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>검색</div>
                <input value={searchWage} onChange={e => setSearchWage(e.target.value)} placeholder="성명 검색" style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", width: 130 }} />
              </div>
              <button onClick={() => { setWageTarget(null); setWageModal(true); }} style={{ marginLeft: "auto", background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ 등록</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                    {["TF", "성명", "사건분류", "처분일", "퇴직일", "적용임금유형", "최종평균임금", "검토결과", "검토담당자", "관리"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wages.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: "40px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>데이터가 없습니다</td></tr>
                  )}
                  {wages.map(item => (
                    <tr key={item.id} onClick={() => { setWageTarget(item); setWageModal(true); }} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.tfName}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{item.caseType}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{formatDate(item.decisionDate)}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{formatDate(item.retirementDate)}</td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.appliedWage ?? "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#374151", fontWeight: 600 }}>{item.finalSelectedWage != null ? item.finalSelectedWage.toLocaleString() + "원" : "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>{item.reviewResult ?? "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{item.reviewManagerName ?? "-"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <button onClick={e => e.stopPropagation()} style={{ border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#374151", background: "white", cursor: "pointer" }}>수정</button>
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
