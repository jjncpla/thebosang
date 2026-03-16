"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { CASE_TYPE_LABELS, DISPOSAL_TYPE, GRADE_TYPE, STATUS_BY_CASE_TYPE, CASE_STATUS_LABELS } from "@/lib/constants/case";
import { OCC_DISEASE_COMMITTEES } from "@/constants/occDiseaseCommittees";

const S = { fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" };

type Patient = { id: string; name: string; ssn: string; phone: string | null; address: string | null };

type WorkHistoryItem = {
  company: string;
  department: string;
  jobType: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  noiseExposure: boolean;
  noiseLevel: number | null;
  workHours: string;
  source: string;
};

type HearingLossExam = {
  id: string;
  examSet: string;
  examRound: number;
  examDate: string | null;
  // 기도 우측
  air500R: number | null; air1kR: number | null; air2kR: number | null; air4kR: number | null;
  // 기도 좌측
  air500L: number | null; air1kL: number | null; air2kL: number | null; air4kL: number | null;
  // 골도 우측
  bone500R: number | null; bone1kR: number | null; bone2kR: number | null; bone4kR: number | null;
  // 골도 좌측
  bone500L: number | null; bone1kL: number | null; bone2kL: number | null; bone4kL: number | null;
  // 어음
  srtRight: number | null;
  srtLeft: number | null;
  speechRight: number | null;
  speechLeft: number | null;
  // ABR
  abrRight: number | null;
  abrLeft: number | null;
  // 임피던스
  impedanceRight: string | null;
  impedanceLeft: string | null;
  isReliable: boolean | null;
  medicalRecordObtained: boolean;
  predictedGrade: string | null;
  memo: string | null;
};

type HearingLossDetail = {
  id: string;
  firstClinic: string | null;
  firstExamDate: string | null;
  firstExamRight: number | null;
  firstExamLeft: number | null;
  firstExamSpeech: number | null;
  passedInitialCriteria: boolean;
  isDisabilityRegistered: boolean;
  isBig3: boolean;
  workHistory: WorkHistoryItem[] | null;
  workHistoryMemo: string | null;
  lastNoiseWorkEndDate: string | null;
  claimSubmittedAt: string | null;
  claimNasPath: string | null;
  telegramSharedAt: string | null;
  examRequestReceivedAt: string | null;
  examPeriodStart: string | null;
  examPeriodEnd: string | null;
  specialClinic: string | null;
  examClinicSelectionSubmittedAt: string | null;
  expertRequestReceivedAt: string | null;
  expertClinic: string | null;
  expertClinicSelectionSubmittedAt: string | null;
  expertDate: string | null;
  expertMemo: string | null;
  bankAccountRequestedAt: string | null;
  bankAccountSubmittedAt: string | null;
  decisionType: string | null;
  decisionReceivedAt: string | null;
  approvedDisease: string | null;
  disabilityGrade: string | null;
  disabilityStatus: string | null;
  baseAssessment: string | null;
  finalAssessment: string | null;
  lumpSumAmount: number | null;
  avgWage: number | null;
  compensationPaidAt: string | null;
  wageReviewMemo: string | null;
  adaptedWorkplaceReviewMemo: string | null;
  infoDisclosureRequestedAt: string | null;
  infoDisclosureReceivedAt: string | null;
  rejectionReason: string | null;
  reviewMemo: string | null;
  exams: HearingLossExam[];
};

type CaseData = {
  id: string;
  patientId: string;
  patient: Patient;
  caseType: string;
  status: string;
  caseNumber?: string | null; // 스키마에서 제거됨, BasicInfoTab 호환용
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
  hearingLoss: HearingLossDetail | null;
  copd: { id: string } | null;
  pneumoconiosis: { id: string } | null;
  musculoskeletal: { id: string } | null;
  occupationalAccident: { id: string } | null;
  occupationalCancer: { id: string } | null;
  bereaved: { id: string } | null;
};

function getCaseStatus(c: CaseData): string {
  return c.status ?? "CONSULTING";
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
  // 영문 키
  "CONSULTING":             { bg: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca", dot: "#818cf8" },
  "CONTRACTED":             { bg: "#082f49", color: "#7dd3fc", border: "1px solid #0369a1", dot: "#38bdf8" },
  "DOC_COLLECTING":         { bg: "#082f49", color: "#bae6fd", border: "1px solid #0284c7", dot: "#38bdf8" },
  "SUBMITTED":              { bg: "#1a2e05", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "EXAM_REQUESTED":         { bg: "#1a2e05", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "EXAM_CLINIC_SELECTED":   { bg: "#052e16", color: "#6ee7b7", border: "1px solid #059669", dot: "#34d399" },
  "EXAM_SCHEDULED":         { bg: "#052e16", color: "#6ee7b7", border: "1px solid #059669", dot: "#34d399" },
  "IN_EXAM":                { bg: "#052e16", color: "#6ee7b7", border: "1px solid #059669", dot: "#34d399" },
  "EXAM_DONE":              { bg: "#052e16", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "EXPERT_REQUESTED":       { bg: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dot: "#fbbf24" },
  "EXPERT_CLINIC_SELECTED": { bg: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dot: "#fbbf24" },
  "EXPERT_DONE":            { bg: "#451a03", color: "#fde68a", border: "1px solid #d97706", dot: "#fcd34d" },
  "BANK_REQUESTED":         { bg: "#1e1b4b", color: "#c4b5fd", border: "1px solid #7c3aed", dot: "#a78bfa" },
  "BANK_SUBMITTED":         { bg: "#1e1b4b", color: "#c4b5fd", border: "1px solid #7c3aed", dot: "#a78bfa" },
  "DECISION_RECEIVED":      { bg: "#2e1065", color: "#d8b4fe", border: "1px solid #9333ea", dot: "#c084fc" },
  "REVIEWING":              { bg: "#1c1917", color: "#d6d3d1", border: "1px solid #78716c", dot: "#a8a29e" },
  "INFO_REQUESTED":         { bg: "#1c1917", color: "#d6d3d1", border: "1px solid #78716c", dot: "#a8a29e" },
  "APPROVED":               { bg: "#052e16", color: "#86efac", border: "1px solid #16a34a", dot: "#4ade80" },
  "REJECTED":               { bg: "#450a0a", color: "#fca5a5", border: "1px solid #b91c1c", dot: "#f87171" },
  "CLOSED":                 { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" },
  "OBJECTION":              { bg: "#450a0a", color: "#fca5a5", border: "1px solid #dc2626", dot: "#f87171" },
  "WAGE_CORRECTION":        { bg: "#1e1b4b", color: "#c4b5fd", border: "1px solid #7c3aed", dot: "#a78bfa" },
};

function StatusBadge({ status }: { status: string }) {
  const label = CASE_STATUS_LABELS[status] ?? status;
  const s = STATUS_COLOR[status] ?? STATUS_COLOR[label] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {label}
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
const EMPTY_DETAIL: HearingLossDetail = {
  id: "", firstClinic: null, firstExamDate: null, firstExamRight: null, firstExamLeft: null,
  firstExamSpeech: null, passedInitialCriteria: false, isDisabilityRegistered: false, isBig3: false,
  workHistory: null, workHistoryMemo: null, lastNoiseWorkEndDate: null,
  claimSubmittedAt: null, claimNasPath: null, telegramSharedAt: null,
  examRequestReceivedAt: null, examPeriodStart: null, examPeriodEnd: null,
  specialClinic: null, examClinicSelectionSubmittedAt: null,
  expertRequestReceivedAt: null, expertClinic: null, expertClinicSelectionSubmittedAt: null,
  expertDate: null, expertMemo: null,
  bankAccountRequestedAt: null, bankAccountSubmittedAt: null, decisionType: null,
  decisionReceivedAt: null, approvedDisease: null, disabilityGrade: null, disabilityStatus: null,
  baseAssessment: null, finalAssessment: null, lumpSumAmount: null, avgWage: null,
  compensationPaidAt: null, wageReviewMemo: null, adaptedWorkplaceReviewMemo: null,
  infoDisclosureRequestedAt: null, infoDisclosureReceivedAt: null,
  rejectionReason: null, reviewMemo: null, exams: [],
};

const EMPTY_EXAM = (examSet: string, examRound: number): HearingLossExam => ({
  id: "", examSet, examRound, examDate: null,
  air500R: null, air1kR: null, air2kR: null, air4kR: null,
  air500L: null, air1kL: null, air2kL: null, air4kL: null,
  bone500R: null, bone1kR: null, bone2kR: null, bone4kR: null,
  bone500L: null, bone1kL: null, bone2kL: null, bone4kL: null,
  srtRight: null, srtLeft: null,
  speechRight: null, speechLeft: null,
  abrRight: null, abrLeft: null,
  impedanceRight: null, impedanceLeft: null,
  isReliable: null, medicalRecordObtained: false, predictedGrade: null, memo: null,
});

function calc6분법(v500: number | null, v1k: number | null, v2k: number | null, v4k: number | null): string {
  if (v500 === null || v1k === null || v2k === null || v4k === null) return "-";
  return ((v500 + 2 * v1k + 2 * v2k + v4k) / 6).toFixed(1);
}

function ExamRoundBlock({
  caseId, examSet, round, label, exams, setExams,
}: {
  caseId: string; examSet: string; round: number; label: string;
  exams: HearingLossExam[]; setExams: React.Dispatch<React.SetStateAction<HearingLossExam[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const exam = exams.find((e) => e.examSet === examSet && e.examRound === round) ?? EMPTY_EXAM(examSet, round);

  const setField = (key: keyof HearingLossExam, val: unknown) =>
    setExams((prev) => {
      const idx = prev.findIndex((e) => e.examSet === examSet && e.examRound === round);
      const updated = { ...exam, [key]: val };
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });

  const save = async () => {
    setSaving(true);
    try {
      const method = exam.id ? "PUT" : "POST";
      const url = exam.id
        ? `/api/cases/${caseId}/hearing-loss/exams/${exam.id}`
        : `/api/cases/${caseId}/hearing-loss/exams`;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(exam) });
      if (!res.ok) throw new Error();
      const updated: HearingLossExam = await res.json();
      setExams((prev) => {
        const idx = prev.findIndex((e) => e.examSet === examSet && e.examRound === round);
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [...prev, updated];
      });
      setMsg("저장되었습니다");
      setTimeout(() => setMsg(null), 3000);
    } catch { setMsg("오류가 발생했습니다"); }
    finally { setSaving(false); }
  };

  const n = (key: keyof HearingLossExam) => {
    const v = exam[key]; return (v === null || v === undefined) ? "" : String(v);
  };
  const numField = (key: keyof HearingLossExam) => (
    <input type="number" style={{ ...inputStyle, width: 64 }} value={n(key)}
      onChange={(e) => setField(key, e.target.value === "" ? null : Number(e.target.value))} />
  );

  const ptaR = calc6분법(exam.air500R, exam.air1kR, exam.air2kR, exam.air4kR);
  const ptaL = calc6분법(exam.air500L, exam.air1kL, exam.air2kL, exam.air4kL);
  const hasData = exam.air500R !== null || exam.air500L !== null;

  const summary = hasData
    ? `기도 우 ${ptaR} / 좌 ${ptaL} dB`
    : "미입력";

  const boneDiff = (airKey: keyof HearingLossExam, boneKey: keyof HearingLossExam) => {
    const a = exam[airKey] as number | null;
    const b = exam[boneKey] as number | null;
    if (a === null || b === null) return "-";
    return Math.abs(a - b).toFixed(0);
  };

  const subTitle = (text: string) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, marginTop: 12, paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>{text}</div>
  );

  const freqTableStyle: React.CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: 12 };
  const thStyle: React.CSSProperties = { padding: "4px 6px", background: "#f9fafb", border: "1px solid #e5e7eb", fontWeight: 600, color: "#6b7280", textAlign: "center" };
  const tdStyle: React.CSSProperties = { padding: 4, border: "1px solid #f1f5f9", textAlign: "center" };
  const autoStyle: React.CSSProperties = { padding: "4px 6px", border: "1px solid #f1f5f9", background: "#f0fdf4", color: "#15803d", fontWeight: 700, textAlign: "center", fontSize: 13 };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 8, overflow: "hidden" }}>
      {/* 아코디언 헤더 */}
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: open ? "#eff6ff" : "#fafafa", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: open ? "#1d4ed8" : "#374151" }}>{label}</span>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{summary}  {open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: 16 }}>
          {subTitle("기도청력역치 (dB)")}
          <table style={freqTableStyle}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>500Hz</th>
                <th style={thStyle}>1kHz</th>
                <th style={thStyle}>2kHz</th>
                <th style={thStyle}>4kHz</th>
                <th style={thStyle}>6분법</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...thStyle, width: 40 }}>우</td>
                <td style={tdStyle}>{numField("air500R")}</td>
                <td style={tdStyle}>{numField("air1kR")}</td>
                <td style={tdStyle}>{numField("air2kR")}</td>
                <td style={tdStyle}>{numField("air4kR")}</td>
                <td style={autoStyle}>{ptaR}</td>
              </tr>
              <tr>
                <td style={{ ...thStyle, width: 40 }}>좌</td>
                <td style={tdStyle}>{numField("air500L")}</td>
                <td style={tdStyle}>{numField("air1kL")}</td>
                <td style={tdStyle}>{numField("air2kL")}</td>
                <td style={tdStyle}>{numField("air4kL")}</td>
                <td style={autoStyle}>{ptaL}</td>
              </tr>
            </tbody>
          </table>

          {subTitle("골도청력역치 (dB)")}
          <table style={freqTableStyle}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>500Hz</th>
                <th style={thStyle}>1kHz</th>
                <th style={thStyle}>2kHz</th>
                <th style={thStyle}>4kHz</th>
                <th style={thStyle}>6분법</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...thStyle, width: 40 }}>우</td>
                <td style={tdStyle}>{numField("bone500R")}</td>
                <td style={tdStyle}>{numField("bone1kR")}</td>
                <td style={tdStyle}>{numField("bone2kR")}</td>
                <td style={tdStyle}>{numField("bone4kR")}</td>
                <td style={autoStyle}>{calc6분법(exam.bone500R, exam.bone1kR, exam.bone2kR, exam.bone4kR)}</td>
              </tr>
              <tr>
                <td style={{ ...thStyle, width: 40 }}>좌</td>
                <td style={tdStyle}>{numField("bone500L")}</td>
                <td style={tdStyle}>{numField("bone1kL")}</td>
                <td style={tdStyle}>{numField("bone2kL")}</td>
                <td style={tdStyle}>{numField("bone4kL")}</td>
                <td style={autoStyle}>{calc6분법(exam.bone500L, exam.bone1kL, exam.bone2kL, exam.bone4kL)}</td>
              </tr>
            </tbody>
          </table>

          {subTitle("기골도 편차 (dB)")}
          <table style={freqTableStyle}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>500Hz</th>
                <th style={thStyle}>1kHz</th>
                <th style={thStyle}>2kHz</th>
                <th style={thStyle}>4kHz</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...thStyle, width: 40 }}>우</td>
                {(["air500R","air1kR","air2kR","air4kR"] as const).map((ak, i) => {
                  const bk = (["bone500R","bone1kR","bone2kR","bone4kR"] as const)[i];
                  const diff = boneDiff(ak, bk);
                  const over10 = diff !== "-" && Number(diff) > 10;
                  return <td key={ak} style={{ ...autoStyle, color: over10 ? "#dc2626" : "#15803d" }}>{diff}</td>;
                })}
              </tr>
              <tr>
                <td style={{ ...thStyle, width: 40 }}>좌</td>
                {(["air500L","air1kL","air2kL","air4kL"] as const).map((ak, i) => {
                  const bk = (["bone500L","bone1kL","bone2kL","bone4kL"] as const)[i];
                  const diff = boneDiff(ak, bk);
                  const over10 = diff !== "-" && Number(diff) > 10;
                  return <td key={ak} style={{ ...autoStyle, color: over10 ? "#dc2626" : "#15803d" }}>{diff}</td>;
                })}
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>※ 10dB 초과 시 빨간색 표시 (신뢰성 기준)</div>

          {subTitle("어음청력검사")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>청취역치 우측 (dB)</label>
              {numField("srtRight")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>어음명료도 우측 (%)</label>
              {numField("speechRight")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>청취역치 좌측 (dB)</label>
              {numField("srtLeft")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>어음명료도 좌측 (%)</label>
              {numField("speechLeft")}
            </div>
          </div>

          {subTitle("ABR (dBnHL)")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>ABR 우측</label>
              {numField("abrRight")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>ABR 좌측</label>
              {numField("abrLeft")}
            </div>
          </div>

          {subTitle("임피던스 청력검사")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>임피던스 우측</label>
              <select style={inputStyle} value={n("impedanceRight")} onChange={(e) => setField("impedanceRight", e.target.value || null)}>
                <option value="">-</option>
                {["A", "As", "Ad", "B", "C"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>임피던스 좌측</label>
              <select style={inputStyle} value={n("impedanceLeft")} onChange={(e) => setField("impedanceLeft", e.target.value || null)}>
                <option value="">-</option>
                {["A", "As", "Ad", "B", "C"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={exam.isReliable === true} onChange={(e) => setField("isReliable", e.target.checked ? true : null)} />
              신뢰성 있음
            </label>
            {round === 3 && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={exam.medicalRecordObtained} onChange={(e) => setField("medicalRecordObtained", e.target.checked)} />
                  의무기록지 발급 완료
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>예상 장해등급</label>
                  <input style={{ ...inputStyle, width: 100 }} value={n("predictedGrade")} onChange={(e) => setField("predictedGrade", e.target.value || null)} />
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>특이사항</label>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", marginTop: 3 }} value={n("memo")} onChange={(e) => setField("memo", e.target.value || null)} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button onClick={save} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "저장중..." : "이 회차 저장"}
            </button>
            {msg && <span style={{ fontSize: 12, color: msg.includes("오류") ? "#dc2626" : "#16a34a" }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function HearingLossTab({ caseId, initial }: { caseId: string; initial: HearingLossDetail | null }) {
  const [detail, setDetail] = useState<HearingLossDetail>(initial ?? EMPTY_DETAIL);
  const [exams, setExams] = useState<HearingLossExam[]>(initial?.exams ?? []);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sec1Open, setSec1Open] = useState(true);
  const [sec3Open, setSec3Open] = useState(false);
  const [showReExam, setShowReExam] = useState(false);
  const [showReReExam, setShowReReExam] = useState(false);

  const d = (key: keyof HearingLossDetail) => {
    const v = detail[key];
    return v === null || v === undefined ? "" : String(v);
  };
  const setD = (key: keyof HearingLossDetail, val: unknown) =>
    setDetail((prev) => ({ ...prev, [key]: val }));

  const saveDetail = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/hearing-loss`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detail),
      });
      if (!res.ok) throw new Error("저장 실패");
      setSaveMsg("저장되었습니다");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch { setSaveMsg("오류가 발생했습니다"); }
    finally { setSaving(false); }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>{children}</div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );

  const DField = ({ label, k, type = "text" }: { label: string; k: keyof HearingLossDetail; type?: string }) => (
    <Field label={label}>
      <input type={type} style={inputStyle} value={d(k)} onChange={(e) => setD(k, e.target.value || null)} />
    </Field>
  );

  const SaveBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
      <button onClick={saveDetail} disabled={saving} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "저장중..." : "저장"}
      </button>
      {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes("오류") ? "#dc2626" : "#16a34a" }}>{saveMsg}</span>}
    </div>
  );

  const workHistory: WorkHistoryItem[] = detail.workHistory ?? [];

  const addWorkRow = () => setD("workHistory", [...workHistory, { company: "", department: "", jobType: "", startYear: new Date().getFullYear(), startMonth: 1, endYear: new Date().getFullYear(), endMonth: 12, noiseExposure: false, noiseLevel: null, workHours: "", source: "" }]);
  const removeWorkRow = (i: number) => setD("workHistory", workHistory.filter((_, idx) => idx !== i));
  const setWorkField = (i: number, key: keyof WorkHistoryItem, val: unknown) =>
    setD("workHistory", workHistory.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const years = Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div>
      {/* (1) 사건초기 */}
      <div style={secWrap}>
        <AccordionHeader open={sec1Open} onToggle={() => setSec1Open((o) => !o)} label="(1) 사건초기" />
        {sec1Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>초진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              <DField label="초진 병원" k="firstClinic" />
              <DField label="초진일" k="firstExamDate" type="date" />
              <div />
              <DField label="우측 PTA (dB)" k="firstExamRight" type="number" />
              <DField label="좌측 PTA (dB)" k="firstExamLeft" type="number" />
              <DField label="어음명료도 (%)" k="firstExamSpeech" type="number" />
            </div>
            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
              {([
                ["passedInitialCriteria", "편측 40dB 기준 통과"],
                ["isDisabilityRegistered", "국가장애 등록 이력"],
                ["isBig3", "Big3 병원"],
              ] as [keyof HearingLossDetail, string][]).map(([k, label]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={Boolean(detail[k])} onChange={(e) => setD(k, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>

            <SectionTitle>직업력</SectionTitle>
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["회사명", "직종", "작업내용", "시작년월", "종료년월", "소음노출", "소음(dB)", "근무시간", "출처", ""].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workHistory.map((row, i) => (
                    <tr key={i}>
                      {(["company", "department", "jobType"] as (keyof WorkHistoryItem)[]).map((k) => (
                        <td key={k} style={{ padding: 4, border: "1px solid #f1f5f9" }}>
                          <input style={{ ...inputStyle, minWidth: 80 }} value={String(row[k] ?? "")} onChange={(e) => setWorkField(i, k, e.target.value)} />
                        </td>
                      ))}
                      <td style={{ padding: 4, border: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", gap: 2 }}>
                          <select style={{ ...inputStyle, width: 70 }} value={row.startYear} onChange={(e) => setWorkField(i, "startYear", Number(e.target.value))}>
                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <select style={{ ...inputStyle, width: 50 }} value={row.startMonth} onChange={(e) => setWorkField(i, "startMonth", Number(e.target.value))}>
                            {months.map((m) => <option key={m} value={m}>{m}월</option>)}
                          </select>
                        </div>
                      </td>
                      <td style={{ padding: 4, border: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", gap: 2 }}>
                          <select style={{ ...inputStyle, width: 70 }} value={row.endYear} onChange={(e) => setWorkField(i, "endYear", Number(e.target.value))}>
                            {years.map((y) => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <select style={{ ...inputStyle, width: 50 }} value={row.endMonth} onChange={(e) => setWorkField(i, "endMonth", Number(e.target.value))}>
                            {months.map((m) => <option key={m} value={m}>{m}월</option>)}
                          </select>
                        </div>
                      </td>
                      <td style={{ padding: 4, border: "1px solid #f1f5f9", textAlign: "center" }}>
                        <input type="checkbox" checked={row.noiseExposure} onChange={(e) => setWorkField(i, "noiseExposure", e.target.checked)} />
                      </td>
                      <td style={{ padding: 4, border: "1px solid #f1f5f9" }}>
                        <input type="number" style={{ ...inputStyle, width: 60 }} value={row.noiseLevel ?? ""} onChange={(e) => setWorkField(i, "noiseLevel", e.target.value === "" ? null : Number(e.target.value))} />
                      </td>
                      {(["workHours", "source"] as (keyof WorkHistoryItem)[]).map((k) => (
                        <td key={k} style={{ padding: 4, border: "1px solid #f1f5f9" }}>
                          <input style={{ ...inputStyle, minWidth: 70 }} value={String(row[k] ?? "")} onChange={(e) => setWorkField(i, k, e.target.value)} />
                        </td>
                      ))}
                      <td style={{ padding: 4, border: "1px solid #f1f5f9", textAlign: "center" }}>
                        <button onClick={() => removeWorkRow(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={addWorkRow} style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>
              + 행 추가
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 8 }}>
              <DField label="마지막 소음작업 중단 시기" k="lastNoiseWorkEndDate" type="date" />
            </div>
            <Field label="특이사항">
              <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("workHistoryMemo")} onChange={(e) => setD("workHistoryMemo", e.target.value || null)} />
            </Field>
            <div style={{ marginTop: 16 }}>
              <SaveBar />
            </div>
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
            <SectionTitle>접수/청구</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="청구서 발송일" k="claimSubmittedAt" type="date" />
              <DField label="NAS 경로" k="claimNasPath" />
              <DField label="텔레그램 공유일시" k="telegramSharedAt" type="datetime-local" />
            </div>

            <SectionTitle>특진진찰요구서</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="수령일" k="examRequestReceivedAt" type="date" />
              <DField label="진찰기간 시작" k="examPeriodStart" type="date" />
              <DField label="진찰기간 종료" k="examPeriodEnd" type="date" />
            </div>

            <SectionTitle>특진병원 선택</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="특진병원명" k="specialClinic" />
              <DField label="선택확인서 제출일" k="examClinicSelectionSubmittedAt" type="date" />
            </div>

            <SectionTitle>최초특진</SectionTitle>
            {([1, 2, 3] as const).map((r) => (
              <ExamRoundBlock key={r} caseId={caseId} examSet="INITIAL" round={r} label={`${r}차`} exams={exams} setExams={setExams} />
            ))}

            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowReExam((v) => !v)} style={{ background: showReExam ? "#eff6ff" : "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: showReExam ? "#1d4ed8" : "#374151" }}>
                {showReExam ? "▲ 재특진 숨기기" : "▼ 재특진 입력"}
              </button>
            </div>

            {showReExam && (
              <>
                <SectionTitle>재특진</SectionTitle>
                {([1, 2, 3] as const).map((r) => (
                  <ExamRoundBlock key={r} caseId={caseId} examSet="RE" round={r} label={`${r}차`} exams={exams} setExams={setExams} />
                ))}
                <div style={{ marginBottom: 12 }}>
                  <button onClick={() => setShowReReExam((v) => !v)} style={{ background: showReReExam ? "#eff6ff" : "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: showReReExam ? "#1d4ed8" : "#374151" }}>
                    {showReReExam ? "▲ 재재특진 숨기기" : "▼ 재재특진 입력"}
                  </button>
                </div>
                {showReReExam && (
                  <>
                    <SectionTitle>재재특진</SectionTitle>
                    {([1, 2, 3] as const).map((r) => (
                      <ExamRoundBlock key={r} caseId={caseId} examSet="RE2" round={r} label={`${r}차`} exams={exams} setExams={setExams} />
                    ))}
                  </>
                )}
              </>
            )}

            <SectionTitle>전문조사</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="전문조사진찰요구서 수령일" k="expertRequestReceivedAt" type="date" />
              <DField label="전문조사기관" k="expertClinic" />
              <DField label="선택확인서 제출일" k="expertClinicSelectionSubmittedAt" type="date" />
              <DField label="전문조사 실시일" k="expertDate" type="date" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="특이사항">
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("expertMemo")} onChange={(e) => setD("expertMemo", e.target.value || null)} />
                </Field>
              </div>
            </div>

            <SectionTitle>결정</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="통장사본 요청 수령일" k="bankAccountRequestedAt" type="date" />
              <DField label="통장사본 제출일" k="bankAccountSubmittedAt" type="date" />
              <Field label="처분 결과">
                <select style={inputStyle} value={d("decisionType")} onChange={(e) => setD("decisionType", e.target.value || null)}>
                  <option value="">선택</option>
                  <option value="APPROVED">승인</option>
                  <option value="REJECTED">불승인</option>
                </select>
              </Field>
              <DField label="결정통지서 수령일" k="decisionReceivedAt" type="date" />
              <DField label="승인 상병명" k="approvedDisease" />
              <DField label="확정 장해등급 (예: 14급01호)" k="disabilityGrade" />
              <DField label="장해급여 결정액 (원)" k="lumpSumAmount" type="number" />
              <DField label="산정 평균임금 (원/일)" k="avgWage" type="number" />
              <DField label="보상금 지급일" k="compensationPaidAt" type="date" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="기초산정 내용">
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("baseAssessment")} onChange={(e) => setD("baseAssessment", e.target.value || null)} />
                </Field>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="최종산정 내용">
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("finalAssessment")} onChange={(e) => setD("finalAssessment", e.target.value || null)} />
                </Field>
              </div>
            </div>

            <SectionTitle>검토/정공</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
              <Field label="평균임금 정정 실익 검토">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("wageReviewMemo")} onChange={(e) => setD("wageReviewMemo", e.target.value || null)} />
              </Field>
              <Field label="적사변 실익 검토">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("adaptedWorkplaceReviewMemo")} onChange={(e) => setD("adaptedWorkplaceReviewMemo", e.target.value || null)} />
              </Field>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <DField label="정보공개청구일" k="infoDisclosureRequestedAt" type="date" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <DField label="정공 자료 수령일" k="infoDisclosureReceivedAt" type="date" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="불승인 사유">
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("rejectionReason")} onChange={(e) => setD("rejectionReason", e.target.value || null)} />
                </Field>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="종합 검토 메모">
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={d("reviewMemo")} onChange={(e) => setD("reviewMemo", e.target.value || null)} />
                </Field>
              </div>
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
