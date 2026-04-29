"use client";

import { useEffect, useState, use } from "react";

interface BereavedDetail {
  originCaseType: string | null;
  diseaseName: string | null;
  firstDiagnosisDate: string | null;
  lastWorkplace: string | null;
  disposalType: string | null;
  disposalDate: string | null;
  treatmentPeriod: string | null;
  holidayBenefitPeriod: string | null;
  paymentStatus: string | null;
  memo: string | null;
}

const EMPTY: BereavedDetail = {
  originCaseType: null,
  diseaseName: null,
  firstDiagnosisDate: null,
  lastWorkplace: null,
  disposalType: null,
  disposalDate: null,
  treatmentPeriod: null,
  holidayBenefitPeriod: null,
  paymentStatus: null,
  memo: null,
};

export default function BereavedDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  const [detail, setDetail] = useState<BereavedDetail>(EMPTY);
  const [caseInfo, setCaseInfo] = useState<{ patientName?: string; caseType?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof BereavedDetail>(key: K, value: string) {
    setDetail((prev) => ({ ...prev, [key]: value || null }));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // BereavedDetail 조회
        const res = await fetch(`/api/cases/${caseId}/bereaved`);
        if (res.ok) {
          const data = await res.json();
          if (data.detail) {
            const d = data.detail;
            setDetail({
              originCaseType: d.originCaseType ?? null,
              diseaseName: d.diseaseName ?? null,
              firstDiagnosisDate: d.firstDiagnosisDate ? d.firstDiagnosisDate.slice(0, 10) : null,
              lastWorkplace: d.lastWorkplace ?? null,
              disposalType: d.disposalType ?? null,
              disposalDate: d.disposalDate ? d.disposalDate.slice(0, 10) : null,
              treatmentPeriod: d.treatmentPeriod ?? null,
              holidayBenefitPeriod: d.holidayBenefitPeriod ?? null,
              paymentStatus: d.paymentStatus ?? null,
              memo: d.memo ?? null,
            });
          }
        }
        // Case 기본 정보 (있으면)
        const caseRes = await fetch(`/api/cases/${caseId}`);
        if (caseRes.ok) {
          const caseData = await caseRes.json();
          setCaseInfo({
            patientName: caseData.patient?.name,
            caseType: caseData.caseType,
          });
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
      const res = await fetch(`/api/cases/${caseId}/bereaved`, {
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

  // 스타일
  const containerStyle: React.CSSProperties = { maxWidth: 880, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" };
  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, color: "#374151", fontWeight: 500, marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
  const fieldStyle: React.CSSProperties = { marginBottom: 12 };
  const gridTwo: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };

  if (loading) {
    return <div style={containerStyle}>로딩 중...</div>;
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>👨‍👩‍👧 유족급여 사건 상세</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Case ID: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{caseId}</code>
        {caseInfo?.patientName && (<> / 재해자: <strong>{caseInfo.patientName}</strong></>)}
        {caseInfo?.caseType && (<> / 사건유형: <strong>{caseInfo.caseType}</strong></>)}
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>원래 사건 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>원 사건유형</label>
            <select
              style={inputStyle}
              value={detail.originCaseType ?? ""}
              onChange={(e) => update("originCaseType", e.target.value)}
            >
              <option value="">(선택)</option>
              <option value="HEARING_LOSS">소음성 난청</option>
              <option value="COPD">COPD</option>
              <option value="PNEUMOCONIOSIS">진폐</option>
              <option value="LUNG_CANCER">폐암</option>
              <option value="MUSCULOSKELETAL">근골격계</option>
              <option value="ACCIDENT">업무상 사고</option>
              <option value="OTHER">기타</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>상병명</label>
            <input style={inputStyle} value={detail.diseaseName ?? ""} onChange={(e) => update("diseaseName", e.target.value)} placeholder="ex: 만성폐쇄성폐질환, 폐암 등" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>최초 진단일</label>
            <input style={inputStyle} type="date" value={detail.firstDiagnosisDate ?? ""} onChange={(e) => update("firstDiagnosisDate", e.target.value)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>최종 사업장</label>
            <input style={inputStyle} value={detail.lastWorkplace ?? ""} onChange={(e) => update("lastWorkplace", e.target.value)} />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>처분 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>처분 종류</label>
            <select
              style={inputStyle}
              value={detail.disposalType ?? ""}
              onChange={(e) => update("disposalType", e.target.value)}
            >
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
            <input style={inputStyle} type="date" value={detail.disposalDate ?? ""} onChange={(e) => update("disposalDate", e.target.value)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>치료 기간</label>
            <input style={inputStyle} value={detail.treatmentPeriod ?? ""} onChange={(e) => update("treatmentPeriod", e.target.value)} placeholder="ex: 2020.01 ~ 2024.06" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>휴업급여 기간</label>
            <input style={inputStyle} value={detail.holidayBenefitPeriod ?? ""} onChange={(e) => update("holidayBenefitPeriod", e.target.value)} placeholder="ex: 2020.01 ~ 2024.06" />
          </div>
          <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
            <label style={labelStyle}>지급 상태</label>
            <input style={inputStyle} value={detail.paymentStatus ?? ""} onChange={(e) => update("paymentStatus", e.target.value)} placeholder="ex: 일시금 수령 / 연금 진행 중 / 미지급" />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>메모</h2>
        <textarea
          style={{ ...inputStyle, height: 120, fontFamily: "inherit", resize: "vertical" }}
          value={detail.memo ?? ""}
          onChange={(e) => update("memo", e.target.value)}
          placeholder="유족 정보, 사망 원인, 가족관계 증명 등 메모"
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "12px 24px",
            background: saving ? "#9ca3af" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "저장 중..." : "💾 저장"}
        </button>
        <a
          href={`/forms?type=BEREAVED_CLAIM&caseId=${caseId}`}
          style={{
            padding: "12px 24px",
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          📄 유족급여 청구서 PDF
        </a>
        {savedAt && (
          <span style={{ color: "#16a34a", fontSize: 13 }}>
            ✅ 저장됨 ({savedAt})
          </span>
        )}
        {error && (
          <span style={{ color: "#dc2626", fontSize: 13 }}>
            ❌ {error}
          </span>
        )}
      </div>
    </div>
  );
}
