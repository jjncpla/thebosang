"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { CASE_TYPE_LABELS, DISPOSAL_TYPE, STATUS_BY_CASE_TYPE, HEARING_LOSS_STATUS, CASE_STATUS_LABELS, CASE_STATUS_COLORS } from "@/lib/constants/case";
import ContactSelector from "@/components/ui/ContactSelector";
import BranchSelector from "@/components/ui/BranchSelector";
import DateSegmentInput from "@/components/ui/DateSegmentInput";
import CaseAttachments from "@/components/CaseAttachments";
import firstVisitHospitalsData from "@/data/first_visit_hospitals.json";
import specialHospitalsData from "@/data/special_hospitals.json";
const FIRST_VISIT_HOSPITALS: string[] = (firstVisitHospitalsData as { hearing_loss: { hospital: string }[] }).hearing_loss.map(h => h.hospital);
const SPECIAL_HOSPITALS: string[] = (specialHospitalsData as { hospital: string }[]).map(h => h.hospital);

const S = { fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" };

import type { WorkHistoryItem, WorkHistoryRaw, WorkHistoryDailyEntry } from "@/components/case-common/WorkHistoryTypes";
import CaseCommonInfo from "@/components/case-common/CaseCommonInfo";
import CaseWorkHistoryCard from "@/components/case-common/CaseWorkHistoryCard";
import CopdCaseDetailInline from "@/components/copd/CopdCaseDetailInline";

type HearingLossExam = {
  id: string;
  examSet: string;
  examRound: number;
  examDate: string | null;
  air500R: number | null; air1kR: number | null; air2kR: number | null; air4kR: number | null;
  air500L: number | null; air1kL: number | null; air2kL: number | null; air4kL: number | null;
  bone500R: number | null; bone1kR: number | null; bone2kR: number | null; bone4kR: number | null;
  bone500L: number | null; bone1kL: number | null; bone2kL: number | null; bone4kL: number | null;
  srtRight: number | null;
  srtLeft: number | null;
  speechRight: number | null;
  speechLeft: number | null;
  abrRight: number | null;
  abrLeft: number | null;
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
  disabilityRegistrationDate: string | null;
  disabilityDiagnosisDate: string | null;
  disabilityRegistrationLevel: string | null;
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
  specialExam1Date: string | null; specialExam1Contact: string | null; specialExam1Attendee: string | null; specialExam1Pickup: boolean | null;
  specialExam2Date: string | null; specialExam2Contact: string | null; specialExam2Attendee: string | null; specialExam2Pickup: boolean | null;
  specialExam3Date: string | null; specialExam3Contact: string | null; specialExam3Attendee: string | null; specialExam3Pickup: boolean | null;
  specialExam4Date: string | null; specialExam4Contact: string | null; specialExam4Attendee: string | null; specialExam4Pickup: boolean | null;
  specialExam5Date: string | null; specialExam5Contact: string | null; specialExam5Attendee: string | null; specialExam5Pickup: boolean | null;
  specialClinicPickup: boolean | null; // deprecated (회차별로 이관)
  specialClinicNote: string | null;
  reSpecialClinic: string | null;
  reSpecialClinicPickup: boolean | null; // deprecated
  reSpecialClinicNote: string | null;
  reSpecialExam1Date: string | null; reSpecialExam1Contact: string | null; reSpecialExam1Attendee: string | null; reSpecialExam1Pickup: boolean | null;
  reSpecialExam2Date: string | null; reSpecialExam2Contact: string | null; reSpecialExam2Attendee: string | null; reSpecialExam2Pickup: boolean | null;
  reSpecialExam3Date: string | null; reSpecialExam3Contact: string | null; reSpecialExam3Attendee: string | null; reSpecialExam3Pickup: boolean | null;
  re2SpecialClinic: string | null;
  re2SpecialClinicPickup: boolean | null; // deprecated
  re2SpecialClinicNote: string | null;
  re2SpecialExam1Date: string | null; re2SpecialExam1Contact: string | null; re2SpecialExam1Attendee: string | null; re2SpecialExam1Pickup: boolean | null;
  re2SpecialExam2Date: string | null; re2SpecialExam2Contact: string | null; re2SpecialExam2Attendee: string | null; re2SpecialExam2Pickup: boolean | null;
  re2SpecialExam3Date: string | null; re2SpecialExam3Contact: string | null; re2SpecialExam3Attendee: string | null; re2SpecialExam3Pickup: boolean | null;
  // 장해급여청구서
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  bankAccountType: string | null;
  confirmPriorDisability: boolean | null;
  confirmPriorCompensation: boolean | null;
  receiptDate: string | null;
  receiptAmount: string | null;
  receiptPayer: string | null;
  transferCost: string | null;
  transferCostDetail: string | null;
  complicationPart: string | null;
  complicationHospital: string | null;
  exams: HearingLossExam[];
};

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
  status: string;
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
  kwcOfficeName: string | null;
  kwcOfficerName: string | null;
  workHistory: WorkHistoryItem[] | null;
  workHistoryDaily: WorkHistoryDailyEntry[] | null;
  workHistoryRaw: WorkHistoryRaw | null;
  workHistoryMemo: string | null;
  lastNoiseWorkEndDate: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
  hearingLoss: HearingLossDetail | null;
  copd: CopdDetailData;
  pneumoconiosis: PneumoconiosisDetailData;
  musculoskeletal: DetailStatus;
  occupationalAccident: DetailStatus;
  occupationalCancer: DetailStatus;
  bereaved: DetailStatus;
};

function getCaseStatus(c: CaseData): string {
  return c.status ?? "CONSULTING";
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

const STATUS_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  "접수대기":    { bg: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA", dot: "#29ABE2" },
  "접수완료":    { bg: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA", dot: "#29ABE2" },
  "특진예정":    { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "특진중":      { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "특진완료":    { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "재특진예정":  { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재특진중":    { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재특진완료":  { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재재특진예정":{ bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "재재특진중":  { bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "재재특진완료":{ bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "전문예정":    { bg: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", dot: "#F59E0B" },
  "전문완료":    { bg: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", dot: "#F59E0B" },
  "승인":        { bg: "#E8F5D0", color: "#5A8A1F", border: "1px solid #A2D158", dot: "#8DC63F" },
  "불승인":      { bg: "#FEF2F2", color: "#b91c1c", border: "1px solid #FECACA", dot: "#EF4444" },
  "반려":        { bg: "#FEF2F2", color: "#b91c1c", border: "1px solid #FECACA", dot: "#EF4444" },
  "보류":        { bg: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", dot: "#94A3B8" },
  "파기":        { bg: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", dot: "#94A3B8" },
};

function StatusBadge({ status }: { status: string }) {
  const label = CASE_STATUS_LABELS[status] ?? status;
  const ec = CASE_STATUS_COLORS[status];
  const s = ec
    ? { bg: ec.bg, color: ec.color, border: `1px solid ${ec.border}`, dot: ec.border }
    : STATUS_COLOR[status] ?? STATUS_COLOR[label] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {label}
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

// 소음성 난청 자동 진행상황 계산
function computeHLStatus(hl: HearingLossDetail | null, closedReason: string | null): string | null {
  if (!hl) return null;
  if (closedReason) return "CLOSED";
  if (hl.decisionType === "APPROVED") return "APPROVED";
  if (hl.decisionType === "REJECTED") return "REJECTED";
  if (hl.bankAccountSubmittedAt) return "BANK_SUBMITTED";
  if (hl.bankAccountRequestedAt) return "BANK_REQUESTED";
  if (hl.expertDate || hl.expertMemo) return "EXPERT_DONE";
  if (hl.expertRequestReceivedAt) return "EXPERT_REQUESTED";
  // 특진 완료 여부: 1~3차 모두 기입됐는지
  const allFilled =
    hl.specialExam1Date && hl.specialExam1Contact && hl.specialExam1Attendee &&
    hl.specialExam2Date && hl.specialExam2Contact && hl.specialExam2Attendee &&
    hl.specialExam3Date && hl.specialExam3Contact && hl.specialExam3Attendee;
  const anyFilled =
    hl.specialExam1Date || hl.specialExam1Contact || hl.specialExam1Attendee ||
    hl.specialExam2Date || hl.specialExam2Contact || hl.specialExam2Attendee ||
    hl.specialExam3Date || hl.specialExam3Contact || hl.specialExam3Attendee;
  if (allFilled) return "EXAM_DONE";
  if (anyFilled) return "IN_EXAM";
  if (hl.examRequestReceivedAt) return "EXAM_REQUESTED";
  if (hl.claimSubmittedAt) return "SUBMITTED";
  return "CONTRACTED";
}

/* ── 공통: 섹션 아코디언 스타일 ── */
const secWrap: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 10, overflow: "hidden" };

function AccordionHeader({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: open ? "#eff6ff" : "#f9fafb", border: "none", borderBottom: open ? "1px solid #bfdbfe" : "none", cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: open ? "#1A95C8" : "#374151" }}>{label}</span>
      <span style={{ fontSize: 12, color: open ? "#1A95C8" : "#6b7280" }}>{open ? "▲" : "▼"}</span>
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

/* ── 6분법 계산 ── */
function calc6분법(v500: number | null, v1k: number | null, v2k: number | null, v4k: number | null): string {
  if (v500 === null || v1k === null || v2k === null || v4k === null) return "-";
  return ((v500 + 2 * v1k + 2 * v2k + v4k) / 6).toFixed(1);
}

const EMPTY_DETAIL: HearingLossDetail = {
  id: "", firstClinic: null, firstExamDate: null, firstExamRight: null, firstExamLeft: null,
  firstExamSpeech: null, passedInitialCriteria: false, isDisabilityRegistered: false,
  disabilityRegistrationDate: null, disabilityDiagnosisDate: null, disabilityRegistrationLevel: null,
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
  rejectionReason: null, reviewMemo: null,
  specialExam1Date: null, specialExam1Contact: null, specialExam1Attendee: null, specialExam1Pickup: null,
  specialExam2Date: null, specialExam2Contact: null, specialExam2Attendee: null, specialExam2Pickup: null,
  specialExam3Date: null, specialExam3Contact: null, specialExam3Attendee: null, specialExam3Pickup: null,
  specialExam4Date: null, specialExam4Contact: null, specialExam4Attendee: null, specialExam4Pickup: null,
  specialExam5Date: null, specialExam5Contact: null, specialExam5Attendee: null, specialExam5Pickup: null,
  specialClinicPickup: null, specialClinicNote: null,
  reSpecialClinic: null, reSpecialClinicPickup: null, reSpecialClinicNote: null,
  reSpecialExam1Date: null, reSpecialExam1Contact: null, reSpecialExam1Attendee: null, reSpecialExam1Pickup: null,
  reSpecialExam2Date: null, reSpecialExam2Contact: null, reSpecialExam2Attendee: null, reSpecialExam2Pickup: null,
  reSpecialExam3Date: null, reSpecialExam3Contact: null, reSpecialExam3Attendee: null, reSpecialExam3Pickup: null,
  re2SpecialClinic: null, re2SpecialClinicPickup: null, re2SpecialClinicNote: null,
  re2SpecialExam1Date: null, re2SpecialExam1Contact: null, re2SpecialExam1Attendee: null, re2SpecialExam1Pickup: null,
  re2SpecialExam2Date: null, re2SpecialExam2Contact: null, re2SpecialExam2Attendee: null, re2SpecialExam2Pickup: null,
  re2SpecialExam3Date: null, re2SpecialExam3Contact: null, re2SpecialExam3Attendee: null, re2SpecialExam3Pickup: null,
  bankName: null, bankAccount: null, bankAccountHolder: null, bankAccountType: null,
  confirmPriorDisability: null, confirmPriorCompensation: null,
  receiptDate: null, receiptAmount: null, receiptPayer: null,
  transferCost: null, transferCostDetail: null,
  complicationPart: null, complicationHospital: null,
  exams: [],
};

const EMPTY_EXAM = (examSet: string, examRound: number): HearingLossExam => ({
  id: "", examSet, examRound, examDate: null,
  air500R: null, air1kR: null, air2kR: null, air4kR: null,
  air500L: null, air1kL: null, air2kL: null, air4kL: null,
  bone500R: null, bone1kR: null, bone2kR: null, bone4kR: null,
  bone500L: null, bone1kL: null, bone2kL: null, bone4kL: null,
  srtRight: null, srtLeft: null, speechRight: null, speechLeft: null,
  abrRight: null, abrLeft: null,
  impedanceRight: null, impedanceLeft: null,
  isReliable: null, medicalRecordObtained: false, predictedGrade: null, memo: null,
});

/* ── 특진 회차 블록 ── */
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "저장에 실패했습니다");
      }
      const updated: HearingLossExam = await res.json();
      setExams((prev) => {
        const idx = prev.findIndex((e) => e.examSet === examSet && e.examRound === round);
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [...prev, updated];
      });
      setMsg("저장되었습니다");
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg(e instanceof Error ? e.message : "오류가 발생했습니다"); }
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
  const summary = hasData ? `기도 우 ${ptaR} / 좌 ${ptaL} dB` : "미입력";

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
      <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: open ? "#eff6ff" : "#fafafa", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: open ? "#1A95C8" : "#374151" }}>{label}</span>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{summary}  {open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          {subTitle("기도청력역치 (dB)")}
          <table style={freqTableStyle}>
            <thead><tr><th style={thStyle}></th><th style={thStyle}>500Hz</th><th style={thStyle}>1kHz</th><th style={thStyle}>2kHz</th><th style={thStyle}>4kHz</th><th style={thStyle}>6분법</th></tr></thead>
            <tbody>
              <tr><td style={{ ...thStyle, width: 40 }}>우</td><td style={tdStyle}>{numField("air500R")}</td><td style={tdStyle}>{numField("air1kR")}</td><td style={tdStyle}>{numField("air2kR")}</td><td style={tdStyle}>{numField("air4kR")}</td><td style={autoStyle}>{ptaR}</td></tr>
              <tr><td style={{ ...thStyle, width: 40 }}>좌</td><td style={tdStyle}>{numField("air500L")}</td><td style={tdStyle}>{numField("air1kL")}</td><td style={tdStyle}>{numField("air2kL")}</td><td style={tdStyle}>{numField("air4kL")}</td><td style={autoStyle}>{ptaL}</td></tr>
            </tbody>
          </table>
          {subTitle("골도청력역치 (dB)")}
          <table style={freqTableStyle}>
            <thead><tr><th style={thStyle}></th><th style={thStyle}>500Hz</th><th style={thStyle}>1kHz</th><th style={thStyle}>2kHz</th><th style={thStyle}>4kHz</th><th style={thStyle}>6분법</th></tr></thead>
            <tbody>
              <tr><td style={{ ...thStyle, width: 40 }}>우</td><td style={tdStyle}>{numField("bone500R")}</td><td style={tdStyle}>{numField("bone1kR")}</td><td style={tdStyle}>{numField("bone2kR")}</td><td style={tdStyle}>{numField("bone4kR")}</td><td style={autoStyle}>{calc6분법(exam.bone500R, exam.bone1kR, exam.bone2kR, exam.bone4kR)}</td></tr>
              <tr><td style={{ ...thStyle, width: 40 }}>좌</td><td style={tdStyle}>{numField("bone500L")}</td><td style={tdStyle}>{numField("bone1kL")}</td><td style={tdStyle}>{numField("bone2kL")}</td><td style={tdStyle}>{numField("bone4kL")}</td><td style={autoStyle}>{calc6분법(exam.bone500L, exam.bone1kL, exam.bone2kL, exam.bone4kL)}</td></tr>
            </tbody>
          </table>
          {subTitle("기골도 편차 (dB)")}
          <table style={freqTableStyle}>
            <thead><tr><th style={thStyle}></th><th style={thStyle}>500Hz</th><th style={thStyle}>1kHz</th><th style={thStyle}>2kHz</th><th style={thStyle}>4kHz</th></tr></thead>
            <tbody>
              <tr><td style={{ ...thStyle, width: 40 }}>우</td>{(["air500R","air1kR","air2kR","air4kR"] as const).map((ak, i) => { const bk = (["bone500R","bone1kR","bone2kR","bone4kR"] as const)[i]; const diff = boneDiff(ak, bk); const over10 = diff !== "-" && Number(diff) > 10; return <td key={ak} style={{ ...autoStyle, color: over10 ? "#dc2626" : "#15803d" }}>{diff}</td>; })}</tr>
              <tr><td style={{ ...thStyle, width: 40 }}>좌</td>{(["air500L","air1kL","air2kL","air4kL"] as const).map((ak, i) => { const bk = (["bone500L","bone1kL","bone2kL","bone4kL"] as const)[i]; const diff = boneDiff(ak, bk); const over10 = diff !== "-" && Number(diff) > 10; return <td key={ak} style={{ ...autoStyle, color: over10 ? "#dc2626" : "#15803d" }}>{diff}</td>; })}</tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>※ 10dB 초과 시 빨간색 (신뢰성 기준)</div>
          {subTitle("어음청력검사")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>청취역치 우측 (dB)</label>{numField("srtRight")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>어음명료도 우측 (%)</label>{numField("speechRight")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>청취역치 좌측 (dB)</label>{numField("srtLeft")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>어음명료도 좌측 (%)</label>{numField("speechLeft")}</div>
          </div>
          {subTitle("ABR (dBnHL)")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>ABR 우측</label>{numField("abrRight")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>ABR 좌측</label>{numField("abrLeft")}</div>
          </div>
          {subTitle("임피던스")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>임피던스 우측</label>
              <select style={inputStyle} value={n("impedanceRight")} onChange={(e) => setField("impedanceRight", e.target.value || null)}>
                <option value="">-</option>{["A","As","Ad","B","C"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>임피던스 좌측</label>
              <select style={inputStyle} value={n("impedanceLeft")} onChange={(e) => setField("impedanceLeft", e.target.value || null)}>
                <option value="">-</option>{["A","As","Ad","B","C"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={exam.isReliable === true} onChange={(e) => setField("isReliable", e.target.checked ? true : null)} />신뢰성 있음
            </label>
            {round === 3 && (<>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={exam.medicalRecordObtained} onChange={(e) => setField("medicalRecordObtained", e.target.checked)} />의무기록지 발급 완료
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>예상 장해등급</label>
                <input style={{ ...inputStyle, width: 100 }} value={n("predictedGrade")} onChange={(e) => setField("predictedGrade", e.target.value || null)} />
              </div>
            </>)}
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>특이사항</label>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", marginTop: 3 }} value={n("memo")} onChange={(e) => setField("memo", e.target.value || null)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button onClick={save} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "저장중..." : "이 회차 저장"}
            </button>
            {msg && <span style={{ fontSize: 12, color: msg.includes("오류") ? "#dc2626" : "#8DC63F" }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Context lets DField live outside HearingLossTab so React doesn't remount inputs on every render
const HLDetailContext = React.createContext<{
  detail: HearingLossDetail;
  setDetail: React.Dispatch<React.SetStateAction<HearingLossDetail>>;
} | null>(null);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

function DField({ label, k, type = "text" }: { label: string; k: keyof HearingLossDetail; type?: string }) {
  const ctx = React.useContext(HLDetailContext)!;
  const v = ctx.detail[k];
  const val = v === null || v === undefined ? "" : String(v);
  const isDate = type === "date" || type === "datetime-local";
  return (
    <Field label={label}>
      {isDate ? (
        <DateSegmentInput
          value={val}
          onChange={(newVal) => ctx.setDetail((prev) => ({ ...prev, [k]: newVal }))}
          includeTime={type === "datetime-local"}
          style={inputStyle}
        />
      ) : (
        <input type={type} style={inputStyle} value={val} onChange={(e) => ctx.setDetail((prev) => ({ ...prev, [k]: e.target.value || null }))} />
      )}
    </Field>
  );
}

/* ── 난청 상세 탭 ── */
function HearingLossTab({ caseId, initial }: { caseId: string; initial: HearingLossDetail | null }) {
  const [detail, setDetail] = useState<HearingLossDetail>(initial ?? EMPTY_DETAIL);
  const [exams, setExams] = useState<HearingLossExam[]>(initial?.exams ?? []);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sec1Open, setSec1Open] = useState(true);
  const [sec3Open, setSec3Open] = useState(true);
  const [showReExam, setShowReExam] = useState(false);
  const [showReReExam, setShowReReExam] = useState(false);
  const [initialExamRounds, setInitialExamRounds] = useState<number[]>(() => {
    const existing = (initial?.exams ?? []).filter((e) => e.examSet === "INITIAL").map((e) => e.examRound);
    return existing.length > 0 ? [...new Set(existing)].sort((a, b) => a - b) : [1, 2, 3];
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // 정보공개청구서
  const INFO_ITEMS = [
    "특별진찰 의뢰 및 회신서",
    "업무관련성 평가 특별진찰 의뢰 및 회신서",
    "업무관련성 평가 소견서",
    "장해진단서",
    "재해조사서",
    "소음노출수준조사",
    "직업력조사(소음성 난청)",
    "통합심사 의뢰 및 결과서",
    "업무상 질병 자문 의뢰 및 회신서",
    "보험가입자 의견서",
    "평균임금 산정내역서",
  ] as const;
  const [infoChecked, setInfoChecked] = useState<string[]>([]);
  const [infoLoading, setInfoLoading] = useState(false);

  const handleInfoDisclosureDownload = async () => {
    setInfoLoading(true);
    try {
      const content = infoChecked.map((item, i) => `${i + 1}. ${item}`).join("\n");
      const params = new URLSearchParams({ type: "INFO_DISCLOSURE", content });
      const res = await fetch(`/api/cases/${caseId}/forms?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `정보공개청구서.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("생성 실패");
    } finally {
      setInfoLoading(false);
    }
  };

  const d = (key: keyof HearingLossDetail) => {
    const v = detail[key]; return v === null || v === undefined ? "" : String(v);
  };
  const setD = (key: keyof HearingLossDetail, val: unknown) =>
    setDetail((prev) => ({ ...prev, [key]: val }));

  /** 여러 픽업 필드를 한 번에 토글 — 하나라도 false면 전부 true, 모두 true면 전부 false */
  const togglePickupAll = (keys: (keyof HearingLossDetail)[]) => {
    const allChecked = keys.every(k => !!detail[k])
    const next = !allChecked
    setDetail(prev => {
      const d = { ...prev }
      for (const k of keys) (d as Record<string, unknown>)[k as string] = next
      return d
    })
  }
  const PickupToggleButton = ({ keys }: { keys: (keyof HearingLossDetail)[] }) => {
    const allChecked = keys.every(k => !!detail[k])
    return (
      <button
        type="button"
        onClick={() => togglePickupAll(keys)}
        style={{
          marginLeft: 8, padding: '2px 8px', fontSize: 11,
          border: '1px solid #d1d5db', borderRadius: 4,
          background: allChecked ? '#fef3c7' : 'white',
          color: allChecked ? '#92400e' : '#6b7280',
          cursor: 'pointer',
        }}
      >
        🚗 {allChecked ? '픽업 전체 해제' : '픽업 전체 체크'}
      </button>
    )
  }

  const updateHlField = async (key: keyof HearingLossDetail, val: unknown) => {
    setD(key, val);
    await fetch(`/api/cases/${caseId}/hearing-loss`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: val }),
    });
  };

  const saveDetail = async (closedReasonForCalc?: string | null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/hearing-loss`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(detail),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "저장에 실패했습니다");
      }
      // 처분결과 승인/불승인 시 처분검토 페이지에 자동 반영
      if (detail.decisionType === "APPROVED" || detail.decisionType === "REJECTED") {
        try {
          await fetch(`/api/objection/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId, approvalStatus: detail.decisionType === "APPROVED" ? "승인" : "불승인" }),
          });
        } catch { /* 처분검토 연동 오류는 silent */ }
      }
      // 진행상황 자동 업데이트
      const autoStatus = computeHLStatus(detail, closedReasonForCalc ?? null);
      if (autoStatus) {
        try {
          await fetch(`/api/cases/${caseId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: autoStatus }),
          });
        } catch { /* silent */ }
      }
      setSaveMsg("저장되었습니다");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : "오류가 발생했습니다"); }
    finally { setSaving(false); }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>{children}</div>
  );
  const SaveBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
      <button onClick={() => saveDetail()} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "저장중..." : "저장"}
      </button>
      {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes("오류") ? "#dc2626" : "#8DC63F" }}>{saveMsg}</span>}
    </div>
  );


  return (
    <HLDetailContext.Provider value={{ detail, setDetail }}>
    <div>
      {/* (1) 사건초기 */}
      <div style={secWrap}>
        <AccordionHeader open={sec1Open} onToggle={() => setSec1Open((o) => !o)} label="(1) 사건초기" />
        {sec1Open && (
          <div style={{ padding: 20 }}>
            <SectionTitle>초진</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
              <Field label="초진 병원">
                <input list="first-clinic-list" style={inputStyle} value={d("firstClinic")} onChange={(e) => setD("firstClinic", e.target.value || null)} placeholder="병원명 검색..." />
                <datalist id="first-clinic-list">
                  {FIRST_VISIT_HOSPITALS.map((h, i) => <option key={i} value={h} />)}
                </datalist>
              </Field>
              <DField label="초진일" k="firstExamDate" type="date" />
              <div />
              <DField label="우측 PTA (dB)" k="firstExamRight" type="number" />
              <DField label="좌측 PTA (dB)" k="firstExamLeft" type="number" />
              <DField label="어음명료도 (%)" k="firstExamSpeech" type="number" />
            </div>

            <div style={{ marginTop: 8, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer", marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(detail.isDisabilityRegistered)}
                  onChange={(e) => setD("isDisabilityRegistered", e.target.checked)}
                />
                국가장애 등록 이력
              </label>
              {detail.isDisabilityRegistered && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, paddingLeft: 20, borderLeft: "2px solid #e0e7ff" }}>
                  <DField label="등록일자" k="disabilityRegistrationDate" type="date" />
                  <DField label="진단일자" k="disabilityDiagnosisDate" type="date" />
                  <Field label="급수">
                    <input
                      style={inputStyle}
                      value={d("disabilityRegistrationLevel")}
                      placeholder="예: 2급, 3급"
                      onChange={(e) => setD("disabilityRegistrationLevel", e.target.value || null)}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}><SaveBar /></div>

            {/* 장해급여청구서 추가 정보 */}
            <div style={{
              marginTop: '12px',
              padding: '14px',
              backgroundColor: '#fafafa',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '12px', color: '#374151' }}>
                장해급여청구서 추가 정보
              </div>

              {/* 수령계좌 */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>수령계좌</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>은행(증권사)명</label>
                    <input
                      type="text"
                      value={detail.bankName ?? ''}
                      onChange={(e) => updateHlField('bankName', e.target.value || null)}
                      placeholder="예: 국민은행"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>예금주</label>
                    <input
                      type="text"
                      value={detail.bankAccountHolder ?? ''}
                      onChange={(e) => updateHlField('bankAccountHolder', e.target.value || null)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#9ca3af' }}>계좌번호</label>
                  <input
                    type="text"
                    value={detail.bankAccount ?? ''}
                    onChange={(e) => updateHlField('bankAccount', e.target.value || null)}
                    placeholder="계좌번호 입력"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`bankType-${caseId}`}
                      checked={detail.bankAccountType === '보통계좌'}
                      onChange={() => updateHlField('bankAccountType', '보통계좌')}
                    />
                    보통계좌
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`bankType-${caseId}`}
                      checked={detail.bankAccountType === '전용계좌'}
                      onChange={() => updateHlField('bankAccountType', '전용계좌')}
                    />
                    보험급여 전용계좌(희망지킴이)
                  </label>
                </div>
              </div>

              {/* 확인사항 */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>확인사항</div>

                <div style={{ marginBottom: '6px', fontSize: '12px' }}>
                  <div style={{ marginBottom: '4px', color: '#374151' }}>① 재해발생 이전 업무외 사유로 장해 남은 사실?</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" name={`confirm1-${caseId}`}
                        checked={detail.confirmPriorDisability === true}
                        onChange={() => updateHlField('confirmPriorDisability', true)} />
                      예
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" name={`confirm1-${caseId}`}
                        checked={detail.confirmPriorDisability === false}
                        onChange={() => updateHlField('confirmPriorDisability', false)} />
                      아니오
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: '6px', fontSize: '12px' }}>
                  <div style={{ marginBottom: '4px', color: '#374151' }}>② 동일사유로 민법 등 배상/보상 수령?</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" name={`confirm2-${caseId}`}
                        checked={detail.confirmPriorCompensation === true}
                        onChange={() => updateHlField('confirmPriorCompensation', true)} />
                      예
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="radio" name={`confirm2-${caseId}`}
                        checked={detail.confirmPriorCompensation === false}
                        onChange={() => updateHlField('confirmPriorCompensation', false)} />
                      아니오
                    </label>
                  </div>
                </div>

                {detail.confirmPriorCompensation === true && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#9ca3af' }}>수령일자</label>
                      <input type="text" value={detail.receiptDate ?? ''}
                        onChange={(e) => updateHlField('receiptDate', e.target.value || null)}
                        placeholder="예: 2024.03.01" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#9ca3af' }}>수령금액</label>
                      <input type="text" value={detail.receiptAmount ?? ''}
                        onChange={(e) => updateHlField('receiptAmount', e.target.value || null)}
                        placeholder="원" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#9ca3af' }}>지급한 자</label>
                      <input type="text" value={detail.receiptPayer ?? ''}
                        onChange={(e) => updateHlField('receiptPayer', e.target.value || null)}
                        style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>

              {/* 이송비 */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>이송비</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '6px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>이송비용 (원)</label>
                    <input type="text" value={detail.transferCost ?? ''}
                      onChange={(e) => updateHlField('transferCost', e.target.value || null)}
                      placeholder="0" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>산출내역</label>
                    <input type="text" value={detail.transferCostDetail ?? ''}
                      onChange={(e) => updateHlField('transferCostDetail', e.target.value || null)}
                      style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* 합병증 등 예방관리 */}
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>합병증 등 예방관리</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>구체적 부위 (또는 상병명)</label>
                    <input type="text" value={detail.complicationPart ?? ''}
                      onChange={(e) => updateHlField('complicationPart', e.target.value || null)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>예방관리 의료기관명</label>
                    <input type="text" value={detail.complicationHospital ?? ''}
                      onChange={(e) => updateHlField('complicationHospital', e.target.value || null)}
                      style={inputStyle} />
                  </div>
                </div>
              </div>
            </div>

            {/* 접수 서식 생성 */}
            <div style={{ marginTop: 16, padding: 16, backgroundColor: "#f0faf4", borderRadius: 8, border: "1px solid #8DC63F" }}>
              <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 12, color: "#006838" }}>📄 접수 서식 생성</div>
              <FormButtons caseId={caseId} />
            </div>

            {/* 정보공개 청구서 */}
            <div style={{ marginTop: 16, padding: 14, backgroundColor: "#fafafa", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 10, color: "#374151" }}>
                📋 정보공개 청구서 생성
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>청구할 서류 선택:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 12 }}>
                {INFO_ITEMS.map((item) => (
                  <label key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={infoChecked.includes(item)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setInfoChecked((prev) => [...prev, item]);
                        } else {
                          setInfoChecked((prev) => prev.filter((i) => i !== item));
                        }
                      }}
                    />
                    {item}
                  </label>
                ))}
              </div>
              <button
                onClick={handleInfoDisclosureDownload}
                disabled={infoChecked.length === 0 || infoLoading}
                style={{
                  padding: "8px 16px",
                  backgroundColor: infoChecked.length === 0 ? "#d1d5db" : "#29ABE2",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: infoChecked.length === 0 ? "not-allowed" : "pointer",
                  fontSize: 13,
                }}
              >
                {infoLoading ? "생성 중..." : `📄 정보공개 청구서 생성 (${infoChecked.length}개 선택)`}
              </button>
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
              <DField label="접수일" k="claimSubmittedAt" type="date" />
            </div>
            <SectionTitle>특진병원 선택</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <Field label="특진병원명">
                <input list="special-clinic-list" style={inputStyle} value={d("specialClinic")} onChange={(e) => setD("specialClinic", e.target.value || null)} placeholder="병원명 검색..." />
                <datalist id="special-clinic-list">
                  {SPECIAL_HOSPITALS.map((h, i) => <option key={i} value={h} />)}
                </datalist>
              </Field>
              <DField label="선택확인서 제출일" k="examClinicSelectionSubmittedAt" type="date" />
              <DField label="비고" k="specialClinicNote" />
            </div>
            <SectionTitle>특진진찰요구서</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="수령일" k="examRequestReceivedAt" type="date" />
              <DField label="진찰기간 시작" k="examPeriodStart" type="date" />
              <DField label="진찰기간 종료" k="examPeriodEnd" type="date" />
            </div>
            <SectionTitle>
              최초특진 일정 및 참석
              <PickupToggleButton keys={initialExamRounds.map(r => `specialExam${r}Pickup` as keyof HearingLossDetail)} />
            </SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
              {initialExamRounds.map((r) => (
                <React.Fragment key={`sched-${r}`}>
                  <DField label={`${r}차 특진일정`} k={`specialExam${r}Date` as keyof HearingLossDetail} type="datetime-local" />
                  <DField label={`${r}차 연락담당자`} k={`specialExam${r}Contact` as keyof HearingLossDetail} />
                  <DField label={`${r}차 참석자`} k={`specialExam${r}Attendee` as keyof HearingLossDetail} />
                  <Field label={`${r}차 픽업`}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={!!detail[`specialExam${r}Pickup` as keyof HearingLossDetail]}
                        onChange={(e) => setD(`specialExam${r}Pickup` as keyof HearingLossDetail, e.target.checked)}
                      />
                      <span style={{ fontSize: 13 }}>🚗 필요</span>
                    </label>
                  </Field>
                </React.Fragment>
              ))}
            </div>
            <SectionTitle>최초특진 검사결과</SectionTitle>
            <ExamRoundBlock caseId={caseId} examSet="INITIAL" round={1} label="상세검사결과" exams={exams} setExams={setExams} />
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowReExam((v) => !v)} style={{ background: showReExam ? "#eff6ff" : "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: showReExam ? "#1A95C8" : "#374151" }}>
                {showReExam ? "▲ 재특진 숨기기" : "▼ 재특진 입력"}
              </button>
            </div>
            {showReExam && (<>
              <SectionTitle>재특진병원 선택</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
                <DField label="재특진병원명" k="reSpecialClinic" />
                <DField label="비고" k="reSpecialClinicNote" />
              </div>
              <SectionTitle>
                재특진 일정 및 참석
                <PickupToggleButton keys={[1,2,3].map(r => `reSpecialExam${r}Pickup` as keyof HearingLossDetail)} />
              </SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
                {[1, 2, 3].map((r) => (
                  <React.Fragment key={`resched-${r}`}>
                    <DField label={`${r}차 재특진일정`} k={`reSpecialExam${r}Date` as keyof HearingLossDetail} type="datetime-local" />
                    <DField label={`${r}차 연락담당자`} k={`reSpecialExam${r}Contact` as keyof HearingLossDetail} />
                    <DField label={`${r}차 참석자`} k={`reSpecialExam${r}Attendee` as keyof HearingLossDetail} />
                    <Field label={`${r}차 픽업`}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <input
                          type="checkbox"
                          checked={!!detail[`reSpecialExam${r}Pickup` as keyof HearingLossDetail]}
                          onChange={(e) => setD(`reSpecialExam${r}Pickup` as keyof HearingLossDetail, e.target.checked)}
                        />
                        <span style={{ fontSize: 13 }}>🚗 필요</span>
                      </label>
                    </Field>
                  </React.Fragment>
                ))}
              </div>
              <SectionTitle>재특진 검사결과</SectionTitle>
              <ExamRoundBlock caseId={caseId} examSet="RE" round={1} label="상세검사결과" exams={exams} setExams={setExams} />
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => setShowReReExam((v) => !v)} style={{ background: showReReExam ? "#eff6ff" : "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: showReReExam ? "#1A95C8" : "#374151" }}>
                  {showReReExam ? "▲ 재재특진 숨기기" : "▼ 재재특진 입력"}
                </button>
              </div>
              {showReReExam && (<>
                <SectionTitle>재재특진병원 선택</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
                  <DField label="재재특진병원명" k="re2SpecialClinic" />
                  <DField label="비고" k="re2SpecialClinicNote" />
                </div>
                <SectionTitle>
                  재재특진 일정 및 참석
                  <PickupToggleButton keys={[1,2,3].map(r => `re2SpecialExam${r}Pickup` as keyof HearingLossDetail)} />
                </SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
                  {[1, 2, 3].map((r) => (
                    <React.Fragment key={`re2sched-${r}`}>
                      <DField label={`${r}차 재재특진일정`} k={`re2SpecialExam${r}Date` as keyof HearingLossDetail} type="datetime-local" />
                      <DField label={`${r}차 연락담당자`} k={`re2SpecialExam${r}Contact` as keyof HearingLossDetail} />
                      <DField label={`${r}차 참석자`} k={`re2SpecialExam${r}Attendee` as keyof HearingLossDetail} />
                      <Field label={`${r}차 픽업`}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <input
                            type="checkbox"
                            checked={!!detail[`re2SpecialExam${r}Pickup` as keyof HearingLossDetail]}
                            onChange={(e) => setD(`re2SpecialExam${r}Pickup` as keyof HearingLossDetail, e.target.checked)}
                          />
                          <span style={{ fontSize: 13 }}>🚗 필요</span>
                        </label>
                      </Field>
                    </React.Fragment>
                  ))}
                </div>
                <SectionTitle>재재특진 검사결과</SectionTitle>
                <ExamRoundBlock caseId={caseId} examSet="RE2" round={1} label="상세검사결과" exams={exams} setExams={setExams} />
              </>)}
            </>)}
            <SectionTitle>전문조사</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="전문조사진찰요구서 수령일" k="expertRequestReceivedAt" type="date" />
              <DField label="전문조사기관" k="expertClinic" />
              <DField label="선택확인서 제출일" k="expertClinicSelectionSubmittedAt" type="date" />
              <DField label="전문조사 실시일" k="expertDate" type="date" />
            </div>
            <Field label="전문조사 특이사항">
              <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={d("expertMemo")} onChange={(e) => setD("expertMemo", e.target.value || null)} />
            </Field>
            <SectionTitle>결정</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <DField label="통장사본 요청 수령일" k="bankAccountRequestedAt" type="date" />
              <DField label="통장사본 제출일" k="bankAccountSubmittedAt" type="date" />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>처분 결과</label>
                <select style={inputStyle} value={d("decisionType")} onChange={(e) => setD("decisionType", e.target.value || null)}>
                  <option value="">선택</option>
                  <option value="APPROVED">승인</option>
                  <option value="REJECTED">불승인</option>
                </select>
              </div>
            </div>
            <SaveBar />
          </div>
        )}
      </div>

      {/* (4) 유족 — 비활성 */}
      <DisabledSection label="(4) 유족" />
    </div>
    </HLDetailContext.Provider>
  );
}

/* ── COPD 상세 탭 — 인라인 회차 기반 UI ── */
function CopdTab({ caseId }: { caseId: string }) {
  return <CopdCaseDetailInline caseId={caseId} embedded />;
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
      <button onClick={save} disabled={saving} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "저장중..." : "저장"}
      </button>
      {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes("오류") ? "#dc2626" : "#8DC63F" }}>{saveMsg}</span>}
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
const FORMS = [
  { type: "DISABILITY_CLAIM",   label: "장해급여 청구서" },
  { type: "NOISE_WORK_CONFIRM", label: "소음작업 종사 사실 확인서" },
  { type: "AGENT_APPOINTMENT",  label: "대리인 선임신고서" },
  { type: "POWER_OF_ATTORNEY",  label: "위임장" },
  { type: "SPECIAL_CLINIC",     label: "특진의료기관 선택 확인서 (특진)" },
  { type: "EXPERT_CLINIC",      label: "특진의료기관 선택 확인서 (전문조사)" },
  { type: "WORK_HISTORY",       label: "직업력 조사 표준문답서" },
];

function FormButtons({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleDownload = async (type: string, label: string) => {
    setLoading(type);
    try {
      const res = await fetch(`/api/cases/${caseId}/forms?type=${type}`);
      if (!res.ok) throw new Error("생성 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("서식 생성에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadAll = async () => {
    for (const form of FORMS) {
      await handleDownload(form.type, form.label);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={handleDownloadAll}
        disabled={!!loading}
        style={{ padding: "10px 16px", backgroundColor: "#006838", color: "white", border: "none", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: 14, opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "생성 중..." : "📄 접수 서식 일괄 생성"}
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {FORMS.map((form) => (
          <button
            key={form.type}
            onClick={() => handleDownload(form.type, form.label)}
            disabled={!!loading}
            style={{ padding: "8px 12px", backgroundColor: loading === form.type ? "#29ABE2" : "#f5f5f5", color: loading === form.type ? "white" : "#333", border: "1px solid #ddd", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer", fontSize: 12, textAlign: "left", opacity: loading && loading !== form.type ? 0.5 : 1 }}
          >
            {loading === form.type ? "⏳ " : "📋 "}{form.label}
          </button>
        ))}
      </div>
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
        <span style={{ fontSize: 11, color: isOpen ? "#1A95C8" : "#9ca3af" }}>{isOpen ? "▼" : "▶"}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: isOpen ? "#1A95C8" : "#374151" }}>{title}</span>
      </button>
    );
  };

  const { caseType } = caseItem;

  // 전문 케이스 탭은 자체 4섹션 아코디언을 가지므로 바깥 wrapper 없이 직접 렌더링
  if (caseType === "HEARING_LOSS") return <HearingLossTab caseId={caseItem.id} initial={caseItem.hearingLoss} />;
  if (caseType === "COPD") return <CopdTab caseId={caseItem.id} />;
  if (caseType === "PNEUMOCONIOSIS") return <PneumoconiosisTab caseId={caseItem.id} />;

  return (
    <div>
      {/* (1) 사건 초기 — 항상 펼쳐진 상태 */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "#eff6ff", borderBottom: "1px solid #bfdbfe" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A95C8" }}>(1) 사건 초기</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: 24 }}>
            사건 초기 정보가 없습니다.
          </div>
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
      <CaseCommonInfo
        caseItem={caseItem}
        onUpdated={(updated) => onCaseUpdated({ ...caseItem, ...updated } as CaseData)}
      />
      <CaseWorkHistoryCard
        caseItem={caseItem}
        onUpdated={(updates) => onCaseUpdated({ ...caseItem, ...updates } as CaseData)}
      />
      <CaseDetailPanel caseItem={caseItem} />
    </div>
  );
}

/* ── 왼쪽 사이드바 ── */
function PatientSidebar({ patient, onUpdated, activeCaseId }: { patient: PatientData; onUpdated: (p: PatientData) => void; activeCaseId?: string }) {
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
              <button onClick={saveInfo} disabled={saving} style={{ flex: 1, background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
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

      {/* 첨부파일 */}
      {activeCaseId && <CaseAttachments caseId={activeCaseId} />}
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
      <button onClick={() => router.push("/cases")} style={{ color: "#29ABE2", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>목록으로</button>
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
        <PatientSidebar patient={patient} onUpdated={setPatient} activeCaseId={activeCaseItem?.id} />

        {/* 오른쪽 패널 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {visibleTabs.length === 0 ? (
            <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 40, textAlign: "center", color: "#9ca3af" }}>
              등록된 사건이 없습니다.
              <br />
              <button
                onClick={() => router.push(`/cases/new?patientId=${patient.id}`)}
                style={{ marginTop: 12, background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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
                          borderBottom: activeTab === t ? "2px solid #29ABE2" : "2px solid transparent",
                          color: activeTab === t ? "#29ABE2" : "#6b7280",
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
                    style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
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
