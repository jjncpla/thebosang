"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { CASE_TYPE_LABELS, DISPOSAL_TYPE, GRADE_TYPE, STATUS_BY_CASE_TYPE } from "@/lib/constants/case";
import { OCC_DISEASE_COMMITTEES } from "@/constants/occDiseaseCommittees";

const S = { fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" };

type Patient = { id: string; name: string; ssn: string; phone: string | null; address: string | null };
type HearingLoss = Record<string, string | number | null>;
type DetailStatus = { status: string } | null;
type CaseData = {
  id: string;
  patientId: string;
  patient: Patient;
  caseType: string;
  caseNumber: string | null;
  tfName: string | null;
  branch: string | null;
  subAgent: string | null;
  branchManager: string | null;
  salesManager: string | null;
  caseManager: string | null;
  salesRoute: string | null;
  contractDate: string | null;
  receptionDate: string | null;
  isOneStop: boolean;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  hearingLoss: HearingLoss | null;
  copd: DetailStatus;
  pneumoconiosis: DetailStatus;
  musculoskeletal: DetailStatus;
  occupationalAccident: DetailStatus;
  occupationalCancer: DetailStatus;
  bereaved: DetailStatus;
};

function getCaseStatus(c: CaseData): string {
  if (c.caseType === "HEARING_LOSS") return String(c.hearingLoss?.status ?? "접수대기");
  if (c.caseType === "COPD") return c.copd?.status ?? "접수대기";
  if (c.caseType === "PNEUMOCONIOSIS") return c.pneumoconiosis?.status ?? "접수대기";
  if (c.caseType === "MUSCULOSKELETAL") return c.musculoskeletal?.status ?? "접수대기";
  if (c.caseType === "OCCUPATIONAL_ACCIDENT") return c.occupationalAccident?.status ?? "접수대기";
  if (c.caseType === "OCCUPATIONAL_CANCER") return c.occupationalCancer?.status ?? "접수대기";
  if (c.caseType === "BEREAVED") return c.bereaved?.status ?? "접수대기";
  return "접수대기";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  "접수대기": { bg: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca", dot: "#818cf8" },
  "접수완료": { bg: "#082f49", color: "#7dd3fc", border: "1px solid #0369a1", dot: "#38bdf8" },
  "특진예정": { bg: "#1a2e05", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "특진중":   { bg: "#052e16", color: "#6ee7b7", border: "1px solid #059669", dot: "#34d399" },
  "특진완료": { bg: "#052e16", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "재특진예정":{ bg: "#1e1b4b", color: "#c4b5fd", border: "1px solid #7c3aed", dot: "#a78bfa" },
  "재특진중":  { bg: "#2e1065", color: "#d8b4fe", border: "1px solid #9333ea", dot: "#c084fc" },
  "재특진완료":{ bg: "#2e1065", color: "#e9d5ff", border: "1px solid #7e22ce", dot: "#d8b4fe" },
  "재재특진예정":{ bg: "#3b1764", color: "#f0abfc", border: "1px solid #a21caf", dot: "#e879f9" },
  "재재특진중":  { bg: "#4a1942", color: "#f9a8d4", border: "1px solid #be185d", dot: "#f472b6" },
  "재재특진완료":{ bg: "#4a1942", color: "#fda4af", border: "1px solid #9f1239", dot: "#fb7185" },
  "전문예정": { bg: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dot: "#fbbf24" },
  "전문완료": { bg: "#451a03", color: "#fde68a", border: "1px solid #d97706", dot: "#fcd34d" },
  "승인":     { bg: "#052e16", color: "#86efac", border: "1px solid #16a34a", dot: "#4ade80" },
  "불승인":   { bg: "#450a0a", color: "#fca5a5", border: "1px solid #b91c1c", dot: "#f87171" },
  "반려":     { bg: "#450a0a", color: "#fca5a5", border: "1px solid #dc2626", dot: "#f87171" },
  "보류":     { bg: "#1c1917", color: "#d6d3d1", border: "1px solid #78716c", dot: "#a8a29e" },
  "파기":     { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOR[status] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {status}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#374151", outline: "none", background: "white", width: "100%", boxSizing: "border-box",
};

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>{title}</span>
      </div>
      <dl style={{ margin: 0 }}>{children}</dl>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #f9fafb", padding: "10px 16px", gap: 12 }}>
      <dt style={{ fontSize: 12, color: "#9ca3af", width: 90, flexShrink: 0 }}>{label}</dt>
      <dd style={{ fontSize: 13, color: "#111827", margin: 0, fontWeight: 500 }}>{children}</dd>
    </div>
  );
}

/* ── 공통: 섹션 아코디언 스타일 ── */
const secWrap: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 10, overflow: "hidden" };

function AccordionHeader({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: open ? "#eff6ff" : "#f9fafb", border: "none", borderBottom: open ? "1px solid #bfdbfe" : "none", cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: open ? "#1d4ed8" : "#374151" }}>{label}</span>
      <span style={{ fontSize: 12, color: open ? "#1d4ed8" : "#6b7280" }}>{open ? "▲" : "▼"}</span>
    </button>
  );
}

function DisabledSection({ label }: { label: string }) {
  return (
    <div style={{ ...secWrap, pointerEvents: "none", opacity: 0.4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f9fafb" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>▼</span>
      </div>
    </div>
  );
}

/* ── 난청 상세 탭 ── */
function HearingLossTab({ caseId, initial }: { caseId: string; initial: HearingLoss | null }) {
  const [form, setForm] = useState<HearingLoss>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sec1Open, setSec1Open] = useState(true);
  const [sec3Open, setSec3Open] = useState(false);

  const f = (key: string) => String(form[key] ?? "");
  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/hearing-loss`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaveMsg("저장되었습니다");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg("오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>{children}</div>
  );

  const Row = ({ label, fieldKey, type = "text" }: { label: string; fieldKey: string; type?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</label>
      <input type={type} style={inputStyle} value={f(fieldKey)} onChange={(e) => set(fieldKey, e.target.value)} />
    </div>
  );

  const SaveBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
      <button onClick={save} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "저장중..." : "저장"}
      </button>
      {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes("오류") ? "#dc2626" : "#16a34a" }}>{saveMsg}</span>}
    </div>
  );

  const disposalType = f("disposalType");

  return (
    <div>
      {/* (1) 사건초기 */}
      <div style={secWrap}>
        <AccordionHeader open={sec1Open} onToggle={() => setSec1Open((o) => !o)} label="(1) 사건초기" />
        {sec1Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>초진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="초진 병원" fieldKey="firstClinic" />
              <Row label="초진 날짜" fieldKey="firstExamDate" type="date" />
              <div />
              <Row label="우측 청력 (dB)" fieldKey="firstExamRight" type="number" />
              <Row label="좌측 청력 (dB)" fieldKey="firstExamLeft" type="number" />
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (2) 요양 — 비활성 */}
      <DisabledSection label="(2) 요양" />

      {/* (3) 장해 */}
      <div style={secWrap}>
        <AccordionHeader open={sec3Open} onToggle={() => setSec3Open((o) => !o)} label="(3) 장해" />
        {sec3Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>최초 특진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="병원" fieldKey="specialClinic" />
              <Row label="사전 예약일" fieldKey="preExamDate" type="date" />
              <div />
              <Row label="1차 검사일" fieldKey="exam1Date" type="date" />
              <Row label="2차 검사일" fieldKey="exam2Date" type="date" />
              <Row label="3차 검사일" fieldKey="exam3Date" type="date" />
              <Row label="기도 우측 (dB)" fieldKey="airRight1" type="number" />
              <Row label="기도 좌측 (dB)" fieldKey="airLeft1" type="number" />
              <div />
              <Row label="골도 우측 (dB)" fieldKey="boneRight1" type="number" />
              <Row label="골도 좌측 (dB)" fieldKey="boneLeft1" type="number" />
              <div />
              <Row label="어음명료도 (%)" fieldKey="speechScore1" type="number" />
              <Row label="ABR 우측" fieldKey="abrRight1" type="number" />
              <Row label="ABR 좌측" fieldKey="abrLeft1" type="number" />
              <Row label="임피던스 우측" fieldKey="impedanceRight1" />
              <Row label="임피던스 좌측" fieldKey="impedanceLeft1" />
            </div>

            <SectionTitle>재특진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="병원" fieldKey="reExamClinic" />
              <Row label="1차 검사일" fieldKey="reExam1Date" type="date" />
              <Row label="2차 검사일" fieldKey="reExam2Date" type="date" />
              <Row label="3차 검사일" fieldKey="reExam3Date" type="date" />
              <Row label="기도 우측 (dB)" fieldKey="airRight2" type="number" />
              <Row label="기도 좌측 (dB)" fieldKey="airLeft2" type="number" />
              <div />
              <Row label="골도 우측 (dB)" fieldKey="boneRight2" type="number" />
              <Row label="골도 좌측 (dB)" fieldKey="boneLeft2" type="number" />
              <div />
              <Row label="어음명료도 (%)" fieldKey="speechScore2" type="number" />
              <Row label="ABR 우측" fieldKey="abrRight2" type="number" />
              <Row label="ABR 좌측" fieldKey="abrLeft2" type="number" />
              <Row label="임피던스 우측" fieldKey="impedanceRight2" />
              <Row label="임피던스 좌측" fieldKey="impedanceLeft2" />
            </div>

            <SectionTitle>재재특진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="병원" fieldKey="reReExamClinic" />
              <Row label="1차 검사일" fieldKey="reReExam1Date" type="date" />
              <Row label="2차 검사일" fieldKey="reReExam2Date" type="date" />
              <Row label="3차 검사일" fieldKey="reReExam3Date" type="date" />
              <Row label="기도 우측 (dB)" fieldKey="airRight3" type="number" />
              <Row label="기도 좌측 (dB)" fieldKey="airLeft3" type="number" />
              <div />
              <Row label="골도 우측 (dB)" fieldKey="boneRight3" type="number" />
              <Row label="골도 좌측 (dB)" fieldKey="boneLeft3" type="number" />
              <div />
              <Row label="어음명료도 (%)" fieldKey="speechScore3" type="number" />
              <Row label="ABR 우측" fieldKey="abrRight3" type="number" />
              <Row label="ABR 좌측" fieldKey="abrLeft3" type="number" />
              <Row label="임피던스 우측" fieldKey="impedanceRight3" />
              <Row label="임피던스 좌측" fieldKey="impedanceLeft3" />
            </div>

            <SectionTitle>전문조사</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="전문기관" fieldKey="expertOrg" />
              <Row label="조사일" fieldKey="expertDate" type="date" />
            </div>

            <SectionTitle>처분</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>처분 결과</label>
                <select style={inputStyle} value={f("disposalType")} onChange={(e) => set("disposalType", e.target.value)}>
                  <option value="">선택</option>
                  {DISPOSAL_TYPE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Row label="처분 결정일" fieldKey="disposalDecidedAt" type="date" />
              <Row label="처분 수령일" fieldKey="disposalReceivedAt" type="date" />
              {disposalType === "승인" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>등급 구분</label>
                    <select style={inputStyle} value={f("gradeType")} onChange={(e) => set("gradeType", e.target.value)}>
                      <option value="">선택</option>
                      {GRADE_TYPE.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <Row label="등급" fieldKey="grade" type="number" />
                </>
              )}
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (4) 유족 — 비활성 */}
      <DisabledSection label="(4) 유족" />
    </div>
  );
}

/* ── COPD 상세 탭 ── */
type CopdForm = Record<string, string | number | null>;

function CopdTab({ caseId }: { caseId: string }) {
  const [form, setForm] = useState<CopdForm>({});
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sec1Open, setSec1Open] = useState(true);
  const [sec2Open, setSec2Open] = useState(false);
  const [sec3Open, setSec3Open] = useState(false);
  const [sec4Open, setSec4Open] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/copd`)
      .then((r) => r.json())
      .then((data) => { setForm(data ?? {}); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [caseId]);

  const f = (key: string) => String(form[key] ?? "");
  const set = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/copd`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaveMsg("저장되었습니다");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg("오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>{children}</div>
  );

  const Row = ({ label, fieldKey, type = "text" }: { label: string; fieldKey: string; type?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</label>
      <input type={type} style={inputStyle} value={f(fieldKey)} onChange={(e) => set(fieldKey, e.target.value)} />
    </div>
  );

  const SaveBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
      <button onClick={save} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "저장중..." : "저장"}
      </button>
      {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes("오류") ? "#dc2626" : "#16a34a" }}>{saveMsg}</span>}
    </div>
  );

  if (loadingData) return <div style={{ padding: 24, color: "#9ca3af", fontSize: 13 }}>로딩중...</div>;

  const dispType = f("disabilityDispositionType");

  return (
    <div>
      {/* (1) 사건초기 */}
      <div style={secWrap}>
        <AccordionHeader open={sec1Open} onToggle={() => setSec1Open((o) => !o)} label="(1) 사건초기" />
        {sec1Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>초진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="초진 병원" fieldKey="firstClinic" />
              <Row label="초진 날짜" fieldKey="firstExamDate" type="date" />
              <div />
              <Row label="1초율 (%)" fieldKey="fev1Rate" type="number" />
              <Row label="1초량 (L)" fieldKey="fev1Volume" type="number" />
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (2) 요양 */}
      <div style={secWrap}>
        <AccordionHeader open={sec2Open} onToggle={() => setSec2Open((o) => !o)} label="(2) 요양" />
        {sec2Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>특진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="특진 병원" fieldKey="specialClinic" />
              <Row label="1차특진일" fieldKey="exam1Date" type="date" />
              <div />
              <Row label="1차 1초율 (%)" fieldKey="exam1Rate" type="number" />
              <Row label="1차 1초량 (L)" fieldKey="exam1Volume" type="number" />
              <div />
              <Row label="2차특진일" fieldKey="exam2Date" type="date" />
              <Row label="2차 1초율 (%)" fieldKey="exam2Rate" type="number" />
              <Row label="2차 1초량 (L)" fieldKey="exam2Volume" type="number" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>특이사항 메모</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", marginTop: 3 }} value={f("examMemo")} onChange={(e) => set("examMemo", e.target.value)} />
            </div>

            <SectionTitle>업무상질병판정</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>관할 업무상질병판정위원회</label>
                <select style={inputStyle} value={f("occDiseaseCommittee")} onChange={(e) => set("occDiseaseCommittee", e.target.value)}>
                  <option value="">선택</option>
                  {OCC_DISEASE_COMMITTEES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Row label="의뢰일" fieldKey="occReferralDate" type="date" />
              <Row label="심의일" fieldKey="occReviewDate" type="date" />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>참석여부</label>
                <select style={inputStyle} value={f("occAttendanceType")} onChange={(e) => set("occAttendanceType", e.target.value)}>
                  <option value="">선택</option>
                  {["미참석", "재해자", "대리인", "둘다"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>참석 시 내용</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={f("occAttendanceNote")} onChange={(e) => set("occAttendanceNote", e.target.value)} />
              </div>
            </div>

            <SectionTitle>처분</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>처분결과</label>
                <select style={inputStyle} value={f("disposalType")} onChange={(e) => set("disposalType", e.target.value)}>
                  <option value="">선택</option>
                  {DISPOSAL_TYPE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Row label="처분일자" fieldKey="disposalDate" type="date" />
              <Row label="재진행가능일" fieldKey="reExamPossibleDate" type="date" />
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (3) 장해 */}
      <div style={secWrap}>
        <AccordionHeader open={sec3Open} onToggle={() => setSec3Open((o) => !o)} label="(3) 장해" />
        {sec3Open && (
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="장해급여청구일" fieldKey="disabilityClaimDate" type="date" />
            </div>

            <SectionTitle>처분</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>처분결과</label>
                <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "6px 0" }}>
                  {["승인", "불승인"].map((opt) => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
                      <input type="radio" name={`dispType-${caseId}`} value={opt} checked={dispType === opt} onChange={() => set("disabilityDispositionType", opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              {dispType === "승인" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>장해 유형</label>
                    <select style={inputStyle} value={f("disabilityGradeType")} onChange={(e) => set("disabilityGradeType", e.target.value)}>
                      <option value="">선택</option>
                      {["일반", "가중"].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>장해 등급</label>
                    <select style={inputStyle} value={f("disabilityDispositionGrade")} onChange={(e) => set("disabilityDispositionGrade", e.target.value)}>
                      <option value="">선택</option>
                      {Array.from({ length: 14 }, (_, i) => `${i + 1}급`).map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </>
              )}
              <Row label="처분일자" fieldKey="disabilityDispositionDate" type="date" />
              <Row label="처분을 안 날" fieldKey="disabilityDispositionNoticeDate" type="date" />
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (4) 유족 */}
      <div style={secWrap}>
        <AccordionHeader open={sec4Open} onToggle={() => setSec4Open((o) => !o)} label="(4) 유족" />
        {sec4Open && (
          <div style={{ padding: 20, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
            추후 별도 안내 예정입니다.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 진폐 상세 탭 ── */
type PneumoForm = Record<string, string | boolean | null>;

function PneumoconiosisTab({ caseId }: { caseId: string }) {
  const [form, setForm] = useState<PneumoForm>({});
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sec1Open, setSec1Open] = useState(true);
  const [sec2Open, setSec2Open] = useState(false);
  const [sec3Open, setSec3Open] = useState(false);
  const [sec4Open, setSec4Open] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/pneumoconiosis`)
      .then((r) => r.json())
      .then((data) => { setForm(data ?? {}); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [caseId]);

  const f = (key: string) => String(form[key] ?? "");
  const set = (key: string, val: string | boolean) => setForm((prev) => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/pneumoconiosis`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaveMsg("저장되었습니다");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg("오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>{children}</div>
  );

  const Row = ({ label, fieldKey, type = "text" }: { label: string; fieldKey: string; type?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</label>
      <input type={type} style={inputStyle} value={f(fieldKey)} onChange={(e) => set(fieldKey, e.target.value)} />
    </div>
  );

  const SaveBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
      <button onClick={save} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "저장중..." : "저장"}
      </button>
      {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes("오류") ? "#dc2626" : "#16a34a" }}>{saveMsg}</span>}
    </div>
  );

  if (loadingData) return <div style={{ padding: 24, color: "#9ca3af", fontSize: 13 }}>로딩중...</div>;

  return (
    <div>
      {/* (1) 사건초기 */}
      <div style={secWrap}>
        <AccordionHeader open={sec1Open} onToggle={() => setSec1Open((o) => !o)} label="(1) 사건초기" />
        {sec1Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>초진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="초진 병원" fieldKey="firstClinic" />
              <Row label="초진 날짜" fieldKey="firstExamDate" type="date" />
            </div>

            <SectionTitle>최종 적용 법령</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>적용 법령</label>
                <select style={inputStyle} value={f("applicableLaw")} onChange={(e) => set("applicableLaw", e.target.value)}>
                  <option value="">선택</option>
                  {["구법", "신법", "신법화된 구법"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <SectionTitle>이직자 여부</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>이직자 여부</label>
                <select style={inputStyle} value={f("isRetired")} onChange={(e) => set("isRetired", e.target.value)}>
                  <option value="">선택</option>
                  {["해당", "비해당"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (2) 요양 */}
      <div style={secWrap}>
        <AccordionHeader open={sec2Open} onToggle={() => setSec2Open((o) => !o)} label="(2) 요양" />
        {sec2Open && (
          <div style={{ padding: 20, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
            추후 별도 안내 예정입니다.
          </div>
        )}
      </div>

      {/* (3) 진폐승인 */}
      <div style={secWrap}>
        <AccordionHeader open={sec3Open} onToggle={() => setSec3Open((o) => !o)} label="(3) 진폐승인" />
        {sec3Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>진폐정밀</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input
                type="checkbox"
                id="isNoticeReceived"
                checked={Boolean(form.isNoticeReceived)}
                onChange={(e) => set("isNoticeReceived", e.target.checked)}
              />
              <label htmlFor="isNoticeReceived" style={{ fontSize: 12, color: "#374151", cursor: "pointer" }}>진폐정밀 통지서 수신 완료</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Row label="진폐정밀실시일" fieldKey="precisionExamDate" type="date" />
              <Row label="정밀결과" fieldKey="precisionResult" />
              <Row label="진폐정밀병원" fieldKey="precisionHospital" />
              <Row label="진폐정밀가능일자" fieldKey="precisionPossibleDate" type="date" />
              <Row label="재진행가능일자" fieldKey="reExamPossibleDate" type="date" />
            </div>

            <SectionTitle>처분</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>처분결과</label>
                <select style={inputStyle} value={f("disposalType")} onChange={(e) => set("disposalType", e.target.value)}>
                  <option value="">선택</option>
                  {DISPOSAL_TYPE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Row label="처분일자" fieldKey="disposalDate" type="date" />
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (4) 유족 */}
      <div style={secWrap}>
        <AccordionHeader open={sec4Open} onToggle={() => setSec4Open((o) => !o)} label="(4) 유족" />
        {sec4Open && (
          <div style={{ padding: 20, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
            추후 별도 안내 예정입니다.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 기본정보 탭 ── */
const BRANCHES = ["울산지사", "부산지사", "경남지사", "서울지사", "경기지사", "인천지사", "대구지사", "광주지사", "대전지사", "기타"];
const SALES_ROUTES = ["직접", "제휴", "소개", "온라인", "기타"];

function BasicInfoTab({ caseData, onUpdated }: { caseData: CaseData; onUpdated: (c: CaseData) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    caseType: caseData.caseType,
    caseNumber: caseData.caseNumber ?? "",
    tfName: caseData.tfName ?? "",
    branch: caseData.branch ?? "",
    subAgent: caseData.subAgent ?? "",
    branchManager: caseData.branchManager ?? "",
    salesManager: caseData.salesManager ?? "",
    caseManager: caseData.caseManager ?? "",
    salesRoute: caseData.salesRoute ?? "",
    contractDate: toInputDate(caseData.contractDate),
    receptionDate: toInputDate(caseData.receptionDate),
    isOneStop: caseData.isOneStop,
    status: getCaseStatus(caseData),
    memo: caseData.memo ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, contractDate: form.contractDate || null, receptionDate: form.receptionDate || null }),
      });
      if (!res.ok) throw new Error();
      const updated: CaseData = await res.json();
      onUpdated(updated);
      setEditing(false);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <InfoCard title="재해자 기본 정보">
            <InfoRow label="성명">{caseData.patient.name}</InfoRow>
            <InfoRow label="주민번호"><span style={{ fontFamily: "monospace" }}>{caseData.patient.ssn}</span></InfoRow>
            <InfoRow label="연락처">{caseData.patient.phone ?? "-"}</InfoRow>
            <InfoRow label="주소">{caseData.patient.address ?? "-"}</InfoRow>
          </InfoCard>
          <InfoCard title="사건 정보">
            <InfoRow label="사건유형">{CASE_TYPE_LABELS[caseData.caseType] ?? caseData.caseType}</InfoRow>
            <InfoRow label="사건번호">{caseData.caseNumber ?? "-"}</InfoRow>
            <InfoRow label="TF명">{caseData.tfName ?? "-"}</InfoRow>
            <InfoRow label="지사">{caseData.branch ?? "-"}</InfoRow>
          </InfoCard>
          <InfoCard title="담당자 정보">
            <InfoRow label="영업담당">{caseData.salesManager ?? "-"}</InfoRow>
            <InfoRow label="실무담당">{caseData.caseManager ?? "-"}</InfoRow>
            <InfoRow label="지사장">{caseData.branchManager ?? "-"}</InfoRow>
            <InfoRow label="부지사">{caseData.subAgent ?? "-"}</InfoRow>
            <InfoRow label="영업경로">{caseData.salesRoute ?? "-"}</InfoRow>
          </InfoCard>
          <InfoCard title="일정">
            <InfoRow label="약정일">{formatDate(caseData.contractDate)}</InfoRow>
            <InfoRow label="접수일">{formatDate(caseData.receptionDate)}</InfoRow>
            <InfoRow label="원스톱">{caseData.isOneStop ? "예" : "아니오"}</InfoRow>
          </InfoCard>
        </div>
        {caseData.memo && (
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 16, marginBottom: 16, fontSize: 13, color: "#374151" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>메모</div>
            {caseData.memo}
          </div>
        )}
        <button onClick={() => setEditing(true)} style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          수정
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 16px 0" }}>사건 정보 수정</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>사건유형</label>
          <select style={inputStyle} value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })}>
            {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>진행상황</label>
          <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {(STATUS_BY_CASE_TYPE[form.caseType] ?? STATUS_BY_CASE_TYPE["HEARING_LOSS"]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {([
          ["사건번호", "caseNumber"], ["TF명", "tfName"], ["영업담당자", "salesManager"], ["실무담당자", "caseManager"],
          ["지사장", "branchManager"], ["부지사", "subAgent"],
        ] as [string, keyof typeof form][]).map(([label, key]) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>{label}</label>
            <input style={inputStyle} value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>지사</label>
          <select style={inputStyle} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
            <option value="">선택</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>영업경로</label>
          <select style={inputStyle} value={form.salesRoute} onChange={(e) => setForm({ ...form, salesRoute: e.target.value })}>
            <option value="">선택</option>
            {SALES_ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>약정일자</label>
          <input type="date" style={inputStyle} value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>접수일자</label>
          <input type="date" style={inputStyle} value={form.receptionDate} onChange={(e) => setForm({ ...form, receptionDate: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>메모</label>
          <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장중..." : "저장"}
          </button>
          <button onClick={() => setEditing(false)} style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>취소</button>
        </div>
      </div>
    </div>
  );
}

/* ── 서식 생성 탭 ── */
function FormTab({ caseId }: { caseId: string }) {
  const forms = ["요양급여신청서", "장해급여청구서", "간병급여청구서", "휴업급여청구서", "유족급여청구서", "장의비청구서"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {forms.map((name) => (
        <div key={name} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 24, textAlign: "center" }}>📄</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "center" }}>{name}</div>
          <a href={`/api/cases/${caseId}/generate-disability-claim`} style={{ display: "block", background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", cursor: "pointer" }}>
            PDF 생성
          </a>
        </div>
      ))}
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.caseId as string;

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("기본 정보");

  const fetchCase = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: CaseData = await res.json();
      setCaseData(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  if (loading) return (
    <div style={{ ...S, padding: 24, background: "#f1f5f9", minHeight: "100%" }}>
      <div style={{ background: "white", borderRadius: 10, padding: 32 }}>
        <div style={{ height: 20, background: "#f1f5f9", borderRadius: 4, width: 200, marginBottom: 16 }} />
        <div style={{ height: 14, background: "#f1f5f9", borderRadius: 4, width: 120 }} />
      </div>
    </div>
  );

  if (error || !caseData) return (
    <div style={{ ...S, padding: 24, textAlign: "center" }}>
      <div style={{ color: "#dc2626", marginBottom: 12 }}>⚠ {error ?? "데이터 없음"}</div>
      <button onClick={() => router.push("/cases")} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>목록으로</button>
    </div>
  );

  const isHearingLoss = caseData.caseType === "HEARING_LOSS";
  const isCopd = caseData.caseType === "COPD";
  const isPneumo = caseData.caseType === "PNEUMOCONIOSIS";
  const TABS = [
    "기본 정보",
    ...(isHearingLoss ? ["난청 상세"] : []),
    ...(isCopd ? ["COPD 상세"] : []),
    ...(isPneumo ? ["진폐 상세"] : []),
    "서식 생성",
  ];

  return (
    <div style={{ ...S, minHeight: "100%", background: "#f1f5f9" }}>
      {/* 헤더 */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "stretch", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.push("/cases")} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "16px 0", flexShrink: 0 }}>
          ← 목록
        </button>
        <div style={{ width: 1, background: "#e5e7eb", margin: "12px 0" }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{caseData.patient.name}</span>
          <StatusBadge status={getCaseStatus(caseData)} />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{CASE_TYPE_LABELS[caseData.caseType] ?? caseData.caseType}</span>
          {caseData.branch && <span style={{ fontSize: 12, color: "#6b7280", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>{caseData.branch}</span>}
        </div>
      </div>

      {/* 요약 바 */}
      <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "10px 24px", display: "flex", gap: 24, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
        <span>주민번호: <strong style={{ color: "#374151", fontFamily: "monospace" }}>{caseData.patient.ssn}</strong></span>
        <span>담당자: <strong style={{ color: "#374151" }}>{caseData.caseManager ?? "-"}</strong></span>
        <span>TF: <strong style={{ color: "#374151" }}>{caseData.tfName ?? "-"}</strong></span>
        <span>접수일: <strong style={{ color: "#374151" }}>{formatDate(caseData.receptionDate)}</strong></span>
      </div>

      {/* 탭 */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex" }}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent", color: activeTab === tab ? "#2563eb" : "#6b7280", fontWeight: activeTab === tab ? 700 : 400, fontSize: 13, padding: "14px 20px", cursor: "pointer", marginBottom: -1 }}>
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ padding: 24, maxWidth: 1000 }}>
        {activeTab === "기본 정보" && <BasicInfoTab caseData={caseData} onUpdated={setCaseData} />}
        {activeTab === "난청 상세" && isHearingLoss && <HearingLossTab caseId={caseData.id} initial={caseData.hearingLoss} />}
        {activeTab === "COPD 상세" && isCopd && <CopdTab caseId={caseData.id} />}
        {activeTab === "진폐 상세" && isPneumo && <PneumoconiosisTab caseId={caseData.id} />}
        {activeTab === "서식 생성" && <FormTab caseId={caseData.id} />}
      </div>
    </div>
  );
}
