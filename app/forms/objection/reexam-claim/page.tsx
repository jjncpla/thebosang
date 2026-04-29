"use client";

import { useState } from "react";

/** 재심사청구서 입력 폼 */
export default function ReExamClaimFormPage() {
  const [data, setData] = useState({
    claimantName: "",
    claimantRRN: "",
    claimantAddr: "",
    claimantPhone: "",
    decisionAgency: "근로복지공단 ",
    decisionDate: "",
    decisionContent: "",
    examDecisionDate: "",
    examDecisionContent: "",
    examCaseNo: "",
    managementNo: "",
    diagnosisName: "",
    purpose: "",
    reasonText: "",
    agentName: "이정준",
    agentLicenseNo: "",
    attachments: "",
  });
  const [generating, setGenerating] = useState(false);

  function update<K extends keyof typeof data>(key: K, value: typeof data[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (!data.claimantName || !data.reasonText) {
      alert("청구인 성명, 청구 이유는 필수 입력입니다.");
      return;
    }
    setGenerating(true);
    try {
      const attachments = data.attachments
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/forms/text-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: "REEXAM_CLAIM",
          data: { ...data, attachments },
        }),
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
      a.download = `재심사청구서_${data.claimantName}.pdf`;
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
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>⚖ 재심사청구서 작성</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        심사 결정에 대한 60일 내 재심사청구서. 산업재해보상보험재심사위원회 제출용.
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>청구인 정보</h2>
        <div style={fieldStyle}>
          <label style={labelStyle}>성명 *</label>
          <input style={inputStyle} value={data.claimantName} onChange={(e) => update("claimantName", e.target.value)} />
        </div>
        <div style={fieldStyle}><label style={labelStyle}>주민번호</label>
          <input style={inputStyle} value={data.claimantRRN} onChange={(e) => update("claimantRRN", e.target.value)} placeholder="ex: 800101-1******" /></div>
        <div style={fieldStyle}><label style={labelStyle}>주소</label>
          <input style={inputStyle} value={data.claimantAddr} onChange={(e) => update("claimantAddr", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>연락처</label>
          <input style={inputStyle} value={data.claimantPhone} onChange={(e) => update("claimantPhone", e.target.value)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>원처분 정보</h2>
        <div style={fieldStyle}><label style={labelStyle}>원처분청</label>
          <input style={inputStyle} value={data.decisionAgency} onChange={(e) => update("decisionAgency", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>원처분일자</label>
          <input style={inputStyle} type="date" value={data.decisionDate} onChange={(e) => update("decisionDate", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>원처분내용</label>
          <input style={inputStyle} value={data.decisionContent} onChange={(e) => update("decisionContent", e.target.value)} placeholder="ex: 장해급여 부지급 처분" /></div>
        <div style={fieldStyle}><label style={labelStyle}>상병명</label>
          <input style={inputStyle} value={data.diagnosisName} onChange={(e) => update("diagnosisName", e.target.value)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>심사 결정 정보</h2>
        <div style={fieldStyle}><label style={labelStyle}>심사 결정일</label>
          <input style={inputStyle} type="date" value={data.examDecisionDate} onChange={(e) => update("examDecisionDate", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>심사 결정내용</label>
          <input style={inputStyle} value={data.examDecisionContent} onChange={(e) => update("examDecisionContent", e.target.value)} placeholder="ex: 기각 / 각하" /></div>
        <div style={fieldStyle}><label style={labelStyle}>심사 사건번호</label>
          <input style={inputStyle} value={data.examCaseNo} onChange={(e) => update("examCaseNo", e.target.value)} placeholder="ex: 2025-심사-1234" /></div>
        <div style={fieldStyle}><label style={labelStyle}>관리번호</label>
          <input style={inputStyle} value={data.managementNo} onChange={(e) => update("managementNo", e.target.value)} /></div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>청구 내용</h2>
        <div style={fieldStyle}><label style={labelStyle}>청구 취지 (비우면 자동 생성)</label>
          <textarea style={{ ...inputStyle, height: 60, fontFamily: "inherit", resize: "vertical" }} value={data.purpose} onChange={(e) => update("purpose", e.target.value)} /></div>
        <div style={fieldStyle}><label style={labelStyle}>청구 이유 *</label>
          <textarea style={{ ...inputStyle, height: 200, fontFamily: "inherit", resize: "vertical" }} value={data.reasonText} onChange={(e) => update("reasonText", e.target.value)} placeholder="단락 구분: 빈 줄(엔터 2번)" /></div>
        <div style={fieldStyle}><label style={labelStyle}>첨부서류 (줄바꿈/콤마 구분)</label>
          <textarea style={{ ...inputStyle, height: 80, fontFamily: "inherit", resize: "vertical" }} value={data.attachments} onChange={(e) => update("attachments", e.target.value)} placeholder="ex: 심사결정서 사본, 처분통지서 사본 등" /></div>
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
        {generating ? "PDF 생성 중..." : "📄 재심사청구서 PDF 다운로드"}
      </button>
    </div>
  );
}
