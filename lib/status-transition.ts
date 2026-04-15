/**
 * 소음성 난청 사건 상태 자동 전이 규칙
 *
 * 데이터 입력 시 현재 상태보다 "앞선" 상태로는 전이하지 않으며,
 * 현재 상태보다 한 단계 다음 상태로만 자동 전이합니다.
 */

// 소음성 난청 상태 순서 (진행 흐름)
const HL_STATUS_ORDER = [
  "CONSULTING",
  "WAITING_FIRST_CLINIC",
  "CONTRACTED",
  "DOC_COLLECTING",
  "SUBMITTED",
  "EXAM_REQUESTED",
  "EXAM_CLINIC_SELECTED",
  "EXAM_SCHEDULED",
  "IN_EXAM",
  "EXAM_DONE",
  "EXPERT_REQUESTED",
  "EXPERT_CLINIC_SELECTED",
  "EXPERT_DONE",
  "BANK_REQUESTED",
  "BANK_SUBMITTED",
  "DECISION_RECEIVED",
  "REVIEWING",
  "INFO_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CLOSED",
] as const;

type StatusTransitionRule = {
  /** 이 필드에 값이 있으면 (truthy) */
  field: string;
  /** 이 상태에서 */
  from: string;
  /** 이 상태로 전이 */
  to: string;
};

/**
 * Case 모델 필드 기반 전이 규칙 (contractDate 등)
 */
export const CASE_FIELD_RULES: StatusTransitionRule[] = [
  { field: "contractDate", from: "CONSULTING", to: "CONTRACTED" },
  { field: "contractDate", from: "WAITING_FIRST_CLINIC", to: "CONTRACTED" },
];

/**
 * HearingLossDetail 모델 필드 기반 전이 규칙
 */
export const HL_DETAIL_RULES: StatusTransitionRule[] = [
  // 접수
  { field: "claimSubmittedAt", from: "DOC_COLLECTING", to: "SUBMITTED" },
  { field: "claimSubmittedAt", from: "CONTRACTED", to: "SUBMITTED" },

  // 특진 진찰요구서 수령
  { field: "examRequestReceivedAt", from: "SUBMITTED", to: "EXAM_REQUESTED" },

  // 특진병원 선택
  { field: "specialClinic", from: "EXAM_REQUESTED", to: "EXAM_CLINIC_SELECTED" },

  // 특진 일정 확정
  { field: "specialExam1Date", from: "EXAM_CLINIC_SELECTED", to: "EXAM_SCHEDULED" },

  // 전문조사요구서 수령
  { field: "expertRequestReceivedAt", from: "EXAM_DONE", to: "EXPERT_REQUESTED" },

  // 전문조사기관 선택
  { field: "expertClinic", from: "EXPERT_REQUESTED", to: "EXPERT_CLINIC_SELECTED" },

  // 통장사본 요청
  { field: "bankAccountRequestedAt", from: "EXPERT_DONE", to: "BANK_REQUESTED" },
  { field: "bankAccountRequestedAt", from: "EXPERT_CLINIC_SELECTED", to: "BANK_REQUESTED" },

  // 통장사본 제출
  { field: "bankAccountSubmittedAt", from: "BANK_REQUESTED", to: "BANK_SUBMITTED" },

  // 결정통지서 수령
  { field: "decisionReceivedAt", from: "BANK_SUBMITTED", to: "DECISION_RECEIVED" },
  { field: "decisionReceivedAt", from: "BANK_REQUESTED", to: "DECISION_RECEIVED" },
  { field: "decisionReceivedAt", from: "EXPERT_DONE", to: "DECISION_RECEIVED" },
];

function statusIndex(status: string): number {
  return HL_STATUS_ORDER.indexOf(status as typeof HL_STATUS_ORDER[number]);
}

/**
 * 데이터 변경 사항을 바탕으로 다음 상태를 추론합니다.
 *
 * @param currentStatus 현재 사건(Case)의 status
 * @param changedFields 변경된 필드 목록 (key: 필드명, value: 새 값)
 * @param rules 적용할 전이 규칙 배열
 * @returns 새로운 상태 (변경 없으면 null)
 */
export function inferNextStatus(
  currentStatus: string,
  changedFields: Record<string, unknown>,
  rules: StatusTransitionRule[]
): string | null {
  const currentIdx = statusIndex(currentStatus);

  // 터미널 상태 (APPROVED, REJECTED, CLOSED 등)에서는 자동 전이하지 않음
  if (currentIdx < 0) return null;

  let bestCandidate: { status: string; index: number } | null = null;

  for (const rule of rules) {
    // 현재 상태가 rule.from과 일치하는지 확인
    if (currentStatus !== rule.from) continue;

    // 변경된 필드에 해당 필드가 있고 truthy한지 확인
    const val = changedFields[rule.field];
    if (val === undefined || val === null || val === "" || val === false) continue;

    const targetIdx = statusIndex(rule.to);
    // 현재보다 앞으로 나아가는 전이만 허용
    if (targetIdx <= currentIdx) continue;

    // 가장 멀리 나아가는 전이를 선택
    if (!bestCandidate || targetIdx > bestCandidate.index) {
      bestCandidate = { status: rule.to, index: targetIdx };
    }
  }

  return bestCandidate?.status ?? null;
}
