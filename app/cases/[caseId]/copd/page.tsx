"use client";

import { useEffect, useState, use } from "react";

interface CopdDetail {
  firstClinic: string | null;
  firstExamDate: string | null;
  fev1Rate: number | null;
  fev1Volume: number | null;
  specialClinic: string | null;
  exam1Date: string | null;
  exam1Rate: number | null;
  exam1Volume: number | null;
  exam2Date: string | null;
  exam2Rate: number | null;
  exam2Volume: number | null;
  examMemo: string | null;
  expertOrgDate: string | null;
  reExamPossibleDate: string | null;
  occDiseaseCommittee: string | null;
  occReferralDate: string | null;
  occReviewDate: string | null;
  occAttendanceType: string | null;
  occAttendanceNote: string | null;
  disposalType: string | null;
  disposalDate: string | null;
  disabilityClaimDate: string | null;
  disabilityDispositionType: string | null;
  disabilityGradeType: string | null;
  disabilityDispositionGrade: string | null;
  disabilityDispositionDate: string | null;
  disabilityDispositionNoticeDate: string | null;
}

const EMPTY: CopdDetail = {
  firstClinic: null, firstExamDate: null, fev1Rate: null, fev1Volume: null,
  specialClinic: null, exam1Date: null, exam1Rate: null, exam1Volume: null,
  exam2Date: null, exam2Rate: null, exam2Volume: null, examMemo: null,
  expertOrgDate: null, reExamPossibleDate: null,
  occDiseaseCommittee: null, occReferralDate: null, occReviewDate: null,
  occAttendanceType: null, occAttendanceNote: null,
  disposalType: null, disposalDate: null,
  disabilityClaimDate: null, disabilityDispositionType: null,
  disabilityGradeType: null, disabilityDispositionGrade: null,
  disabilityDispositionDate: null, disabilityDispositionNoticeDate: null,
};

const dateOnly = (s: string | null | undefined): string | null => (s ? s.slice(0, 10) : null);

export default function CopdDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const [detail, setDetail] = useState<CopdDetail>(EMPTY);
  const [caseInfo, setCaseInfo] = useState<{ patientName?: string; caseType?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof CopdDetail>(key: K, value: CopdDetail[K]) {
    setDetail((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/copd`);
        if (res.ok) {
          const d = await res.json();
          if (d && d.id) {
            setDetail({
              firstClinic: d.firstClinic ?? null,
              firstExamDate: dateOnly(d.firstExamDate),
              fev1Rate: d.fev1Rate ?? null,
              fev1Volume: d.fev1Volume ?? null,
              specialClinic: d.specialClinic ?? null,
              exam1Date: dateOnly(d.exam1Date),
              exam1Rate: d.exam1Rate ?? null,
              exam1Volume: d.exam1Volume ?? null,
              exam2Date: dateOnly(d.exam2Date),
              exam2Rate: d.exam2Rate ?? null,
              exam2Volume: d.exam2Volume ?? null,
              examMemo: d.examMemo ?? null,
              expertOrgDate: dateOnly(d.expertOrgDate),
              reExamPossibleDate: dateOnly(d.reExamPossibleDate),
              occDiseaseCommittee: d.occDiseaseCommittee ?? null,
              occReferralDate: dateOnly(d.occReferralDate),
              occReviewDate: dateOnly(d.occReviewDate),
              occAttendanceType: d.occAttendanceType ?? null,
              occAttendanceNote: d.occAttendanceNote ?? null,
              disposalType: d.disposalType ?? null,
              disposalDate: dateOnly(d.disposalDate),
              disabilityClaimDate: dateOnly(d.disabilityClaimDate),
              disabilityDispositionType: d.disabilityDispositionType ?? null,
              disabilityGradeType: d.disabilityGradeType ?? null,
              disabilityDispositionGrade: d.disabilityDispositionGrade ?? null,
              disabilityDispositionDate: dateOnly(d.disabilityDispositionDate),
              disabilityDispositionNoticeDate: dateOnly(d.disabilityDispositionNoticeDate),
            });
          }
        }
        const caseRes = await fetch(`/api/cases/${caseId}`);
        if (caseRes.ok) {
          const cd = await caseRes.json();
          setCaseInfo({ patientName: cd.patient?.name, caseType: cd.caseType });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  async function save() {
    setSaving(true);
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
      setSaving(false);
    }
  }

  const containerStyle: React.CSSProperties = { maxWidth: 880, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" };
  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, color: "#374151", fontWeight: 500, marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
  const fieldStyle: React.CSSProperties = { marginBottom: 12 };
  const gridTwo: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
  const gridFour: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 };

  if (loading) return <div style={containerStyle}>로딩 중...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🫁 COPD 사건 상세</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Case ID: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{caseId}</code>
        {caseInfo?.patientName && (<> / 재해자: <strong>{caseInfo.patientName}</strong></>)}
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>초진 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}><label style={labelStyle}>초진 의료기관</label>
            <input style={inputStyle} value={detail.firstClinic ?? ""} onChange={(e) => update("firstClinic", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>초진일</label>
            <input style={inputStyle} type="date" value={detail.firstExamDate ?? ""} onChange={(e) => update("firstExamDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>FEV1 % (초진)</label>
            <input style={inputStyle} type="number" step="0.01" value={detail.fev1Rate ?? ""} onChange={(e) => update("fev1Rate", e.target.value ? parseFloat(e.target.value) : null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>FEV1 Volume (초진)</label>
            <input style={inputStyle} type="number" step="0.01" value={detail.fev1Volume ?? ""} onChange={(e) => update("fev1Volume", e.target.value ? parseFloat(e.target.value) : null)} /></div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>특진 정보</h2>
        <div style={fieldStyle}><label style={labelStyle}>특진 의료기관</label>
          <input style={inputStyle} value={detail.specialClinic ?? ""} onChange={(e) => update("specialClinic", e.target.value || null)} /></div>
        <div style={gridFour}>
          <div style={fieldStyle}><label style={labelStyle}>1차 특진일</label>
            <input style={inputStyle} type="date" value={detail.exam1Date ?? ""} onChange={(e) => update("exam1Date", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>1차 FEV1 %</label>
            <input style={inputStyle} type="number" step="0.01" value={detail.exam1Rate ?? ""} onChange={(e) => update("exam1Rate", e.target.value ? parseFloat(e.target.value) : null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>1차 Volume</label>
            <input style={inputStyle} type="number" step="0.01" value={detail.exam1Volume ?? ""} onChange={(e) => update("exam1Volume", e.target.value ? parseFloat(e.target.value) : null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>2차 특진일</label>
            <input style={inputStyle} type="date" value={detail.exam2Date ?? ""} onChange={(e) => update("exam2Date", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>2차 FEV1 %</label>
            <input style={inputStyle} type="number" step="0.01" value={detail.exam2Rate ?? ""} onChange={(e) => update("exam2Rate", e.target.value ? parseFloat(e.target.value) : null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>2차 Volume</label>
            <input style={inputStyle} type="number" step="0.01" value={detail.exam2Volume ?? ""} onChange={(e) => update("exam2Volume", e.target.value ? parseFloat(e.target.value) : null)} /></div>
        </div>
        <div style={fieldStyle}><label style={labelStyle}>특진 메모</label>
          <textarea style={{ ...inputStyle, height: 60, fontFamily: "inherit" }} value={detail.examMemo ?? ""} onChange={(e) => update("examMemo", e.target.value || null)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>전문조사 / 질판위</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}><label style={labelStyle}>전문조사기관 결정일</label>
            <input style={inputStyle} type="date" value={detail.expertOrgDate ?? ""} onChange={(e) => update("expertOrgDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>재진단 가능일</label>
            <input style={inputStyle} type="date" value={detail.reExamPossibleDate ?? ""} onChange={(e) => update("reExamPossibleDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>업무상 질병판정위원회</label>
            <input style={inputStyle} value={detail.occDiseaseCommittee ?? ""} onChange={(e) => update("occDiseaseCommittee", e.target.value || null)} placeholder="ex: 부산질병판정위원회" /></div>
          <div style={fieldStyle}><label style={labelStyle}>질판위 회부일</label>
            <input style={inputStyle} type="date" value={detail.occReferralDate ?? ""} onChange={(e) => update("occReferralDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>질판위 심의일</label>
            <input style={inputStyle} type="date" value={detail.occReviewDate ?? ""} onChange={(e) => update("occReviewDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>참석 유형</label>
            <input style={inputStyle} value={detail.occAttendanceType ?? ""} onChange={(e) => update("occAttendanceType", e.target.value || null)} placeholder="ex: 출석/서면" /></div>
        </div>
        <div style={fieldStyle}><label style={labelStyle}>참석 메모</label>
          <textarea style={{ ...inputStyle, height: 60, fontFamily: "inherit" }} value={detail.occAttendanceNote ?? ""} onChange={(e) => update("occAttendanceNote", e.target.value || null)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>처분 / 장해</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}><label style={labelStyle}>처분 종류</label>
            <select style={inputStyle} value={detail.disposalType ?? ""} onChange={(e) => update("disposalType", e.target.value || null)}>
              <option value="">(선택)</option>
              <option value="승인">승인</option>
              <option value="부지급">부지급</option>
              <option value="반려">반려</option>
              <option value="진행중">진행중</option>
            </select></div>
          <div style={fieldStyle}><label style={labelStyle}>처분일자</label>
            <input style={inputStyle} type="date" value={detail.disposalDate ?? ""} onChange={(e) => update("disposalDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>장해급여 청구일</label>
            <input style={inputStyle} type="date" value={detail.disabilityClaimDate ?? ""} onChange={(e) => update("disabilityClaimDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>장해 처분 종류</label>
            <input style={inputStyle} value={detail.disabilityDispositionType ?? ""} onChange={(e) => update("disabilityDispositionType", e.target.value || null)} placeholder="ex: 일시금/연금/부지급" /></div>
          <div style={fieldStyle}><label style={labelStyle}>장해등급 종류</label>
            <input style={inputStyle} value={detail.disabilityGradeType ?? ""} onChange={(e) => update("disabilityGradeType", e.target.value || null)} placeholder="ex: 11급" /></div>
          <div style={fieldStyle}><label style={labelStyle}>장해등급 (호)</label>
            <input style={inputStyle} value={detail.disabilityDispositionGrade ?? ""} onChange={(e) => update("disabilityDispositionGrade", e.target.value || null)} placeholder="ex: 11급05호" /></div>
          <div style={fieldStyle}><label style={labelStyle}>장해 처분일</label>
            <input style={inputStyle} type="date" value={detail.disabilityDispositionDate ?? ""} onChange={(e) => update("disabilityDispositionDate", e.target.value || null)} /></div>
          <div style={fieldStyle}><label style={labelStyle}>장해 통지일</label>
            <input style={inputStyle} type="date" value={detail.disabilityDispositionNoticeDate ?? ""} onChange={(e) => update("disabilityDispositionNoticeDate", e.target.value || null)} /></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "12px 24px", background: saving ? "#9ca3af" : "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "저장 중..." : "💾 저장"}
        </button>
        {savedAt && <span style={{ color: "#16a34a", fontSize: 13 }}>✅ 저장됨 ({savedAt})</span>}
        {error && <span style={{ color: "#dc2626", fontSize: 13 }}>❌ {error}</span>}
      </div>
    </div>
  );
}
