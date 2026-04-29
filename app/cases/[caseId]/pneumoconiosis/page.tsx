"use client";

import { useEffect, useState, use } from "react";

interface PneumoconiosisDetail {
  firstClinic: string | null;
  firstExamDate: string | null;
  applicableLaw: string | null;
  isRetired: string | null;
  isNoticeReceived: boolean;
  precisionExamDate: string | null;
  precisionResult: string | null;
  precisionHospital: string | null;
  precisionPossibleDate: string | null;
  reExamPossibleDate: string | null;
  disposalType: string | null;
  disposalDate: string | null;
}

const EMPTY: PneumoconiosisDetail = {
  firstClinic: null,
  firstExamDate: null,
  applicableLaw: null,
  isRetired: null,
  isNoticeReceived: false,
  precisionExamDate: null,
  precisionResult: null,
  precisionHospital: null,
  precisionPossibleDate: null,
  reExamPossibleDate: null,
  disposalType: null,
  disposalDate: null,
};

function dateOnly(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.slice(0, 10);
}

export default function PneumoconiosisDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const [detail, setDetail] = useState<PneumoconiosisDetail>(EMPTY);
  const [caseInfo, setCaseInfo] = useState<{ patientName?: string; caseType?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof PneumoconiosisDetail>(key: K, value: PneumoconiosisDetail[K]) {
    setDetail((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/pneumoconiosis`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === "object" && data.id) {
            setDetail({
              firstClinic: data.firstClinic ?? null,
              firstExamDate: dateOnly(data.firstExamDate),
              applicableLaw: data.applicableLaw ?? null,
              isRetired: data.isRetired ?? null,
              isNoticeReceived: !!data.isNoticeReceived,
              precisionExamDate: dateOnly(data.precisionExamDate),
              precisionResult: data.precisionResult ?? null,
              precisionHospital: data.precisionHospital ?? null,
              precisionPossibleDate: dateOnly(data.precisionPossibleDate),
              reExamPossibleDate: dateOnly(data.reExamPossibleDate),
              disposalType: data.disposalType ?? null,
              disposalDate: dateOnly(data.disposalDate),
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
      const res = await fetch(`/api/cases/${caseId}/pneumoconiosis`, {
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

  if (loading) return <div style={containerStyle}>로딩 중...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🫁 진폐 사건 상세</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Case ID: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{caseId}</code>
        {caseInfo?.patientName && (<> / 재해자: <strong>{caseInfo.patientName}</strong></>)}
        {caseInfo?.caseType && (<> / 사건유형: <strong>{caseInfo.caseType}</strong></>)}
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>초진 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>초진 의료기관</label>
            <input style={inputStyle} value={detail.firstClinic ?? ""} onChange={(e) => update("firstClinic", e.target.value || null)} placeholder="ex: 강원대병원" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>초진일</label>
            <input style={inputStyle} type="date" value={detail.firstExamDate ?? ""} onChange={(e) => update("firstExamDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>적용 법령</label>
            <select style={inputStyle} value={detail.applicableLaw ?? ""} onChange={(e) => update("applicableLaw", e.target.value || null)}>
              <option value="">(선택)</option>
              <option value="진폐근로자보호법">진폐근로자보호법</option>
              <option value="산업재해보상보험법">산업재해보상보험법</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>퇴직 여부</label>
            <select style={inputStyle} value={detail.isRetired ?? ""} onChange={(e) => update("isRetired", e.target.value || null)}>
              <option value="">(선택)</option>
              <option value="재직">재직</option>
              <option value="퇴직">퇴직</option>
            </select>
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14 }}>
          <input type="checkbox" checked={detail.isNoticeReceived} onChange={(e) => update("isNoticeReceived", e.target.checked)} />
          정밀진단 통지서 수령 여부
        </label>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>정밀진단 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>정밀진단 실시일</label>
            <input style={inputStyle} type="date" value={detail.precisionExamDate ?? ""} onChange={(e) => update("precisionExamDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>정밀진단 의료기관</label>
            <input style={inputStyle} value={detail.precisionHospital ?? ""} onChange={(e) => update("precisionHospital", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>정밀진단 결과</label>
            <select style={inputStyle} value={detail.precisionResult ?? ""} onChange={(e) => update("precisionResult", e.target.value || null)}>
              <option value="">(선택)</option>
              <option value="정상">정상</option>
              <option value="1형">1형</option>
              <option value="2형">2형</option>
              <option value="3형">3형</option>
              <option value="4형">4형</option>
              <option value="합병증">합병증 (PCT)</option>
              <option value="진폐결핵">진폐결핵 (PTB)</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>정밀진단 가능일</label>
            <input style={inputStyle} type="date" value={detail.precisionPossibleDate ?? ""} onChange={(e) => update("precisionPossibleDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>재진단 가능일</label>
            <input style={inputStyle} type="date" value={detail.reExamPossibleDate ?? ""} onChange={(e) => update("reExamPossibleDate", e.target.value || null)} />
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
              <option value="진폐장해등급결정">진폐장해등급결정</option>
              <option value="반려">반려</option>
              <option value="진행중">진행중</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>처분일자</label>
            <input style={inputStyle} type="date" value={detail.disposalDate ?? ""} onChange={(e) => update("disposalDate", e.target.value || null)} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "12px 24px", background: saving ? "#9ca3af" : "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "저장 중..." : "💾 저장"}
        </button>
        <a href={`/forms?type=DUST_WORK_CONFIRM&caseId=${caseId}`}
          style={{ padding: "12px 24px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
          📄 분진작업종사확인서 PDF
        </a>
        {savedAt && <span style={{ color: "#16a34a", fontSize: 13 }}>✅ 저장됨 ({savedAt})</span>}
        {error && <span style={{ color: "#dc2626", fontSize: 13 }}>❌ {error}</span>}
      </div>
    </div>
  );
}
