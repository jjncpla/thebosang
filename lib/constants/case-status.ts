/**
 * Case.status 단일 진실의 원천 (SOT — Single Source of Truth)
 *
 * D8 — status 영문 enum 통일 + UI 한글 변환 레이어 (PR #1)
 *
 * 정책:
 *  - DB는 영문 enum 값만 저장
 *  - UI는 표시 시점에 한글 라벨로 변환 (getStatusLabel)
 *  - 색상/우선순위도 영문 enum 키 기준
 *  - caseType별 허용 status 도메인은 별도 관리 (드롭다운/필터용)
 *
 * PR #1 (현재): 헬퍼 신설만. 기존 한글 status 값과 양방향 호환.
 * PR #2: UI 호출 교체 (STATUS_MAP / STATUS_COLOR / CASE_STATUS_COLORS → 본 헬퍼)
 * PR #3: DB 마이그레이션 (한글 → 영문 enum)
 * PR #4: 한글 매핑/caseType 분기 제거
 *
 * 사용자 결정 (2026-05-05):
 *  - 기각/송무인계/이산인계/질판위의뢰는 enum에 추가하지 않음 (사용 흐름 없음)
 *  - 진폐 자동 동기화는 본 PR에서 제외 (별도 PR)
 *  - 한글 "기각종결"은 단순 CLOSED로 매핑
 */

// ─────────────────────────────────────────────────────────────────────────
// 영문 enum 정의 (확장)
// ─────────────────────────────────────────────────────────────────────────

/**
 * 모든 caseType 공통 영문 enum.
 * - HEARING_LOSS_STATUS 22종을 베이스로 8종 신규 추가.
 */
export const CASE_STATUS_ENUM = [
  // ── 초기 단계 ─────────────────────────────────────
  "CONSULTING",            // 접수 대기
  "RECEIVED",              // 접수 완료 (사내) — HL의 SUBMITTED(공단접수)와 분리
  "WAITING_FIRST_CLINIC",  // 초진 대기
  "CONTRACTED",            // 약정 완료
  "DOC_COLLECTING",        // 서류 수집 중
  "SUBMITTED",             // 공단 접수 완료 (HL 전용)

  // ── 특진/정밀 단계 ───────────────────────────────
  "EXAM_REQUESTED",          // 특진진찰요구서 수령
  "EXAM_CLINIC_SELECTED",    // 특진병원 선택 완료
  "EXAM_SCHEDULED",          // 특진 일정 확정
  "IN_EXAM",                 // 특진 진행 중
  "EXAM_DONE",               // 특진 완료
  "DETAILED_EXAM_IN_PROGRESS", // 정밀 진행 중 (진폐)
  "DETAILED_EXAM_DONE",      // 정밀 완료 (진폐)

  // ── 전문조사 단계 ────────────────────────────────
  "EXPERT_REQUESTED",        // 전문조사요구서 수령 / 전문 의뢰 (COPD)
  "EXPERT_CLINIC_SELECTED",  // 전문조사기관 선택 완료
  "EXPERT_DONE",             // 전문조사 완료

  // ── 결정/검토 단계 ───────────────────────────────
  "BANK_REQUESTED",          // 통장사본 요청
  "BANK_SUBMITTED",          // 통장사본 제출
  "DECISION_RECEIVED",       // 결정통지서 수령
  "REVIEWING",               // 검토 중
  "INFO_REQUESTED",          // 정보공개청구 중

  // ── 처분 결과 ───────────────────────────────────
  "APPROVED",                // 승인
  "REJECTED",                // 불승인
  "RETURNED",                // 반려
  "ON_HOLD",                 // 보류
  "DISCARDED",               // 파기
  "DISPOSED",                // 처분 완료 (GENERAL의 처분완료)

  // ── COPD 특화 ───────────────────────────────────
  "MEASUREMENT_FAIL",        // 수치 미달
  "JOB_HISTORY_FAIL",        // 직력 미달
  "REAPPLY_AVAILABLE",       // 재신청 가능

  // ── MUSCULO/OCC_ACC 특화 ─────────────────────────
  "IN_TREATMENT",            // 요양 중
  "TREATMENT_CLOSED",        // 요양 종결
  "DISABILITY_APPROVED",     // 장해 승인

  // ── 일반 진행 ───────────────────────────────────
  "IN_PROGRESS",             // 진행 중 (GENERAL)

  // ── 종결/이의제기 ────────────────────────────────
  "CLOSED",                  // 종결
  "OBJECTION",               // 이의제기
  "WAGE_CORRECTION",         // 평균임금 정정
] as const;

export type CaseStatusEnum = (typeof CASE_STATUS_ENUM)[number];

// ─────────────────────────────────────────────────────────────────────────
// 한글 → 영문 매핑 (DB 마이그레이션 + 양방향 호환용)
// ─────────────────────────────────────────────────────────────────────────

/**
 * 기존 DB의 한글 status 값을 영문 enum으로 매핑.
 * PR #3 마이그레이션 endpoint에서 사용.
 * PR #2 UI 호출 시점에는 양방향 호환을 위해 fallback으로도 사용.
 */
export const KOREAN_TO_ENUM: Record<string, CaseStatusEnum> = {
  // 초기 단계
  "접수대기": "CONSULTING",
  "접수 대기": "CONSULTING",
  "접수완료": "RECEIVED",
  "접수 완료": "RECEIVED",
  "초진대기": "WAITING_FIRST_CLINIC",
  "약정": "CONTRACTED",
  "약정완료": "CONTRACTED",
  "약정 완료": "CONTRACTED",
  "서류수집중": "DOC_COLLECTING",

  // 특진/정밀 단계 (COPD/MUSCULO 한글)
  "특진중": "IN_EXAM",
  "특진완료": "EXAM_DONE",
  "정밀진행중": "DETAILED_EXAM_IN_PROGRESS",
  "정밀완료": "DETAILED_EXAM_DONE",

  // 전문 단계
  "전문의뢰": "EXPERT_REQUESTED",
  "전문완료": "EXPERT_DONE",

  // 처분 결과
  "승인": "APPROVED",
  "불승인": "REJECTED",
  "반려": "RETURNED",
  "보류": "ON_HOLD",
  "파기": "DISCARDED",
  "처분완료": "DISPOSED",

  // COPD 특화
  "수치미달": "MEASUREMENT_FAIL",
  "직력미달": "JOB_HISTORY_FAIL",
  "재진행가능": "REAPPLY_AVAILABLE",

  // MUSCULO/OCC_ACC 특화
  "요양승인": "APPROVED", // 요양 단계 승인 — 단순 APPROVED로 통합
  "요양중": "IN_TREATMENT",
  "요양종결": "TREATMENT_CLOSED",
  "장해승인": "DISABILITY_APPROVED",

  // 일반
  "진행중": "IN_PROGRESS",

  // 종결/이의제기
  "종결": "CLOSED",
  "이의제기": "OBJECTION",
  "기각종결": "CLOSED", // 사용자 결정: closedReason 추가 안 함 → 단순 CLOSED
};

// ─────────────────────────────────────────────────────────────────────────
// 영문 → 한글 라벨 (UI 표시용)
// ─────────────────────────────────────────────────────────────────────────

export const ENUM_TO_LABEL: Record<CaseStatusEnum, string> = {
  CONSULTING: "접수 대기",
  RECEIVED: "접수 완료",
  WAITING_FIRST_CLINIC: "초진 대기",
  CONTRACTED: "약정 완료",
  DOC_COLLECTING: "서류 수집 중",
  SUBMITTED: "공단 접수 완료",
  EXAM_REQUESTED: "특진진찰요구서 수령",
  EXAM_CLINIC_SELECTED: "특진병원 선택 완료",
  EXAM_SCHEDULED: "특진 일정 확정",
  IN_EXAM: "특진 진행 중",
  EXAM_DONE: "특진 완료",
  DETAILED_EXAM_IN_PROGRESS: "정밀 진행 중",
  DETAILED_EXAM_DONE: "정밀 완료",
  EXPERT_REQUESTED: "전문 의뢰",
  EXPERT_CLINIC_SELECTED: "전문조사기관 선택 완료",
  EXPERT_DONE: "전문조사 완료",
  BANK_REQUESTED: "통장사본 요청",
  BANK_SUBMITTED: "통장사본 제출",
  DECISION_RECEIVED: "결정통지서 수령",
  REVIEWING: "검토 중",
  INFO_REQUESTED: "정보공개청구 중",
  APPROVED: "승인",
  REJECTED: "불승인",
  RETURNED: "반려",
  ON_HOLD: "보류",
  DISCARDED: "파기",
  DISPOSED: "처분 완료",
  MEASUREMENT_FAIL: "수치 미달",
  JOB_HISTORY_FAIL: "직력 미달",
  REAPPLY_AVAILABLE: "재신청 가능",
  IN_TREATMENT: "요양 중",
  TREATMENT_CLOSED: "요양 종결",
  DISABILITY_APPROVED: "장해 승인",
  IN_PROGRESS: "진행 중",
  CLOSED: "종결",
  OBJECTION: "이의제기",
  WAGE_CORRECTION: "평균임금 정정",
};

// ─────────────────────────────────────────────────────────────────────────
// 색상 (단일 레이어 — 영문 enum 키 기준)
// ─────────────────────────────────────────────────────────────────────────

export type StatusColor = { bg: string; color: string; border: string; dot: string };

const _DEFAULT_COLOR: StatusColor = { bg: "#1e293b", color: "#94a3b8", border: "#475569", dot: "#64748b" };

const ENUM_TO_COLOR: Partial<Record<CaseStatusEnum, StatusColor>> = {
  // 초기 단계 - 회색/연보라
  CONSULTING:              { bg: "#475569", color: "#fff", border: "#64748b", dot: "#64748b" },
  RECEIVED:                { bg: "#DCEEFA", color: "#1480B0", border: "#50BDEA", dot: "#29ABE2" },
  WAITING_FIRST_CLINIC:    { bg: "#7c3aed", color: "#fff", border: "#8b5cf6", dot: "#8b5cf6" },

  // 약정/서류 단계 - 파랑
  CONTRACTED:              { bg: "#2563eb", color: "#fff", border: "#3b82f6", dot: "#3b82f6" },
  DOC_COLLECTING:          { bg: "#0284c7", color: "#fff", border: "#0ea5e9", dot: "#0ea5e9" },
  SUBMITTED:               { bg: "#29ABE2", color: "#fff", border: "#1d9fd0", dot: "#1d9fd0" },

  // 특진/정밀 단계 - 청록~초록
  EXAM_REQUESTED:          { bg: "#0d9488", color: "#fff", border: "#14b8a6", dot: "#14b8a6" },
  EXAM_CLINIC_SELECTED:    { bg: "#059669", color: "#fff", border: "#10b981", dot: "#10b981" },
  EXAM_SCHEDULED:          { bg: "#16a34a", color: "#fff", border: "#22c55e", dot: "#22c55e" },
  IN_EXAM:                 { bg: "#D0EAD9", color: "#006838", border: "#00854A", dot: "#006838" },
  EXAM_DONE:               { bg: "#D0EAD9", color: "#006838", border: "#00854A", dot: "#006838" },
  DETAILED_EXAM_IN_PROGRESS:{ bg: "#D0EAD9", color: "#006838", border: "#00854A", dot: "#006838" },
  DETAILED_EXAM_DONE:      { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", dot: "#F59E0B" },

  // 전문조사 단계 - 보라
  EXPERT_REQUESTED:        { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", dot: "#F59E0B" },
  EXPERT_CLINIC_SELECTED:  { bg: "#6d28d9", color: "#fff", border: "#7c3aed", dot: "#7c3aed" },
  EXPERT_DONE:             { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", dot: "#F59E0B" },

  // 결정/검토 단계 - 주황~노랑
  BANK_REQUESTED:          { bg: "#ea580c", color: "#fff", border: "#f97316", dot: "#f97316" },
  BANK_SUBMITTED:          { bg: "#dc2626", color: "#fff", border: "#ef4444", dot: "#ef4444" },
  DECISION_RECEIVED:       { bg: "#b45309", color: "#fff", border: "#d97706", dot: "#d97706" },
  REVIEWING:               { bg: "#92400e", color: "#fff", border: "#b45309", dot: "#b45309" },
  INFO_REQUESTED:          { bg: "#0e7490", color: "#fff", border: "#0891b2", dot: "#0891b2" },

  // 처분 결과
  APPROVED:                { bg: "#E8F5D0", color: "#5A8A1F", border: "#A2D158", dot: "#8DC63F" },
  REJECTED:                { bg: "#FEF2F2", color: "#b91c1c", border: "#FECACA", dot: "#EF4444" },
  RETURNED:                { bg: "#FEF2F2", color: "#b91c1c", border: "#FECACA", dot: "#EF4444" },
  ON_HOLD:                 { bg: "#F1F5F9", color: "#64748B", border: "#CBD5E1", dot: "#94A3B8" },
  DISCARDED:               { bg: "#F1F5F9", color: "#64748B", border: "#CBD5E1", dot: "#94A3B8" },
  DISPOSED:                { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D", dot: "#F59E0B" },

  // COPD 특화
  MEASUREMENT_FAIL:        { bg: "#FEE2E2", color: "#991b1b", border: "#fecaca", dot: "#dc2626" },
  JOB_HISTORY_FAIL:        { bg: "#FEE2E2", color: "#991b1b", border: "#fecaca", dot: "#dc2626" },
  REAPPLY_AVAILABLE:       { bg: "#FEF9C3", color: "#854d0e", border: "#fde68a", dot: "#eab308" },

  // MUSCULO/OCC_ACC 특화
  IN_TREATMENT:            { bg: "#D0EAD9", color: "#006838", border: "#00854A", dot: "#006838" },
  TREATMENT_CLOSED:        { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1", dot: "#64748b" },
  DISABILITY_APPROVED:     { bg: "#E8F5D0", color: "#5A8A1F", border: "#A2D158", dot: "#8DC63F" },

  // 일반 진행
  IN_PROGRESS:             { bg: "#D0EAD9", color: "#006838", border: "#00854A", dot: "#006838" },

  // 종결/이의제기
  CLOSED:                  { bg: "#374151", color: "#9ca3af", border: "#4b5563", dot: "#4b5563" },
  OBJECTION:               { bg: "#FFE4E6", color: "#9f1239", border: "#fda4af", dot: "#e11d48" },
  WAGE_CORRECTION:         { bg: "#0e7490", color: "#fff", border: "#0891b2", dot: "#0891b2" },
};

// ─────────────────────────────────────────────────────────────────────────
// 우선순위 (회차 reduce에서 사용 — copd-status.ts의 STATUS_PRIORITY 대체)
// ─────────────────────────────────────────────────────────────────────────

export const ENUM_STATUS_PRIORITY: Record<CaseStatusEnum, number> = {
  CONSULTING: 0,
  RECEIVED: 1,
  WAITING_FIRST_CLINIC: 1,
  CONTRACTED: 1,
  DOC_COLLECTING: 1,
  SUBMITTED: 1,
  EXAM_REQUESTED: 2,
  EXAM_CLINIC_SELECTED: 2,
  EXAM_SCHEDULED: 2,
  IN_EXAM: 2,
  EXAM_DONE: 3,
  DETAILED_EXAM_IN_PROGRESS: 2,
  DETAILED_EXAM_DONE: 3,
  EXPERT_REQUESTED: 4,
  EXPERT_CLINIC_SELECTED: 4,
  EXPERT_DONE: 5,
  BANK_REQUESTED: 5,
  BANK_SUBMITTED: 5,
  DECISION_RECEIVED: 5,
  REVIEWING: 5,
  INFO_REQUESTED: 5,
  MEASUREMENT_FAIL: 6,
  JOB_HISTORY_FAIL: 6,
  REAPPLY_AVAILABLE: 6,
  ON_HOLD: 7,
  OBJECTION: 7,
  RETURNED: 8,
  REJECTED: 8,
  IN_PROGRESS: 8,
  IN_TREATMENT: 9,
  TREATMENT_CLOSED: 9,
  APPROVED: 10,
  DISABILITY_APPROVED: 10,
  DISPOSED: 10,
  WAGE_CORRECTION: 10,
  CLOSED: 11,
  DISCARDED: 11,
};

// ─────────────────────────────────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────────────────────────────────

/**
 * 임의 status 값(영문 enum 또는 한글)을 영문 enum으로 정규화.
 * - 매칭 실패 시 원본 그대로 반환 (forward-compat)
 */
export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "CONSULTING";
  // 이미 영문 enum이면 그대로
  if ((CASE_STATUS_ENUM as readonly string[]).includes(status)) return status;
  // 한글 매핑 시도
  const mapped = KOREAN_TO_ENUM[status.trim()];
  if (mapped) return mapped;
  // 알 수 없는 값 — 원본 그대로 (UI에서는 fallback 처리)
  return status;
}

/**
 * status 영문 enum 또는 한글을 한글 라벨로 변환 (UI 표시용).
 */
export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  const normalized = normalizeStatus(status);
  if (normalized in ENUM_TO_LABEL) {
    return ENUM_TO_LABEL[normalized as CaseStatusEnum];
  }
  // 한글 그대로 입력된 경우 — 그대로 표시
  return status;
}

/**
 * status를 받아 색상 객체 반환 (영문 enum/한글 모두 지원).
 */
export function getStatusColor(status: string | null | undefined): StatusColor {
  if (!status) return _DEFAULT_COLOR;
  const normalized = normalizeStatus(status);
  if (normalized in ENUM_TO_COLOR) {
    return ENUM_TO_COLOR[normalized as CaseStatusEnum] ?? _DEFAULT_COLOR;
  }
  return _DEFAULT_COLOR;
}

/**
 * status 우선순위 — STATUS_PRIORITY reduce에서 사용.
 * 영문 enum/한글 모두 지원.
 */
export function getStatusPriority(status: string | null | undefined): number {
  if (!status) return -1;
  const normalized = normalizeStatus(status);
  if (normalized in ENUM_STATUS_PRIORITY) {
    return ENUM_STATUS_PRIORITY[normalized as CaseStatusEnum];
  }
  return -1;
}
