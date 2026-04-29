"use client";

import { useState } from "react";

/** 재요양 신청서 폼 */
export default function RequoteFormPage() {
  const [data, setData] = useState({
    claimantName: "",
    claimantRRN: "",
    claimantAddr: "",
    claimantPhone: "",
    managementNo: "",
    originalDiagnosis: "",
    treatmentEndDate: "",
    reAggravationDate: "",
    diagnosisHospital: "",
    reasonText: "",
    agentName: "이정준",
    agentLicenseNo: "",
  });
  const [generating, setGenerating] = useState(false);

  function update<K extends keyof typeof data>(key: K, value: typeof data[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (!data.claimantName || !data.reasonText) {
      alert("청구인 성명, 신청 사유는 필수입니다.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/forms/text-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "REQUOTE_REQUEST", data }),
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
      a.download = `재요양신청서_${data.claimantName}.pdf`;
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

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🔄 재요양 신청서 작성</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        종전 요양 종료 후 증상이 재발/악화된 경우 신청.
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>신청인 정보</h2>
        <div style={fieldStyle}><label style={labelStyle}>성명 *</label>
          <input style={inputStyle} value={data.claimantName} onChange={(e) => update("claimantName", e.target.value)} /></div>
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
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>종전 요양 정보</h2>
        <div style={fieldStyle}><label style={labelStyle}>기존 인정 상병</label>
          <input style={inputStyle} value={data.originalDiagnosis} onChange={(e) => update("originalDiagnosis", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>요양 종료일</label>
          <input style={inputStyle} type="date" value={data.treatmentEndDate} onChange={(e) => update("treatmentEndDate", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>재발/악화일</label>
          <input style={inputStyle} type="date" value={data.reAggravationDate} onChange={(e) => update("reAggravationDate", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>진단 의료기관</label>
          <input style={inputStyle} value={data.diagnosisHospital} onChange={(e) => update("diagnosisHospital", e.target.value)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>재요양 신청 사유 *</h2>
        <textarea style={{ ...inputStyle, height: 200, fontFamily: "inherit", resize: "vertical" }} value={data.reasonText} onChange={(e) => update("reasonText", e.target.value)} placeholder="단락 구분: 빈 줄(엔터 2번)" />
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
        {generating ? "PDF 생성 중..." : "📄 재요양 신청서 PDF 다운로드"}
      </button>
    </div>
  );
}
