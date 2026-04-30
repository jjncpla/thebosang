"use client";

import { useEffect, useState, use } from "react";

interface ConcurrentDisease {
  name: string;
  grade?: string;
  memo?: string;
}

interface OccupationalCancerDetail {
  diseaseName: string | null;
  firstDiagnosisDate: string | null;
  lastWorkplace: string | null;
  disposalType: string | null;
  disposalDate: string | null;
  treatmentPeriod: string | null;
  holidayBenefitPeriod: string | null;
  paymentStatus: string | null;
  memo: string | null;
  // 신규 필드 (P5)
  cancerType: string | null;
  occupation: string | null;
  exposureSubstance: string | null;
  exposurePeriod: string | null;
  concurrentDiseases: ConcurrentDisease[] | null;
}

const EMPTY: OccupationalCancerDetail = {
  diseaseName: null,
  firstDiagnosisDate: null,
  lastWorkplace: null,
  disposalType: null,
  disposalDate: null,
  treatmentPeriod: null,
  holidayBenefitPeriod: null,
  paymentStatus: null,
  memo: null,
  cancerType: null,
  occupation: null,
  exposureSubstance: null,
  exposurePeriod: null,
  concurrentDiseases: null,
};

function dateOnly(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.slice(0, 10);
}

const CANCER_TYPES = ["폐암", "혈액암", "백혈병", "방광암", "대장암", "위암", "유방암", "신장암", "후두암", "비인두암", "악성중피종", "기타"];

export default function OccupationalCancerDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const [detail, setDetail] = useState<OccupationalCancerDetail>(EMPTY);
  const [caseInfo, setCaseInfo] = useState<{ patientName?: string; caseType?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof OccupationalCancerDetail>(key: K, value: OccupationalCancerDetail[K]) {
    setDetail((prev) => ({ ...prev, [key]: value }));
  }

  function addConcurrent() {
    const next = [...(detail.concurrentDiseases ?? []), { name: "", grade: "", memo: "" }];
    update("concurrentDiseases", next);
  }
  function updateConcurrent(idx: number, key: keyof ConcurrentDisease, value: string) {
    const next = [...(detail.concurrentDiseases ?? [])];
    next[idx] = { ...next[idx], [key]: value };
    update("concurrentDiseases", next);
  }
  function removeConcurrent(idx: number) {
    const next = (detail.concurrentDiseases ?? []).filter((_, i) => i !== idx);
    update("concurrentDiseases", next.length === 0 ? null : next);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/occupational-cancer`);
        if (res.ok) {
          const data = await res.json();
          if (data.detail) {
            const d = data.detail;
            setDetail({
              diseaseName: d.diseaseName ?? null,
              firstDiagnosisDate: dateOnly(d.firstDiagnosisDate),
              lastWorkplace: d.lastWorkplace ?? null,
              disposalType: d.disposalType ?? null,
              disposalDate: dateOnly(d.disposalDate),
              treatmentPeriod: d.treatmentPeriod ?? null,
              holidayBenefitPeriod: d.holidayBenefitPeriod ?? null,
              paymentStatus: d.paymentStatus ?? null,
              memo: d.memo ?? null,
              cancerType: d.cancerType ?? null,
              occupation: d.occupation ?? null,
              exposureSubstance: d.exposureSubstance ?? null,
              exposurePeriod: d.exposurePeriod ?? null,
              concurrentDiseases: Array.isArray(d.concurrentDiseases) ? d.concurrentDiseases : null,
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
      const res = await fetch(`/api/cases/${caseId}/occupational-cancer`, {
        method: "PATCH",
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

  if (loading) return <div style={containerStyle}>로딩 중...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🎗️ 직업성암 사건 상세</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Case ID: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{caseId}</code>
        {caseInfo?.patientName && (<> / 재해자: <strong>{caseInfo.patientName}</strong></>)}
        {caseInfo?.caseType && (<> / 사건유형: <strong>{caseInfo.caseType}</strong></>)}
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>암종 / 진단 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>암종</label>
            <select style={inputStyle} value={detail.cancerType ?? ""} onChange={(e) => update("cancerType", e.target.value || null)}>
              <option value="">(선택)</option>
              {CANCER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>상병명 (구체)</label>
            <input style={inputStyle} value={detail.diseaseName ?? ""} onChange={(e) => update("diseaseName", e.target.value || null)} placeholder="ex: 폐선암(원발성), 급성골수성백혈병" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>최초 진단일</label>
            <input style={inputStyle} type="date" value={detail.firstDiagnosisDate ?? ""} onChange={(e) => update("firstDiagnosisDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>최종 사업장</label>
            <input style={inputStyle} value={detail.lastWorkplace ?? ""} onChange={(e) => update("lastWorkplace", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>직종</label>
            <input style={inputStyle} value={detail.occupation ?? ""} onChange={(e) => update("occupation", e.target.value || null)} placeholder="ex: 용접공, 도장공" />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>발암물질 노출</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>노출 물질</label>
            <input style={inputStyle} value={detail.exposureSubstance ?? ""} onChange={(e) => update("exposureSubstance", e.target.value || null)} placeholder="ex: 석면, 벤젠, 라돈, 금속분진" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>노출 기간</label>
            <input style={inputStyle} value={detail.exposurePeriod ?? ""} onChange={(e) => update("exposurePeriod", e.target.value || null)} placeholder="ex: 1980 ~ 2010 (30년)" />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>처분 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>처분 종류</label>
            <select style={inputStyle} value={detail.disposalType ?? ""} onChange={(e) => update("disposalType", e.target.value || null)}>
              <option value="">(선택)</option>
              <option value="승인">승인</option>
              <option value="부지급">부지급</option>
              <option value="일부지급">일부지급</option>
              <option value="반려">반려</option>
              <option value="진행중">진행중</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>처분일자</label>
            <input style={inputStyle} type="date" value={detail.disposalDate ?? ""} onChange={(e) => update("disposalDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>치료 기간</label>
            <input style={inputStyle} value={detail.treatmentPeriod ?? ""} onChange={(e) => update("treatmentPeriod", e.target.value || null)} placeholder="ex: 2020.01 ~ 2024.06" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>휴업급여 기간</label>
            <input style={inputStyle} value={detail.holidayBenefitPeriod ?? ""} onChange={(e) => update("holidayBenefitPeriod", e.target.value || null)} placeholder="ex: 2020.01 ~ 2024.06" />
          </div>
          <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>지급 상태</label>
            <input style={inputStyle} value={detail.paymentStatus ?? ""} onChange={(e) => update("paymentStatus", e.target.value || null)} placeholder="ex: 일시금 수령 / 연금 진행 중" />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>동반 상병 (예: 폐암 + COPD + 난청)</h2>
          <button
            onClick={addConcurrent}
            style={{ padding: "6px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
          >
            + 추가
          </button>
        </div>
        {(detail.concurrentDiseases ?? []).length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>동반 상병이 없습니다.</p>
        ) : (
          (detail.concurrentDiseases ?? []).map((row, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr 60px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input style={inputStyle} value={row.name ?? ""} onChange={(e) => updateConcurrent(idx, "name", e.target.value)} placeholder="상병명 (예: COPD, 난청)" />
              <input style={inputStyle} value={row.grade ?? ""} onChange={(e) => updateConcurrent(idx, "grade", e.target.value)} placeholder="등급" />
              <input style={inputStyle} value={row.memo ?? ""} onChange={(e) => updateConcurrent(idx, "memo", e.target.value)} placeholder="메모" />
              <button
                onClick={() => removeConcurrent(idx)}
                style={{ padding: "8px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>메모</h2>
        <textarea
          style={{ ...inputStyle, height: 120, fontFamily: "inherit", resize: "vertical" }}
          value={detail.memo ?? ""}
          onChange={(e) => update("memo", e.target.value || null)}
          placeholder="작업환경/노출증명/안전보건자료 보유 여부 등 메모"
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "12px 24px", background: saving ? "#9ca3af" : "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "저장 중..." : "💾 저장"}
        </button>
        {savedAt && <span style={{ color: "#16a34a", fontSize: 13 }}>✅ 저장됨 ({savedAt})</span>}
        {error && <span style={{ color: "#dc2626", fontSize: 13 }}>❌ {error}</span>}
      </div>
    </div>
  );
}
