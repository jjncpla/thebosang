export const HEARING_LOSS_STATUS = [
  "CONSULTING", "WAITING_FIRST_CLINIC", "CONTRACTED", "DOC_COLLECTING", "SUBMITTED",
  "EXAM_REQUESTED", "EXAM_CLINIC_SELECTED", "EXAM_SCHEDULED", "IN_EXAM", "EXAM_DONE",
  "EXPERT_REQUESTED", "EXPERT_CLINIC_SELECTED", "EXPERT_DONE",
  "BANK_REQUESTED", "BANK_SUBMITTED", "DECISION_RECEIVED",
  "REVIEWING", "INFO_REQUESTED", "APPROVED", "REJECTED", "CLOSED",
  "OBJECTION", "WAGE_CORRECTION",
] as const;

export const CASE_STATUS_LABELS: Record<string, string> = {
  CONSULTING: "접수 대기",
  WAITING_FIRST_CLINIC: "초진 대기",
  CONTRACTED: "약정 완료",
  DOC_COLLECTING: "서류 수집 중",
  SUBMITTED: "접수 완료",
  EXAM_REQUESTED: "특진진찰요구서 수령",
  EXAM_CLINIC_SELECTED: "특진병원 선택 완료",
  EXAM_SCHEDULED: "특진 일정 확정",
  IN_EXAM: "특진 진행 중",
  EXAM_DONE: "특진 완료",
  EXPERT_REQUESTED: "전문조사요구서 수령",
  EXPERT_CLINIC_SELECTED: "전문조사기관 선택 완료",
  EXPERT_DONE: "전문조사 완료",
  BANK_REQUESTED: "통장사본 요청",
  BANK_SUBMITTED: "통장사본 제출",
  DECISION_RECEIVED: "결정통지서 수령",
  REVIEWING: "검토 중",
  INFO_REQUESTED: "정보공개청구 중",
  APPROVED: "승인",
  REJECTED: "불승인",
  CLOSED: "종결",
  OBJECTION: "이의제기",
  WAGE_CORRECTION: "평균임금 정정",
};

export const MUSCULOSKELETAL_STATUS = [
  "접수대기", "접수완료",
  "전문완료", "질판위의뢰",
  "요양승인", "요양중", "요양종결", "장해승인",
  "불승인", "반려", "기각종결", "송무인계", "이산인계", "파기",
] as const;

export const OCCUPATIONAL_ACCIDENT_STATUS = [...MUSCULOSKELETAL_STATUS] as const;

export const COPD_STATUS = [
  "접수대기", "접수완료",
  "특진중", "특진완료",
  "전문의뢰", "전문완료",
  "승인", "불승인", "수치미달", "재진행가능", "직력미달",
  "반려", "보류", "파기", "이의제기", "종결",
] as const;

export const PNEUMOCONIOSIS_STATUS = [
  "접수대기", "접수완료",
  "정밀진행중", "정밀완료",
  "승인", "불승인", "수치미달", "재진행가능",
  "반려", "보류", "파기",
] as const;

export const GENERAL_STATUS = [
  "접수대기", "접수완료",
  "진행중", "처분완료",
  "승인", "불승인", "반려", "보류", "파기",
] as const;

export const STATUS_BY_CASE_TYPE: Record<string, readonly string[]> = {
  HEARING_LOSS: HEARING_LOSS_STATUS,
  MUSCULOSKELETAL: MUSCULOSKELETAL_STATUS,
  OCCUPATIONAL_ACCIDENT: OCCUPATIONAL_ACCIDENT_STATUS,
  COPD: COPD_STATUS,
  PNEUMOCONIOSIS: PNEUMOCONIOSIS_STATUS,
  OCCUPATIONAL_CANCER: GENERAL_STATUS,
  BEREAVED: GENERAL_STATUS,
  OTHER: GENERAL_STATUS,
};

// 하위 호환용
export const CASE_STATUS = HEARING_LOSS_STATUS;

export type CaseStatus = typeof HEARING_LOSS_STATUS[number];

export const CASE_TYPE_LABELS: Record<string, string> = {
  HEARING_LOSS: "소음성 난청",
  COPD: "COPD",
  PNEUMOCONIOSIS: "진폐",
  MUSCULOSKELETAL: "근골격계",
  OCCUPATIONAL_ACCIDENT: "업무상 사고",
  OCCUPATIONAL_CANCER: "직업성 암",
  BEREAVED: "유족",
  OTHER: "기타",
};

export const DISPOSAL_TYPE = ["승인", "불승인", "반려", "보류", "파기"] as const;
export const GRADE_TYPE = ["일반", "조정", "가중", "준용"] as const;
