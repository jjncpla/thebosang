"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { CASE_TYPE_LABELS, DISPOSAL_TYPE, GRADE_TYPE, STATUS_BY_CASE_TYPE, HEARING_LOSS_STATUS } from "@/lib/constants/case";
import { OCC_DISEASE_COMMITTEES } from "@/constants/occDiseaseCommittees";

const S = { fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" };

type HearingLossData = Record<string, string | number | boolean | null>;

type DetailStatus = { status: string } | null;

type CopdDetailData = {
  status: string;
  firstClinic: string | null;
  firstExamDate: string | null;
  specialClinic: string | null;
  exam1Date: string | null;
  exam1Rate: number | null;
  exam1Volume: number | null;
  exam2Date: string | null;
  exam2Rate: number | null;
  exam2Volume: number | null;
  examMemo: string | null;
  expertOrgDate: string | null;
  disposalType: string | null;
  disposalDate: string | null;
  reExamPossibleDate: string | null;
} | null;

type PneumoconiosisDetailData = {
  status: string;
  firstClinic: string | null;
  firstExamDate: string | null;
  isNoticeReceived: boolean;
  precisionExamDate: string | null;
  precisionResult: string | null;
  precisionHospital: string | null;
  precisionPossibleDate: string | null;
  reExamPossibleDate: string | null;
  disposalType: string | null;
  disposalDate: string | null;
} | null;

type CaseData = {
  id: string;
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
  hearingLoss: HearingLossData | null;
  copd: CopdDetailData;
  pneumoconiosis: PneumoconiosisDetailData;
  musculoskeletal: DetailStatus;
  occupationalAccident: DetailStatus;
  occupationalCancer: DetailStatus;
  bereaved: DetailStatus;
};

function getCaseStatus(c: CaseData): string {
  if (c.caseType === "HEARING_LOSS") return (c.hearingLoss as Record<string, unknown>)?.status as string ?? "접수대기";
  if (c.caseType === "COPD") return c.copd?.status ?? "접수대기";
  if (c.caseType === "PNEUMOCONIOSIS") return c.pneumoconiosis?.status ?? "접수대기";
  if (c.caseType === "MUSCULOSKELETAL") return c.musculoskeletal?.status ?? "접수대기";
  if (c.caseType === "OCCUPATIONAL_ACCIDENT") return c.occupationalAccident?.status ?? "접수대기";
  if (c.caseType === "OCCUPATIONAL_CANCER") return c.occupationalCancer?.status ?? "접수대기";
  if (c.caseType === "BEREAVED") return c.bereaved?.status ?? "접수대기";
  return "접수대기";
}

type PatientData = {
  id: string;
  name: string;
  ssn: string;
  phone: string | null;
  address: string | null;
  memo: string | null;
  createdAt: string;
  cases: CaseData[];
};

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
  "접수대기":    { bg: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca", dot: "#818cf8" },
  "접수완료":    { bg: "#082f49", color: "#7dd3fc", border: "1px solid #0369a1", dot: "#38bdf8" },
  "특진예정":    { bg: "#1a2e05", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "특진중":      { bg: "#052e16", color: "#6ee7b7", border: "1px solid #059669", dot: "#34d399" },
  "특진완료":    { bg: "#052e16", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "재특진예정":  { bg: "#1e1b4b", color: "#c4b5fd", border: "1px solid #7c3aed", dot: "#a78bfa" },
  "재특진중":    { bg: "#2e1065", color: "#d8b4fe", border: "1px solid #9333ea", dot: "#c084fc" },
  "재특진완료":  { bg: "#2e1065", color: "#e9d5ff", border: "1px solid #7e22ce", dot: "#d8b4fe" },
  "재재특진예정":{ bg: "#3b1764", color: "#f0abfc", border: "1px solid #a21caf", dot: "#e879f9" },
  "재재특진중":  { bg: "#4a1942", color: "#f9a8d4", border: "1px solid #be185d", dot: "#f472b6" },
  "재재특진완료":{ bg: "#4a1942", color: "#fda4af", border: "1px solid #9f1239", dot: "#fb7185" },
  "전문예정":    { bg: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dot: "#fbbf24" },
  "전문완료":    { bg: "#451a03", color: "#fde68a", border: "1px solid #d97706", dot: "#fcd34d" },
  "승인":        { bg: "#052e16", color: "#86efac", border: "1px solid #16a34a", dot: "#4ade80" },
  "불승인":      { bg: "#450a0a", color: "#fca5a5", border: "1px solid #b91c1c", dot: "#f87171" },
  "반려":        { bg: "#450a0a", color: "#fca5a5", border: "1px solid #dc2626", dot: "#f87171" },
  "보류":        { bg: "#1c1917", color: "#d6d3d1", border: "1px solid #78716c", dot: "#a8a29e" },
  "파기":        { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" },
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
  border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#374151",
  outline: "none", background: "white", width: "100%", boxSizing: "border-box",
};

const TAB_ORDER = [
  "HEARING_LOSS", "COPD", "PNEUMOCONIOSIS", "MUSCULOSKELETAL",
  "OCCUPATIONAL_ACCIDENT", "OCCUPATIONAL_CANCER", "BEREAVED", "OTHER",
];

const BRANCHES = ["울산지사", "부산지사", "경남지사", "서울지사", "경기지사", "인천지사", "대구지사", "광주지사", "대전지사", "기타"];
const SALES_ROUTES = ["직접", "제휴", "소개", "온라인", "기타"];

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
function HearingLossTab({ caseId, initial }: { caseId: string; initial: HearingLossData | null }) {
  const [form, setForm] = useState<HearingLossData>(initial ?? {});
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

/* ── 서식 생성 ── */
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

/* ── 사건 공통정보 아코디언 ── */
function CaseCommonInfoSection({ caseItem, onUpdated }: { caseItem: CaseData; onUpdated: (c: CaseData) => void }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    caseNumber: caseItem.caseNumber ?? "",
    tfName: caseItem.tfName ?? "",
    branch: caseItem.branch ?? "",
    subAgent: caseItem.subAgent ?? "",
    branchManager: caseItem.branchManager ?? "",
    salesManager: caseItem.salesManager ?? "",
    caseManager: caseItem.caseManager ?? "",
    salesRoute: caseItem.salesRoute ?? "",
    contractDate: toInputDate(caseItem.contractDate),
    receptionDate: toInputDate(caseItem.receptionDate),
    isOneStop: caseItem.isOneStop,
    status: getCaseStatus(caseItem),
    memo: caseItem.memo ?? "",
  });
  const [saving, setSaving] = useState(false);

  const updateStatus = async (status: string) => {
    setForm((prev) => ({ ...prev, status }));
    try {
      const res = await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated: CaseData = await res.json();
        onUpdated(updated);
      }
    } catch { /* silent */ }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contractDate: form.contractDate || null,
          receptionDate: form.receptionDate || null,
        }),
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

  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", border: "none", borderBottom: open ? "1px solid #e5e7eb" : "none", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>사건 공통정보</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          {!editing ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 12, border: "1px solid #f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                {([
                  ["TF명", caseItem.tfName ?? "-"],
                  ["지사", caseItem.branch ?? "-"],
                  ["영업담당", caseItem.salesManager ?? "-"],
                  ["실무담당", caseItem.caseManager ?? "-"],
                  ["영업경로", caseItem.salesRoute ?? "-"],
                  ["원스톱", caseItem.isOneStop ? "예" : "아니오"],
                  ["약정일", formatDate(caseItem.contractDate)],
                  ["접수일", formatDate(caseItem.receptionDate)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ display: "flex", gap: 8, borderBottom: "1px solid #f9fafb", padding: "7px 12px", background: "white" }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", width: 56, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#9ca3af", width: 56 }}>진행상황</span>
                <select
                  value={form.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  style={{ ...inputStyle, width: 160 }}
                >
                  {(STATUS_BY_CASE_TYPE[caseItem.caseType] ?? HEARING_LOSS_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {caseItem.memo && (
                <div style={{ fontSize: 12, color: "#374151", background: "#f8fafc", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>메모</div>
                  {caseItem.memo}
                </div>
              )}
              <button onClick={() => setEditing(true)} style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>수정</button>
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {([
                ["사건번호", "caseNumber"],
                ["TF명", "tfName"],
                ["영업담당자", "salesManager"],
                ["실무담당자", "caseManager"],
              ] as [string, keyof typeof form][]).map(([label, key]) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 11, color: "#9ca3af" }}>{label}</label>
                  <input style={inputStyle} value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>지사</label>
                <select style={inputStyle} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                  <option value="">선택</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>영업경로</label>
                <select style={inputStyle} value={form.salesRoute} onChange={(e) => setForm({ ...form, salesRoute: e.target.value })}>
                  <option value="">선택</option>
                  {SALES_ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>약정일자</label>
                <input type="date" style={inputStyle} value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>접수일자</label>
                <input type="date" style={inputStyle} value={form.receptionDate} onChange={(e) => setForm({ ...form, receptionDate: e.target.value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>진행상황</label>
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {(STATUS_BY_CASE_TYPE[caseItem.caseType] ?? HEARING_LOSS_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 16 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>원스톱</label>
                <input type="checkbox" checked={form.isOneStop} onChange={(e) => setForm({ ...form, isOneStop: e.target.checked })} />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af" }}>메모</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button onClick={save} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "저장중..." : "저장"}
                </button>
                <button onClick={() => setEditing(false)} style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>취소</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 요양 섹션 (빈 껍데기) ── */
function YoyangSection() {
  const SubTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", padding: "10px 0 8px", borderBottom: "1px solid #e5e7eb", marginBottom: 12, marginTop: 8 }}>{children}</div>
  );
  const PlaceholderField = ({ label }: { label: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</label>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: "#d1d5db", background: "#f9fafb" }}>준비 중</div>
    </div>
  );
  return (
    <div>
      <SubTitle>── 요양 승인 전 ──</SubTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <PlaceholderField label="최초 접수일" />
        <PlaceholderField label="특진 여부" />
        <PlaceholderField label="특진일" />
        <PlaceholderField label="질판위 의뢰일" />
        <PlaceholderField label="질판위 심의일" />
        <PlaceholderField label="결정" />
      </div>
      <SubTitle>── 요양 승인 후 ──</SubTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <PlaceholderField label="최초 요양 시작일" />
        <PlaceholderField label="최초 요양 종료일" />
        <PlaceholderField label="이종요양비 청구" />
        <PlaceholderField label="최종 요양 종결일" />
      </div>
      <SubTitle>── 휴업급여 ──</SubTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <PlaceholderField label="요양기간" />
        <PlaceholderField label="청구기간 시작일" />
        <PlaceholderField label="청구기간 종료일" />
        <PlaceholderField label="지급제한 사유" />
      </div>
    </div>
  );
}

/* ── 사건 상세 패널 (4섹션 구조) ── */
function CaseDetailPanel({ caseItem }: { caseItem: CaseData }) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());

  const toggle = (n: number) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const sectionStyle: React.CSSProperties = {
    background: "white", borderRadius: 10, border: "1px solid #e5e7eb",
    marginBottom: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  };

  const AccordionBtn = ({ n, title }: { n: number; title: string }) => {
    const isOpen = openSections.has(n);
    return (
      <button
        onClick={() => toggle(n)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "12px 16px", background: isOpen ? "#eff6ff" : "#f9fafb",
          border: "none", borderBottom: isOpen ? "1px solid #bfdbfe" : "none",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 11, color: isOpen ? "#1d4ed8" : "#9ca3af" }}>{isOpen ? "▼" : "▶"}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: isOpen ? "#1d4ed8" : "#374151" }}>{title}</span>
      </button>
    );
  };

  const { caseType } = caseItem;

  return (
    <div>
      {/* (1) 사건 초기 — 항상 펼쳐진 상태 */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "#eff6ff", borderBottom: "1px solid #bfdbfe" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8" }}>(1) 사건 초기</span>
        </div>
        <div style={{ padding: 20 }}>
          {caseType === "HEARING_LOSS" && (
            <HearingLossTab caseId={caseItem.id} initial={caseItem.hearingLoss} />
          )}
          {caseType === "COPD" && (
            <CopdTab caseId={caseItem.id} />
          )}
          {caseType === "PNEUMOCONIOSIS" && (
            <PneumoconiosisTab caseId={caseItem.id} />
          )}
          {!["HEARING_LOSS", "COPD", "PNEUMOCONIOSIS"].includes(caseType) && (
            <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 24 }}>
              사건 초기 정보가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* (2) 요양 */}
      <div style={sectionStyle}>
        <AccordionBtn n={2} title="(2) 요양" />
        {openSections.has(2) && (
          <div style={{ padding: 20 }}>
            <YoyangSection />
          </div>
        )}
      </div>

      {/* (3) 장해 */}
      <div style={sectionStyle}>
        <AccordionBtn n={3} title="(3) 장해" />
        {openSections.has(3) && (
          <div style={{ padding: 20, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
            <div>준비 중입니다.</div>
            <div style={{ marginTop: 4 }}>장해 정보는 요양 종결 후 입력됩니다.</div>
          </div>
        )}
      </div>

      {/* (4) 유족 */}
      <div style={sectionStyle}>
        <AccordionBtn n={4} title="(4) 유족" />
        {openSections.has(4) && (
          <div style={{ padding: 20, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
            <div>준비 중입니다.</div>
            <div style={{ marginTop: 4 }}>유족 정보는 별도 설계 후 구현됩니다.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 탭 콘텐츠 ── */
function CaseTabContent({ caseItem, onCaseUpdated }: { caseItem: CaseData; onCaseUpdated: (c: CaseData) => void }) {
  return (
    <div>
      <CaseCommonInfoSection caseItem={caseItem} onUpdated={onCaseUpdated} />
      <CaseDetailPanel caseItem={caseItem} />
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 16 }}>서식 생성</div>
        <FormTab caseId={caseItem.id} />
      </div>
    </div>
  );
}

/* ── 왼쪽 사이드바 ── */
function PatientSidebar({ patient, onUpdated }: { patient: PatientData; onUpdated: (p: PatientData) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: patient.name, phone: patient.phone ?? "", address: patient.address ?? "" });
  const [saving, setSaving] = useState(false);
  const [memo, setMemo] = useState(patient.memo ?? "");

  const saveInfo = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone || null, address: form.address || null }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdated({ ...patient, ...updated });
      setEditing(false);
    } catch {
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const saveMemo = async () => {
    try {
      await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: memo || null }),
      });
    } catch { /* silent */ }
  };

  return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 사진 영역 */}
      <div style={{ width: 120, height: 150, background: "#f1f5f9", borderRadius: 8, border: "2px dashed #d1d5db", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", alignSelf: "center" }}>
        <span style={{ fontSize: 20 }}>📷</span>
        <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>신분증 등록</span>
      </div>

      {/* 재해자 정보 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>재해자 정보</span>
        </div>
        {!editing ? (
          <div>
            {([
              ["성명", patient.name],
              ["주민번호", patient.ssn],
              ["연락처", patient.phone ?? "-"],
              ["주소", patient.address ?? "-"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid #f9fafb", padding: "8px 12px" }}>
                <span style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{label}</span>
                <span style={{ fontSize: 12, color: "#111827", fontWeight: 500, wordBreak: "break-all" }}>{value}</span>
              </div>
            ))}
            <div style={{ padding: "10px 12px" }}>
              <button onClick={() => setEditing(true)} style={{ width: "100%", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>수정</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {([["성명", "name"], ["연락처", "phone"], ["주소", "address"]] as [string, keyof typeof form][]).map(([label, key]) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10, color: "#9ca3af" }}>{label}</label>
                <input style={{ ...inputStyle, fontSize: 12, padding: "4px 8px" }} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={saveInfo} disabled={saving} style={{ flex: 1, background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "..." : "저장"}
              </button>
              <button onClick={() => setEditing(false)} style={{ flex: 1, background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px", fontSize: 11, cursor: "pointer" }}>취소</button>
            </div>
          </div>
        )}
      </div>

      {/* 비고 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>비고</span>
        </div>
        <div style={{ padding: 12 }}>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontSize: 12 }}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={saveMemo}
            placeholder="비고를 입력하세요..."
          />
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, confirming }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 28, zIndex: 1000, minWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 12 }}>삭제 확인</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 8, whiteSpace: "pre-line" }}>{message}</div>
        <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 24 }}>이 작업은 되돌릴 수 없습니다.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={confirming} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} disabled={confirming} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: confirming ? 0.6 : 1 }}>
            {confirming ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── 메인 페이지 (inner) ── */
function PatientPageInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const patientId = params?.patientId as string;

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  const fetchPatient = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: PatientData = await res.json();
      setPatient(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const handleDelete = async () => {
    setDeleteConfirming(true);
    try {
      const res = await fetch(`/api/patients/${patientId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      router.push("/patients");
    } catch {
      alert("삭제 중 오류가 발생했습니다");
    } finally {
      setDeleteConfirming(false);
      setDeleteModal(false);
    }
  };

  useEffect(() => {
    if (!patient) return;
    const tabParam = searchParams?.get("tab") ?? "";
    const visibleTabs = TAB_ORDER.filter((t) => patient.cases.some((c) => c.caseType === t));
    if (tabParam && visibleTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (visibleTabs.length > 0 && !activeTab) {
      setActiveTab(visibleTabs[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, searchParams]);

  const updateCase = useCallback((updated: CaseData) => {
    setPatient((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.id === updated.id ? { ...updated, hearingLoss: updated.hearingLoss ?? c.hearingLoss } : c
        ),
      };
    });
  }, []);

  if (loading) return (
    <div style={{ ...S, padding: 24, background: "#f1f5f9", minHeight: "100%" }}>
      <div style={{ background: "white", borderRadius: 10, padding: 32 }}>
        <div style={{ height: 20, background: "#f1f5f9", borderRadius: 4, width: 200, marginBottom: 16 }} />
        <div style={{ height: 14, background: "#f1f5f9", borderRadius: 4, width: 120 }} />
      </div>
    </div>
  );

  if (error || !patient) return (
    <div style={{ ...S, padding: 24, textAlign: "center" }}>
      <div style={{ color: "#dc2626", marginBottom: 12 }}>⚠ {error ?? "데이터 없음"}</div>
      <button onClick={() => router.push("/cases")} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>목록으로</button>
    </div>
  );

  const visibleTabs = TAB_ORDER.filter((t) => patient.cases.some((c) => c.caseType === t));
  const activeCaseItem = patient.cases.find((c) => c.caseType === activeTab) ?? null;

  return (
    <div style={{ ...S, minHeight: "100%", background: "#f1f5f9" }}>
      {deleteModal && (
        <ConfirmModal
          message={`${patient.name} 재해자와 연결된 모든 사건을 삭제합니다.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(false)}
          confirming={deleteConfirming}
        />
      )}
      {/* 헤더 */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "stretch", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => router.push("/cases")} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "16px 0", flexShrink: 0 }}>
          ← 사건 목록
        </button>
        <div style={{ width: 1, background: "#e5e7eb", margin: "12px 0" }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{patient.name}</span>
          {patient.cases.map((c) => (
            <StatusBadge key={c.id} status={getCaseStatus(c)} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={() => setDeleteModal(true)}
            style={{ background: "white", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            재해자 삭제
          </button>
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div style={{ display: "flex", gap: 20, padding: 20, alignItems: "flex-start" }}>
        {/* 왼쪽 사이드바 */}
        <PatientSidebar patient={patient} onUpdated={setPatient} />

        {/* 오른쪽 패널 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {visibleTabs.length === 0 ? (
            <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af" }}>
              등록된 사건이 없습니다.
              <br />
              <button
                onClick={() => router.push(`/cases/new?patientId=${patient.id}`)}
                style={{ marginTop: 12, background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                + 사건 추가
              </button>
            </div>
          ) : (
            <>
              {/* 탭 헤더 */}
              <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 16, display: "flex", alignItems: "center", overflow: "hidden" }}>
                {visibleTabs.length > 1 ? (
                  <div style={{ display: "flex", flex: 1, borderBottom: "none" }}>
                    {visibleTabs.map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        style={{
                          background: "none", border: "none",
                          borderBottom: activeTab === t ? "2px solid #2563eb" : "2px solid transparent",
                          color: activeTab === t ? "#2563eb" : "#6b7280",
                          fontWeight: activeTab === t ? 700 : 400,
                          fontSize: 13, padding: "14px 20px", cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {CASE_TYPE_LABELS[t] ?? t}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1, padding: "14px 20px", fontSize: 13, fontWeight: 700, color: "#111827" }}>
                    {CASE_TYPE_LABELS[visibleTabs[0]] ?? visibleTabs[0]}
                  </div>
                )}
                <div style={{ padding: "0 12px" }}>
                  <button
                    onClick={() => router.push(`/cases/new?patientId=${patient.id}`)}
                    style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    + 사건 추가
                  </button>
                </div>
              </div>

              {/* 탭 콘텐츠 */}
              {activeCaseItem && (
                <CaseTabContent caseItem={activeCaseItem} onCaseUpdated={updateCase} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: "'Malgun Gothic', sans-serif" }}>로딩중...</div>}>
      <PatientPageInner />
    </Suspense>
  );
}
