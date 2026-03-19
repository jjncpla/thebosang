"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";

type WageReviewData = {
  id: string;
  tfName: string;
  patientName: string;
  caseType: string;
  decisionDate: string | null;
  retirementDate: string | null;
  diagnosisDate: string | null;
  hasNationalDisability: boolean;
  disabilityGrade: string | null;
  workerType: string | null;
  occupation1: string | null;
  occupation1Years: string | null;
  occupation2: string | null;
  occupation2Years: string | null;
  occupation3: string | null;
  occupation3Years: string | null;
  baseAvgWage: number | null;
  basisNote: string | null;
  hasCommuteCoef: boolean | null;
  changeRate: number | null;
  finalAvgWage: number | null;
  workplaceName: string | null;
  comparisonWage: string | null;
  appliedWage: string | null;
  statWageGender: string | null;
  statWageSize: string | null;
  statWageIndustry: string | null;
  statWageOccupation: string | null;
  statWageQuarter: string | null;
  statWageBase: number | null;
  statWageChangeRate: number | null;
  statWageFinal: number | null;
  finalSelectedWage: number | null;
  reviewManagerName: string | null;
  reviewResult: string | null;
  reviewDetail: string | null;
  progressNote: string | null;
  claimDate: string | null;
  decisionResultDate: string | null;
  additionalReview: string | null;
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

function fmtWage(v: number | null | undefined) {
  if (v == null) return "-";
  return v.toLocaleString("ko-KR") + "원/일";
}

const REVIEW_RESULT_OPTIONS = ["검토중", "종결", "평정청구 진행", "이의제기 진행"];

export default function WageReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<WageReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<WageReviewData>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/objection/wage-review/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setForm({
          baseAvgWage: d.baseAvgWage ?? ("" as any),
          hasCommuteCoef: d.hasCommuteCoef,
          changeRate: d.changeRate ?? ("" as any),
          finalAvgWage: d.finalAvgWage ?? ("" as any),
          statWageBase: d.statWageBase ?? ("" as any),
          statWageChangeRate: d.statWageChangeRate ?? ("" as any),
          statWageFinal: d.statWageFinal ?? ("" as any),
          reviewManagerName: d.reviewManagerName ?? "",
          reviewResult: d.reviewResult ?? "",
          reviewDetail: d.reviewDetail ?? "",
        });
        setLoading(false);
      });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/objection/wage-review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...form,
          baseAvgWage: (form.baseAvgWage as any) === "" ? null : Number(form.baseAvgWage),
          changeRate: (form.changeRate as any) === "" ? null : Number(form.changeRate),
          finalAvgWage: (form.finalAvgWage as any) === "" ? null : Number(form.finalAvgWage),
          statWageBase: (form.statWageBase as any) === "" ? null : Number(form.statWageBase),
          statWageChangeRate: (form.statWageChangeRate as any) === "" ? null : Number(form.statWageChangeRate),
          statWageFinal: (form.statWageFinal as any) === "" ? null : Number(form.statWageFinal),
          finalSelectedWage: (Number(form.finalAvgWage) || Number(form.statWageFinal))
            ? Math.max(Number(form.finalAvgWage) || 0, Number(form.statWageFinal) || 0)
            : null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setData(updated);
      // 이의제기 진행 선택 시 ObjectionReview 자동 생성
      if (form.reviewResult === "이의제기 진행" && updated.caseId) {
        try {
          await fetch("/api/objection/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: updated.caseId, approvalStatus: updated.approvalStatus ?? "승인" }),
          });
        } catch { /* silent */ }
      }
      alert("저장되었습니다.");
    } catch {
      alert("저장 오류");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof WageReviewData, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return <div style={{ padding: 40, fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif", color: "#6b7280" }}>불러오는 중...</div>;
  if (!data) return <div style={{ padding: 40, fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif", color: "#dc2626" }}>데이터를 찾을 수 없습니다.</div>;

  const calcLeft = (form.finalAvgWage as any) === "" || form.finalAvgWage == null ? null : Number(form.finalAvgWage);
  const calcRight = (form.statWageFinal as any) === "" || form.statWageFinal == null ? null : Number(form.statWageFinal);
  const finalSelectedWage = calcLeft != null || calcRight != null ? Math.max(calcLeft || 0, calcRight || 0) : null;

  const leftMatch = finalSelectedWage != null && calcLeft != null && Math.abs(finalSelectedWage - calcLeft) < 1;
  const rightMatch = finalSelectedWage != null && calcRight != null && Math.abs(finalSelectedWage - calcRight) < 1;

  const leftDimmed = rightMatch && !leftMatch;
  const rightDimmed = leftMatch && !rightMatch;

  let applyBasis = "-";
  if (leftMatch && !rightMatch) applyBasis = "근로기준법";
  if (rightMatch && !leftMatch) applyBasis = "산재법 특례";
  if (leftMatch && rightMatch) applyBasis = "근로기준법 = 산재법 특례";
  if (!leftMatch && !rightMatch && finalSelectedWage != null) applyBasis = "직접 입력";

  const inputStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 9px", fontSize: 12, color: "#374151", background: "#f9fafb", outline: "none", width: "100%" };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 3 };
  const sectionTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 800, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid" };
  const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginBottom: 8 };

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#374151", cursor: "pointer" }}>← 돌아가기</button>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 2px 0" }}>WAGE REVIEW DETAIL</p>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#005530", margin: 0 }}>
            평균임금 상세 — {data.patientName} <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>({data.tfName} / {CASE_TYPE_LABELS[data.caseType] || data.caseType})</span>
          </h1>
        </div>
      </div>

      {/* Left + Right panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* ── 좌측: 근기법 평균임금 ── */}
        <div style={{
          background: leftDimmed ? "#f8fafc" : "white",
          border: `2px solid ${leftMatch ? "#29ABE2" : leftDimmed ? "#e2e8f0" : "#bfdbfe"}`,
          borderRadius: 12,
          padding: 20,
          opacity: leftDimmed ? 0.6 : 1,
          transition: "all 0.2s",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1d4ed8", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            ① 근로기준법상 평균임금
            {leftMatch && <span style={{ fontSize: 10, background: "#29ABE2", color: "white", borderRadius: 4, padding: "2px 6px" }}>적용</span>}
          </div>

          {/* 1. 기본 정보 */}
          <div style={{ ...sectionTitleStyle, color: "#1d4ed8", borderColor: "#bfdbfe" }}>기본 정보</div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>퇴직일</label><div style={{ fontSize: 12, color: "#374151" }}>{formatDate(data.retirementDate)}</div></div>
            <div><label style={labelStyle}>진단일</label><div style={{ fontSize: 12, color: "#374151" }}>{formatDate(data.diagnosisDate)}</div></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>국가장애여부</label><div style={{ fontSize: 12, color: "#374151" }}>{data.hasNationalDisability ? "해당" : "미해당"}</div></div>
            <div><label style={labelStyle}>장애 급수</label><div style={{ fontSize: 12, color: "#374151" }}>{data.disabilityGrade ?? "-"}</div></div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>근로자 유형</label>
            <div style={{ fontSize: 12, color: "#374151" }}>{data.workerType ?? "-"}</div>
          </div>

          {/* 2. 직종 정보 */}
          <div style={{ ...sectionTitleStyle, color: "#1d4ed8", borderColor: "#bfdbfe", marginTop: 12 }}>직종 정보</div>
          {[
            { label: "직종1", job: data.occupation1, years: data.occupation1Years },
            { label: "직종2", job: data.occupation2, years: data.occupation2Years },
            { label: "직종3", job: data.occupation3, years: data.occupation3Years },
          ].map((o, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: 4 }}>
              <div><label style={labelStyle}>{o.label}</label><div style={{ fontSize: 12, color: "#374151" }}>{o.job ?? "-"}</div></div>
              <div><label style={labelStyle}>직력 (년)</label><div style={{ fontSize: 12, color: "#374151" }}>{o.years ?? "-"}</div></div>
            </div>
          ))}

          {/* 3. 실제 임금 산정 */}
          <div style={{ ...sectionTitleStyle, color: "#1d4ed8", borderColor: "#bfdbfe", marginTop: 12 }}>
            실임금 <span style={{ fontSize: 10, fontWeight: 400, color: "#6b7280" }}>(임금자료 확인 시)</span>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>최초산출 평균임금</label><input type="number" style={inputStyle} value={form.baseAvgWage ?? ""} onChange={e => set("baseAvgWage", e.target.value)} /></div>
            <div>
              <label style={labelStyle}>통상근로계수 여부</label>
              <select style={inputStyle} value={form.hasCommuteCoef == null ? "" : form.hasCommuteCoef ? "true" : "false"} onChange={e => set("hasCommuteCoef", e.target.value === "" ? null : e.target.value === "true")}>
                <option value="">-</option>
                <option value="true">적용</option>
                <option value="false">미적용</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>산정 근거</label>
            <div style={{ fontSize: 12, color: "#374151", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 4, padding: "4px 8px", minHeight: 30 }}>{data.basisNote ?? "-"}</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>증감률 (%)</label><input type="number" style={inputStyle} value={form.changeRate ?? ""} onChange={e => set("changeRate", e.target.value)} />
          </div>

          {/* 4. 동종/구조 임금 산정 */}
          <div style={{ ...sectionTitleStyle, color: "#1d4ed8", borderColor: "#bfdbfe", marginTop: 12 }}>
            동종·구조 임금 <span style={{ fontSize: 10, fontWeight: 400, color: "#6b7280" }}>(임금자료 미확인 시)</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>적용 사업장명</label>
            <div style={{ fontSize: 12, color: "#374151" }}>{data.workplaceName ?? "-"}</div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>비교임금 유형</label><div style={{ fontSize: 12, color: "#374151" }}>{data.comparisonWage ?? "-"}</div></div>
            <div><label style={labelStyle}>적용 임금</label><div style={{ fontSize: 12, color: "#374151" }}>{data.appliedWage ?? "-"}</div></div>
          </div>

          {/* 5. 최종 근기법 평균임금 */}
          <div style={{ background: leftMatch ? "#eff6ff" : "#f8fafc", border: `1px solid ${leftMatch ? "#93c5fd" : "#e2e8f0"}`, borderRadius: 8, padding: "12px 16px", marginTop: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>최종 근기법 평균임금</div>
            <input type="number" style={{ ...inputStyle, fontSize: 16, fontWeight: 700, textAlign: "center", border: "1px solid #93c5fd", color: leftMatch ? "#1d4ed8" : "#374151" }} value={form.finalAvgWage ?? ""} onChange={e => set("finalAvgWage", e.target.value)} placeholder="금액 입력" />
          </div>
        </div>

        {/* ── 우측: 산재법 특례임금 ── */}
        <div style={{
          background: rightDimmed ? "#f8fafc" : "white",
          border: `2px solid ${rightMatch ? "#8DC63F" : rightDimmed ? "#e2e8f0" : "#bbf7d0"}`,
          borderRadius: 12,
          padding: 20,
          opacity: rightDimmed ? 0.6 : 1,
          transition: "all 0.2s",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#6EA02A", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            ② 산재법상 특례임금
            {rightMatch && <span style={{ fontSize: 10, background: "#8DC63F", color: "white", borderRadius: 4, padding: "2px 6px" }}>적용</span>}
          </div>

          {/* 1. 산정 기준 */}
          <div style={{ ...sectionTitleStyle, color: "#6EA02A", borderColor: "#bbf7d0" }}>산정 기준</div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>성별</label><div style={{ fontSize: 12, color: "#374151" }}>{data.statWageGender ?? "-"}</div></div>
            <div><label style={labelStyle}>규모</label><div style={{ fontSize: 12, color: "#374151" }}>{data.statWageSize ?? "-"}</div></div>
          </div>
          <div style={rowStyle}>
            <div><label style={labelStyle}>업종</label><div style={{ fontSize: 12, color: "#374151" }}>{data.statWageIndustry ?? "-"}</div></div>
            <div><label style={labelStyle}>직종</label><div style={{ fontSize: 12, color: "#374151" }}>{data.statWageOccupation ?? "-"}</div></div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>적용 분기</label>
            <div style={{ fontSize: 12, color: "#374151" }}>{data.statWageQuarter ?? "-"}</div>
          </div>

          {/* 2. 산정 결과 */}
          <div style={{ ...sectionTitleStyle, color: "#6EA02A", borderColor: "#bbf7d0", marginTop: 12 }}>산정 결과</div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>최초 산정임금</label><input type="number" style={inputStyle} value={form.statWageBase ?? ""} onChange={e => set("statWageBase", e.target.value)} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>증감률 (%)</label><input type="number" style={inputStyle} value={form.statWageChangeRate ?? ""} onChange={e => set("statWageChangeRate", e.target.value)} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>적용 평균임금</label>
            <input type="number" style={{ ...inputStyle, fontSize: 14, fontWeight: 700, border: "1px solid #bbf7d0", color: rightMatch ? "#6EA02A" : "#374151" }} value={form.statWageFinal ?? ""} onChange={e => set("statWageFinal", e.target.value)} />
          </div>

          {/* 3. 최종 특례임금 */}
          <div style={{ background: rightMatch ? "#f0fdf4" : "#f8fafc", border: `1px solid ${rightMatch ? "#86efac" : "#e2e8f0"}`, borderRadius: 8, padding: "12px 16px", marginTop: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6EA02A", marginBottom: 6 }}>최종 특례임금</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: rightMatch ? "#6EA02A" : "#374151" }}>{form.statWageFinal ? fmtWage(Number(form.statWageFinal)) : "-"}</div>
          </div>

          {/* Spacer to align with left panel height */}
          <div style={{ flex: 1 }} />
        </div>
      </div>

      {/* Bottom: 최종 결정 임금 */}
      <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #065f46 100%)", borderRadius: 12, padding: "20px 24px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>최종 적용 평균임금</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "white" }}>{fmtWage(finalSelectedWage)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>적용 근거</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
            {applyBasis}
          </div>
        </div>
      </div>

      {/* Review Section */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 16 }}>검토 결과</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
          <div>
            <label style={labelStyle}>검토 담당자</label>
            <input style={inputStyle} value={form.reviewManagerName ?? ""} onChange={e => set("reviewManagerName", e.target.value)} placeholder="담당자명" />
          </div>
          <div>
            <label style={labelStyle}>검토 결과</label>
            <select style={inputStyle} value={form.reviewResult ?? ""} onChange={e => set("reviewResult", e.target.value)}>
              <option value="">선택</option>
              {REVIEW_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {(form.reviewResult === "평정청구 진행" || form.reviewResult === "이의제기 진행") && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#29ABE2", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "4px 8px" }}>
                {form.reviewResult === "평정청구 진행"
                  ? "📋 기일관리 > 평균임금 정정 탭에 자동으로 반영됩니다"
                  : "📋 기일관리 > 이의제기 탭에 자동으로 반영됩니다"}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>상세 쟁점</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.reviewDetail ?? ""} onChange={e => set("reviewDetail", e.target.value)} placeholder="주요 쟁점 사항 입력" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={handleSave} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
