"use client";

import { useState } from "react";

/** 추가상병 신청서 폼 */
export default function AdditionalInjuryFormPage() {
  const [data, setData] = useState({
    claimantName: "",
    claimantRRN: "",
    claimantAddr: "",
    claimantPhone: "",
    managementNo: "",
    originalDiagnosis: "",
    additionalDiagnosis: "",
    diagnosisDate: "",
    diagnosisHospital: "",
    reasonText: "",
    agentName: "이정준",
    agentLicenseNo: "",
  });
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends keyof typeof data>(key: K, value: typeof data[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => ({ ...prev, [key as string]: "" }));
    }
  }

  async function generate() {
    const newErrors: Record<string, string> = {};
    if (!data.claimantName.trim()) newErrors.claimantName = "필수 입력 항목입니다.";
    if (!data.additionalDiagnosis.trim()) newErrors.additionalDiagnosis = "필수 입력 항목입니다.";
    if (!data.reasonText.trim()) newErrors.reasonText = "필수 입력 항목입니다.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/forms/text-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "ADDITIONAL_INJURY_CLAIM", data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`PDF 생성 실패: ${err.error ?? res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `추가상병신청서_${data.claimantName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`PDF 생성 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  }

  const containerStyle: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" };
  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, color: "#374151", fontWeight: 500, marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
  const fieldStyle: React.CSSProperties = { marginBottom: 12 };
  const requiredMark: React.CSSProperties = { color: "#dc2626", marginLeft: 2 };
  const errStyle: React.CSSProperties = { fontSize: 12, color: "#dc2626", marginTop: 4 };
  const errorInputStyle: React.CSSProperties = { ...inputStyle, borderColor: "#dc2626" };

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>➕ 추가상병 신청서 작성</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        기존 인정 산재에 추가 상병이 발생한 경우 신청.
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>신청인 정보</h2>
        <div style={fieldStyle}>
          <label style={labelStyle}>성명<span style={requiredMark}>*</span></label>
          <input
            style={errors.claimantName ? errorInputStyle : inputStyle}
            value={data.claimantName}
            onChange={(e) => update("claimantName", e.target.value)}
          />
          {errors.claimantName && <div style={errStyle}>{errors.claimantName}</div>}
        </div>
        <div style={fieldStyle}><label style={labelStyle}>주민번호</label>
          <input style={inputStyle} value={data.claimantRRN} onChange={(e) => update("claimantRRN", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>주소</label>
          <input style={inputStyle} value={data.claimantAddr} onChange={(e) => update("claimantAddr", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>연락처</label>
          <input style={inputStyle} value={data.claimantPhone} onChange={(e) => update("claimantPhone", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>관리번호</label>
          <input style={inputStyle} value={data.managementNo} onChange={(e) => update("managementNo", e.target.value)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>상병 정보</h2>
        <div style={fieldStyle}><label style={labelStyle}>기존 인정 상병</label>
          <input style={inputStyle} value={data.originalDiagnosis} onChange={(e) => update("originalDiagnosis", e.target.value)} placeholder="예: 양측 감각신경성 난청" /></div>
        <div style={fieldStyle}>
          <label style={labelStyle}>추가 상병명<span style={requiredMark}>*</span></label>
          <input
            style={errors.additionalDiagnosis ? errorInputStyle : inputStyle}
            value={data.additionalDiagnosis}
            onChange={(e) => update("additionalDiagnosis", e.target.value)}
            placeholder="예: 이명 / 청각장애 등"
          />
          {errors.additionalDiagnosis && <div style={errStyle}>{errors.additionalDiagnosis}</div>}
        </div>
        <div style={fieldStyle}><label style={labelStyle}>진단일</label>
          <input style={inputStyle} type="date" value={data.diagnosisDate} onChange={(e) => update("diagnosisDate", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>진단 의료기관</label>
          <input style={inputStyle} value={data.diagnosisHospital} onChange={(e) => update("diagnosisHospital", e.target.value)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          신청 사유<span style={requiredMark}>*</span>
        </h2>
        <textarea
          style={{
            ...(errors.reasonText ? errorInputStyle : inputStyle),
            height: 200,
            fontFamily: "inherit",
            resize: "vertical",
          }}
          value={data.reasonText}
          onChange={(e) => update("reasonText", e.target.value)}
          placeholder="단락 구분: 빈 줄(엔터 2번)"
        />
        {errors.reasonText && <div style={errStyle}>{errors.reasonText}</div>}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>대리인 정보</h2>
        <div style={fieldStyle}><label style={labelStyle}>대리인 성명</label>
          <input style={inputStyle} value={data.agentName} onChange={(e) => update("agentName", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>공인노무사 자격번호</label>
          <input style={inputStyle} value={data.agentLicenseNo} onChange={(e) => update("agentLicenseNo", e.target.value)} /></div>
      </div>

      <button onClick={generate} disabled={generating}
        style={{ width: "100%", padding: "12px", background: generating ? "#9ca3af" : "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer" }}>
        {generating ? "PDF 생성 중..." : "📄 추가상병 신청서 PDF 다운로드"}
      </button>
    </div>
  );
}
