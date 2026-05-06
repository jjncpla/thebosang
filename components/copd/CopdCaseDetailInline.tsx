"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  KWC_HOSPITALS,
  SMOKING_STATUS,
  COPD_EXAM_RESULT,
  COPD_DISPOSAL_TYPE,
  COPD_DISABILITY_DISPOSITION_TYPE,
  OCC_ATTENDANCE_TYPE,
} from "@/lib/constants/copd";
import { OCC_DISEASE_COMMITTEES } from "@/constants/occDiseaseCommittees";

const S = { fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" };

type CopdDetail = {
  id?: string;
  smokingStatus: string | null;
  smokingPacks: number | null;
  smokingYears: number | null;
  exSmokingYears: number | null;
  firstSymptomDate: string | null;
  diagnosisDate: string | null;
  diagnosisHospital: string | null;
  firstClinic: string | null;
  firstExamDate: string | null;
  fev1Rate: number | null;
  fev1Volume: number | null;
  copdMemo: string | null;
};

type CopdApplication = {
  id: string;
  applicationRound: number;
  applicationDate: string | null;
  applicationNote: string | null;
  examRequestReceivedAt: string | null;
  exam1Hospital: string | null;
  exam1Date: string | null;
  exam1Fev1Rate: number | null;
  exam1Fev1Volume: number | null;
  exam1Note: string | null;
  exam1Attendee: string | null;
  exam1Pickup: boolean | null;
  exam2Hospital: string | null;
  exam2Date: string | null;
  exam2Fev1Rate: number | null;
  exam2Fev1Volume: number | null;
  exam2Note: string | null;
  exam2Skipped: boolean;
  exam2Attendee: string | null;
  exam2Pickup: boolean | null;
  examResult: string | null;
  expertOrgRequestDate: string | null;
  expertOrgMeetingDate: string | null;
  expertOrgResult: string | null;
  expertOrgMemo: string | null;
  occCommitteeName: string | null;
  occReferralDate: string | null;
  occReviewDate: string | null;
  occAttendanceType: string | null;
  occAttendanceNote: string | null;
  occResult: string | null;
  disposalType: string | null;
  disposalDate: string | null;
  disposalNoticeReceivedAt: string | null;
  disposalReason: string | null;
  reExamPossibleDate: string | null;
  disabilityClaimDate: string | null;
  disabilityGradeType: string | null;
  disabilityDispositionType: string | null;
  disabilityDispositionGrade: string | null;
  disabilityDispositionDate: string | null;
  disabilityDispositionNoticeDate: string | null;
  memo: string | null;
};

const EMPTY_DETAIL: CopdDetail = {
  smokingStatus: null, smokingPacks: null, smokingYears: null, exSmokingYears: null,
  firstSymptomDate: null, diagnosisDate: null, diagnosisHospital: null,
  firstClinic: null, firstExamDate: null, fev1Rate: null, fev1Volume: null,
  copdMemo: null,
};

const dateOnly = (s: string | null | undefined): string | null => (s ? s.slice(0, 10) : null);

const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 10px",
  fontSize: 13, color: "#374151", outline: "none", background: "white",
  width: "100%", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 4, display: "block" };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };
const cardHeader: React.CSSProperties = { padding: "12px 18px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" };
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 };
const cardBody: React.CSSProperties = { padding: 18 };
const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 };
const grid4: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 };
const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", marginTop: 14, marginBottom: 10, paddingBottom: 4, borderBottom: "1px dashed #e5e7eb", letterSpacing: 0.3 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function CopdCaseDetailInline({ caseId, embedded = false }: { caseId: string; embedded?: boolean }) {
  const router = useRouter();

  const [detail, setDetail] = useState<CopdDetail>(EMPTY_DETAIL);
  const [applications, setApplications] = useState<CopdApplication[]>([]);
  const [caseInfo, setCaseInfo] = useState<{ patientId?: string; patientName?: string; caseType?: string; status?: string; tfName?: string | null; branch?: string | null } | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingDetail, setSavingDetail] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateDetail = <K extends keyof CopdDetail>(key: K, value: CopdDetail[K]) =>
    setDetail((prev) => ({ ...prev, [key]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/copd`);
      if (res.ok) {
        const d = await res.json();
        if (d && d.id) {
          setDetail({
            smokingStatus: d.smokingStatus ?? null,
            smokingPacks: d.smokingPacks ?? null,
            smokingYears: d.smokingYears ?? null,
            exSmokingYears: d.exSmokingYears ?? null,
            firstSymptomDate: dateOnly(d.firstSymptomDate),
            diagnosisDate: dateOnly(d.diagnosisDate),
            diagnosisHospital: d.diagnosisHospital ?? null,
            firstClinic: d.firstClinic ?? null,
            firstExamDate: dateOnly(d.firstExamDate),
            fev1Rate: d.fev1Rate ?? null,
            fev1Volume: d.fev1Volume ?? null,
            copdMemo: d.copdMemo ?? null,
          });
          setApplications(
            (d.applications ?? []).map((a: CopdApplication) => ({
              ...a,
              applicationDate: dateOnly(a.applicationDate),
              examRequestReceivedAt: dateOnly(a.examRequestReceivedAt),
              exam1Date: dateOnly(a.exam1Date),
              exam2Date: dateOnly(a.exam2Date),
              expertOrgRequestDate: dateOnly(a.expertOrgRequestDate),
              expertOrgMeetingDate: dateOnly(a.expertOrgMeetingDate),
              occReferralDate: dateOnly(a.occReferralDate),
              occReviewDate: dateOnly(a.occReviewDate),
              disposalDate: dateOnly(a.disposalDate),
              disposalNoticeReceivedAt: dateOnly(a.disposalNoticeReceivedAt),
              reExamPossibleDate: dateOnly(a.reExamPossibleDate),
              disabilityClaimDate: dateOnly(a.disabilityClaimDate),
              disabilityDispositionDate: dateOnly(a.disabilityDispositionDate),
              disabilityDispositionNoticeDate: dateOnly(a.disabilityDispositionNoticeDate),
            }))
          );
        }
      }
      const cRes = await fetch(`/api/cases/${caseId}`);
      if (cRes.ok) {
        const c = await cRes.json();
        setCaseInfo({
          patientId: c.patient?.id,
          patientName: c.patient?.name,
          caseType: c.caseType,
          status: c.status,
          tfName: c.tfName,
          branch: c.branch,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  async function saveDetail() {
    setSavingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/copd`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detail),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "저장 실패");
      }
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDetail(false);
    }
  }

  async function addApplication() {
    setError(null);
    if (applications.length > 0) {
      const last = applications.reduce(
        (a, b) => (a.applicationRound > b.applicationRound ? a : b),
        applications[0]
      );
      const finalized = ["승인", "부지급", "반려"].includes(last.disposalType ?? "");
      if (!finalized) {
        const ok = window.confirm(
          `⚠ 직전 회차(R${last.applicationRound})의 처분이 아직 확정되지 않았습니다.\n` +
          `(현재 처분 종류: ${last.disposalType || "(미입력)"})\n\n` +
          `보통 직전 회차의 처분(승인/부지급/반려) 확정 후 다음 회차를 추가합니다.\n` +
          `그래도 새 회차를 추가하시겠습니까?`
        );
        if (!ok) return;
      }
    }
    try {
      const res = await fetch(`/api/cases/${caseId}/copd/applications`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "추가 실패");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) return <div style={{ ...S, padding: embedded ? 12 : 24 }}>로딩 중...</div>;

  const wrapperStyle: React.CSSProperties = embedded
    ? { ...S }
    : { ...S, padding: 24, minHeight: "100%", background: "#f1f5f9" };

  return (
    <div style={wrapperStyle}>
      {/* 헤더 — embedded 모드에서는 환자 페이지에 이미 헤더가 있으므로 숨김 */}
      {!embedded && (
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>COPD CASE DETAIL</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => caseInfo?.patientId ? router.push(`/patients/${caseInfo.patientId}?tab=COPD`) : router.push("/cases")}
              style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", padding: 0 }}
            >
              ← 재해자 페이지
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#005530", margin: 0 }}>
              🫁 {caseInfo?.patientName ?? "재해자"}
              <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500, marginLeft: 10 }}>
                {caseInfo?.tfName} {caseInfo?.branch && `· ${caseInfo.branch}`}
              </span>
            </h1>
            {caseInfo?.status && (
              <span style={{ background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                {caseInfo.status}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0 0" }}>
            Case ID: <code>{caseId}</code>
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* 카드 1: 공통 정보 (진단 섹션은 초진과 중복되어 제거됨 — 2026-05-06) */}
      <div style={cardStyle}>
        <div style={cardHeader}>
          <h2 style={cardTitle}>공통 정보 (흡연력 · 초진)</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {savedAt && <span style={{ color: "#16a34a", fontSize: 12 }}>✅ 저장됨 ({savedAt})</span>}
            <button onClick={saveDetail} disabled={savingDetail}
              style={{ background: savingDetail ? "#9ca3af" : "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: savingDetail ? "not-allowed" : "pointer" }}>
              {savingDetail ? "저장 중..." : "💾 저장"}
            </button>
          </div>
        </div>
        <div style={cardBody}>
          <div style={sectionTitle}>흡연력</div>
          <div style={grid4}>
            <Field label="흡연 상태">
              <select style={inputStyle} value={detail.smokingStatus ?? ""} onChange={(e) => updateDetail("smokingStatus", e.target.value || null)}>
                <option value="">(선택)</option>
                {SMOKING_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="1일 개피">
              <input style={inputStyle} type="number" min={0} step="0.5" value={detail.smokingPacks ?? ""}
                onChange={(e) => updateDetail("smokingPacks", e.target.value ? parseFloat(e.target.value) : null)} placeholder="개피 (반갑=10)" />
            </Field>
            <Field label="흡연 기간 (년)">
              <input style={inputStyle} type="number" min={0} value={detail.smokingYears ?? ""}
                onChange={(e) => updateDetail("smokingYears", e.target.value ? parseInt(e.target.value, 10) : null)} />
            </Field>
            <Field label="과거 흡연 기간 (년)">
              <input style={inputStyle} type="number" min={0} value={detail.exSmokingYears ?? ""}
                onChange={(e) => updateDetail("exSmokingYears", e.target.value ? parseInt(e.target.value, 10) : null)} />
            </Field>
          </div>
          {/* 갑년 자동 계산: (1일 개피 / 20) × (흡연기간 + 과거흡연기간) */}
          {(() => {
            const packs = detail.smokingPacks ?? 0;
            const years = detail.smokingYears ?? 0;
            const exYears = detail.exSmokingYears ?? 0;
            const totalYears = years + exYears;
            const packYears = (packs / 20) * totalYears;
            if (packs <= 0 || totalYears <= 0) {
              return (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "#f9fafb", borderRadius: 6, fontSize: 12, color: "#9ca3af" }}>
                  💡 갑년 자동계산: 1일 개피 + 흡연기간(과거 포함) 입력 시 자동 표시
                </div>
              );
            }
            const display = packYears.toFixed(1);
            return (
              <div style={{ marginTop: 8, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>
                📊 자동 계산: <strong>{display}갑년</strong>
                <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400, marginLeft: 8 }}>
                  ({packs}개피 ÷ 20) × {totalYears}년 (현재 {years}년 + 과거 {exYears}년)
                </span>
              </div>
            );
          })()}

          <div style={sectionTitle}>초진</div>
          <div style={grid4}>
            <Field label="초진 의료기관">
              <input style={inputStyle} value={detail.firstClinic ?? ""} onChange={(e) => updateDetail("firstClinic", e.target.value || null)} />
            </Field>
            <Field label="초진일">
              <input style={inputStyle} type="date" value={detail.firstExamDate ?? ""} onChange={(e) => updateDetail("firstExamDate", e.target.value || null)} />
            </Field>
            <Field label="초진 1초율 (%)">
              <input style={inputStyle} type="number" step="0.01" value={detail.fev1Rate ?? ""}
                onChange={(e) => updateDetail("fev1Rate", e.target.value ? parseFloat(e.target.value) : null)} />
            </Field>
            <Field label="초진 1초량 (L)">
              <input style={inputStyle} type="number" step="0.01" value={detail.fev1Volume ?? ""}
                onChange={(e) => updateDetail("fev1Volume", e.target.value ? parseFloat(e.target.value) : null)} />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="공통 메모 / 특이사항">
              <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
                value={detail.copdMemo ?? ""} onChange={(e) => updateDetail("copdMemo", e.target.value || null)} />
            </Field>
          </div>
        </div>
      </div>

      {/* 카드 2-pre: 양식 자동생성 — COPD 최초 요양급여 청구 (PDF 분석 기반 재구성, 2026-05-06) */}
      <div style={cardStyle}>
        <div style={cardHeader}>
          <h2 style={cardTitle}>📄 양식 자동생성 — COPD 최초 요양급여 청구</h2>
        </div>
        <div style={{ ...cardBody }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>① 위임 / 청구 (산재공단 제출)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { type: "POWER_OF_ATTORNEY", label: "위임장" },
                { type: "AGENT_APPOINTMENT", label: "수임 신고서" },
                { type: "MEDICAL_BENEFIT", label: "요양급여신청서" },
              ].map((f) => (
                <a key={f.type} href={`/api/cases/${caseId}/forms?type=${f.type}`} target="_blank" rel="noreferrer"
                  style={{ background: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
                  📥 {f.label}
                </a>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>② 사실관계·재해경위 (분진작업 입증용)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { type: "COPD_FACT_CONFIRM", label: "사실관계 확인서 (COPD)", note: "사업장 작성용" },
                { type: "COPD_INJURY_REPORT", label: "재해경위서", note: "분진작업/거주이력/COPD 병력 통합" },
                { type: "COPD_INJURY_INCIDENT", label: "재해발생경위서", note: "분진직력 표 + 의학적 소견" },
                { type: "DUST_WORK_CONFIRM", label: "분진작업 확인서" },
              ].map((f) => (
                <a key={f.type} href={`/api/cases/${caseId}/forms?type=${f.type}`} target="_blank" rel="noreferrer"
                  title={f.note}
                  style={{ background: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
                  📥 {f.label}
                </a>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>③ 정보공개·기타</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { type: "INFO_DISCLOSURE", label: "정보공개청구서" },
                { type: "INFO_DISCLOSURE_PROXY", label: "정보공개 위임장" },
                { type: "WORK_HISTORY", label: "직업력 조사표" },
                { type: "LABOR_ATTORNEY_RECORD", label: "노무사 처리부" },
              ].map((f) => (
                <a key={f.type} href={`/api/cases/${caseId}/forms?type=${f.type}`} target="_blank" rel="noreferrer"
                  style={{ background: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
                  📥 {f.label}
                </a>
              ))}
            </div>
          </div>

          <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#9ca3af" }}>
            ※ 요양급여신청 소견서 / 폐기능 검사 결과지는 의료기관에서 발급받아 첨부합니다.
          </p>
        </div>
      </div>

      {/* 카드 2: 신청 회차 목록 */}
      <div style={cardStyle}>
        <div style={cardHeader}>
          <h2 style={cardTitle}>
            신청 회차 ({applications.length}건)
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginLeft: 8 }}>
              · 특진 미달 시 종료일로부터 1년 후 재신청 가능
            </span>
          </h2>
          <button onClick={addApplication}
            style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + 새 회차 추가
          </button>
        </div>
        <div style={cardBody}>
          {applications.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              아직 신청 회차가 없습니다. 위의 &quot;+ 새 회차 추가&quot; 버튼을 눌러 1차 신청을 등록하세요.
            </div>
          ) : (
            applications.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                caseId={caseId}
                onRefresh={load}
                isLast={app.applicationRound === Math.max(...applications.map((a) => a.applicationRound))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 회차별 신청 카드
// ────────────────────────────────────────────────────────────────────────────
function ApplicationCard({
  app, caseId, onRefresh, isLast,
}: {
  app: CopdApplication; caseId: string; onRefresh: () => Promise<void>; isLast: boolean;
}) {
  const [open, setOpen] = useState(isLast);
  const [data, setData] = useState<CopdApplication>(app);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setData(app); }, [app]);

  const u = <K extends keyof CopdApplication>(key: K, value: CopdApplication[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/copd/applications/${app.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "저장 실패");
      }
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      await onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`${app.applicationRound}차 신청을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/copd/applications/${app.id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "삭제 실패");
      }
      await onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const summary = (() => {
    const parts: string[] = [];
    if (data.applicationDate) parts.push(`청구 ${data.applicationDate}`);
    if (data.exam1Fev1Rate !== null) {
      const r = `1차 율${data.exam1Fev1Rate} 량${data.exam1Fev1Volume ?? "-"}${data.exam1Note ? ` (${data.exam1Note})` : ""}`;
      parts.push(r);
    }
    if (!data.exam2Skipped && data.exam2Fev1Rate !== null) {
      parts.push(`2차 율${data.exam2Fev1Rate} 량${data.exam2Fev1Volume ?? "-"}`);
    } else if (data.exam2Skipped) {
      parts.push("2차 미실시");
    }
    if (data.disposalType) parts.push(`처분: ${data.disposalType}`);
    if (data.disabilityDispositionGrade) parts.push(`장해: ${data.disabilityDispositionGrade}`);
    return parts.length ? parts.join(" / ") : "미입력";
  })();

  const subStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottom: "1px dashed #e5e7eb" };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: open ? "#eff6ff" : "#fafafa", border: "none", cursor: "pointer", fontFamily: "inherit", borderBottom: open ? "1px solid #bfdbfe" : "none" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: open ? "#1A95C8" : "#111827" }}>
          {app.applicationRound}차 신청
        </span>
        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto", marginRight: 12 }}>{summary}</span>
        <span style={{ fontSize: 12, color: open ? "#1A95C8" : "#6b7280" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: 18, background: "white" }}>
          {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", marginBottom: 12, color: "#dc2626", fontSize: 12 }}>⚠ {err}</div>}

          <div style={subStyle}>요양급여 청구 (형식상 청구 — 실 보상은 장해급여)</div>
          <div style={grid3}>
            <Field label="요양급여 청구일">
              <input style={inputStyle} type="date" value={data.applicationDate ?? ""} onChange={(e) => u("applicationDate", e.target.value || null)} />
            </Field>
            <Field label="진찰요구서 수령일">
              <input style={inputStyle} type="date" value={data.examRequestReceivedAt ?? ""} onChange={(e) => u("examRequestReceivedAt", e.target.value || null)} />
            </Field>
            <Field label="청구 메모">
              <input style={inputStyle} value={data.applicationNote ?? ""} onChange={(e) => u("applicationNote", e.target.value || null)} />
            </Field>
          </div>

          <div style={subStyle}>1차 특별진찰 (근로복지공단 소속병원)</div>
          <div style={grid4}>
            <Field label="특진병원">
              <select style={inputStyle} value={data.exam1Hospital ?? ""} onChange={(e) => u("exam1Hospital", e.target.value || null)}>
                <option value="">(선택)</option>
                {KWC_HOSPITALS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
            <Field label="특진 일시">
              <input style={inputStyle} type="date" value={data.exam1Date ?? ""} onChange={(e) => u("exam1Date", e.target.value || null)} />
            </Field>
            <Field label="1초율 (%)">
              <input style={inputStyle} type="number" step="0.01" value={data.exam1Fev1Rate ?? ""} onChange={(e) => u("exam1Fev1Rate", e.target.value ? parseFloat(e.target.value) : null)} />
            </Field>
            <Field label="1초량 (L)">
              <input style={inputStyle} type="number" step="0.01" value={data.exam1Fev1Volume ?? ""} onChange={(e) => u("exam1Fev1Volume", e.target.value ? parseFloat(e.target.value) : null)} />
            </Field>
            <Field label="특이사항">
              <input style={inputStyle} value={data.exam1Note ?? ""} onChange={(e) => u("exam1Note", e.target.value || null)} placeholder="ex: 수치미달" />
            </Field>
            <Field label="동행자">
              <input style={inputStyle} value={data.exam1Attendee ?? ""} onChange={(e) => u("exam1Attendee", e.target.value || null)} />
            </Field>
            <Field label="픽업">
              <select style={inputStyle} value={data.exam1Pickup === null ? "" : data.exam1Pickup ? "Y" : "N"}
                onChange={(e) => u("exam1Pickup", e.target.value === "" ? null : e.target.value === "Y")}>
                <option value="">(선택)</option>
                <option value="Y">픽업</option>
                <option value="N">미픽업</option>
              </select>
            </Field>
          </div>

          <div style={subStyle}>
            2차 특별진찰
            <label style={{ marginLeft: 12, fontSize: 12, fontWeight: 500, color: "#6b7280" }}>
              <input type="checkbox" checked={data.exam2Skipped} onChange={(e) => u("exam2Skipped", e.target.checked)}
                style={{ marginRight: 4 }} />
              미실시 (1차 수치미달 등)
            </label>
          </div>
          {!data.exam2Skipped && (
            <div style={grid4}>
              <Field label="특진병원">
                <select style={inputStyle} value={data.exam2Hospital ?? ""} onChange={(e) => u("exam2Hospital", e.target.value || null)}>
                  <option value="">(선택)</option>
                  {KWC_HOSPITALS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="특진 일시">
                <input style={inputStyle} type="date" value={data.exam2Date ?? ""} onChange={(e) => u("exam2Date", e.target.value || null)} />
              </Field>
              <Field label="1초율 (%)">
                <input style={inputStyle} type="number" step="0.01" value={data.exam2Fev1Rate ?? ""} onChange={(e) => u("exam2Fev1Rate", e.target.value ? parseFloat(e.target.value) : null)} />
              </Field>
              <Field label="1초량 (L)">
                <input style={inputStyle} type="number" step="0.01" value={data.exam2Fev1Volume ?? ""} onChange={(e) => u("exam2Fev1Volume", e.target.value ? parseFloat(e.target.value) : null)} />
              </Field>
              <Field label="특이사항">
                <input style={inputStyle} value={data.exam2Note ?? ""} onChange={(e) => u("exam2Note", e.target.value || null)} />
              </Field>
              <Field label="동행자">
                <input style={inputStyle} value={data.exam2Attendee ?? ""} onChange={(e) => u("exam2Attendee", e.target.value || null)} />
              </Field>
              <Field label="픽업">
                <select style={inputStyle} value={data.exam2Pickup === null ? "" : data.exam2Pickup ? "Y" : "N"}
                  onChange={(e) => u("exam2Pickup", e.target.value === "" ? null : e.target.value === "Y")}>
                  <option value="">(선택)</option>
                  <option value="Y">픽업</option>
                  <option value="N">미픽업</option>
                </select>
              </Field>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <Field label="특진 결과 (종합)">
              <select style={{ ...inputStyle, maxWidth: 240 }} value={data.examResult ?? ""}
                onChange={(e) => u("examResult", e.target.value || null)}>
                <option value="">(선택)</option>
                {COPD_EXAM_RESULT.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              ※ &quot;수치미달&quot; 선택 + 저장 시 마지막 특진일 + 1년으로 재진행 가능일이 자동 계산됩니다.
            </p>
          </div>

          {/* 직업환경연구원 (전문조사) — 의뢰되는 경우만 펼침 */}
          {(() => {
            const hasExpertOrg =
              !!data.expertOrgRequestDate ||
              !!data.expertOrgMeetingDate ||
              !!data.expertOrgResult ||
              !!data.expertOrgMemo;
            return (
              <>
                <div style={subStyle}>
                  <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={hasExpertOrg}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          u("expertOrgRequestDate", null);
                          u("expertOrgMeetingDate", null);
                          u("expertOrgResult", null);
                          u("expertOrgMemo", null);
                        } else {
                          // 토글 ON 시 더미 값 입력하여 펼침 상태 유지 (사용자가 입력 시작하면 자동 채움)
                          u("expertOrgRequestDate", data.expertOrgRequestDate ?? "");
                        }
                      }}
                    />
                    직업환경연구원 (전문조사) 의뢰
                  </label>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginLeft: 8 }}>
                    ※ 일반적으로 특진 결과가 기준내일 때 곧바로 질판위 심의 — 연구원 의뢰는 드문 경우만 체크
                  </span>
                </div>
                {hasExpertOrg && (
                  <>
                    <div style={grid3}>
                      <Field label="의뢰일">
                        <input style={inputStyle} type="date" value={data.expertOrgRequestDate ?? ""} onChange={(e) => u("expertOrgRequestDate", e.target.value || null)} />
                      </Field>
                      <Field label="개최일">
                        <input style={inputStyle} type="date" value={data.expertOrgMeetingDate ?? ""} onChange={(e) => u("expertOrgMeetingDate", e.target.value || null)} />
                      </Field>
                      <Field label="결과">
                        <input style={inputStyle} value={data.expertOrgResult ?? ""} onChange={(e) => u("expertOrgResult", e.target.value || null)} placeholder="ex: 직력 확인 / 미달" />
                      </Field>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Field label="전문조사 메모">
                        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
                          value={data.expertOrgMemo ?? ""} onChange={(e) => u("expertOrgMemo", e.target.value || null)} />
                      </Field>
                    </div>
                  </>
                )}
              </>
            );
          })()}

          <div style={subStyle}>
            업무상 질병판정위원회
            <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginLeft: 8 }}>
              ※ 통지서 없이 문자로 통지 — 회부 후 심의일자가 별도 통지됨. 직접 입력하세요.
            </span>
          </div>
          <div style={grid3}>
            <Field label="질판위 명 (소속 위원회)">
              <select style={inputStyle} value={data.occCommitteeName ?? ""} onChange={(e) => u("occCommitteeName", e.target.value || null)}>
                <option value="">(선택)</option>
                {OCC_DISEASE_COMMITTEES.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="심의 의뢰일 (회부일)">
              <input style={inputStyle} type="date" value={data.occReferralDate ?? ""} onChange={(e) => u("occReferralDate", e.target.value || null)} />
            </Field>
            <Field label="심의일 (문자 수신 후 입력)">
              <input style={inputStyle} type="date" value={data.occReviewDate ?? ""} onChange={(e) => u("occReviewDate", e.target.value || null)} />
            </Field>
            <Field label="참석 유형">
              <select style={inputStyle} value={data.occAttendanceType ?? ""} onChange={(e) => u("occAttendanceType", e.target.value || null)}>
                <option value="">(선택)</option>
                {OCC_ATTENDANCE_TYPE.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="결과">
              <input style={inputStyle} value={data.occResult ?? ""} onChange={(e) => u("occResult", e.target.value || null)} placeholder="ex: 인용 / 기각" />
            </Field>
            <Field label="참석 메모">
              <input style={inputStyle} value={data.occAttendanceNote ?? ""} onChange={(e) => u("occAttendanceNote", e.target.value || null)} />
            </Field>
          </div>

          <div style={subStyle}>요양 처분</div>
          <div style={grid4}>
            <Field label="처분 종류">
              <select style={inputStyle} value={data.disposalType ?? ""} onChange={(e) => u("disposalType", e.target.value || null)}>
                <option value="">(선택)</option>
                {COPD_DISPOSAL_TYPE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="처분일자">
              <input style={inputStyle} type="date" value={data.disposalDate ?? ""} onChange={(e) => u("disposalDate", e.target.value || null)} />
            </Field>
            <Field label="결정통지 수령일">
              <input style={inputStyle} type="date" value={data.disposalNoticeReceivedAt ?? ""} onChange={(e) => u("disposalNoticeReceivedAt", e.target.value || null)} title="이의제기 90일 D-day 기산점" />
            </Field>
            <Field label="재진행 가능일">
              <input style={inputStyle} type="date" value={data.reExamPossibleDate ?? ""} onChange={(e) => u("reExamPossibleDate", e.target.value || null)} />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="처분 사유 / 메모">
              <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
                value={data.disposalReason ?? ""} onChange={(e) => u("disposalReason", e.target.value || null)} />
            </Field>
          </div>

          <div style={subStyle}>
            장해급여 청구
            <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginLeft: 8 }}>
              ※ 요양 승인 시에만 진행
            </span>
          </div>
          <div style={grid4}>
            <Field label="장해 청구일">
              <input style={inputStyle} type="date" value={data.disabilityClaimDate ?? ""} onChange={(e) => u("disabilityClaimDate", e.target.value || null)} />
            </Field>
            <Field label="처분 종류">
              <select style={inputStyle} value={data.disabilityDispositionType ?? ""} onChange={(e) => u("disabilityDispositionType", e.target.value || null)}>
                <option value="">(선택)</option>
                {COPD_DISABILITY_DISPOSITION_TYPE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="등급 종류">
              <input style={inputStyle} value={data.disabilityGradeType ?? ""} onChange={(e) => u("disabilityGradeType", e.target.value || null)} placeholder="일반/조정/가중/준용" />
            </Field>
            <Field label="등급 (호)">
              <input style={inputStyle} value={data.disabilityDispositionGrade ?? ""} onChange={(e) => u("disabilityDispositionGrade", e.target.value || null)} placeholder="ex: 7급05호" />
            </Field>
            <Field label="장해 처분일">
              <input style={inputStyle} type="date" value={data.disabilityDispositionDate ?? ""} onChange={(e) => u("disabilityDispositionDate", e.target.value || null)} />
            </Field>
            <Field label="장해 통지일">
              <input style={inputStyle} type="date" value={data.disabilityDispositionNoticeDate ?? ""} onChange={(e) => u("disabilityDispositionNoticeDate", e.target.value || null)} />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="회차 메모">
              <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
                value={data.memo ?? ""} onChange={(e) => u("memo", e.target.value || null)} />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px solid #f1f5f9", alignItems: "center" }}>
            <button onClick={save} disabled={saving}
              style={{ background: saving ? "#9ca3af" : "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "저장 중..." : "💾 회차 저장"}
            </button>
            {savedAt && <span style={{ color: "#16a34a", fontSize: 12 }}>✅ 저장됨 ({savedAt})</span>}
            <button onClick={remove}
              style={{ marginLeft: "auto", background: "white", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🗑 회차 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
