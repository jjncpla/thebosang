export const CASE_STATUS = [
  "접수대기",
  "접수완료",
  "특진예정",
  "특진중",
  "특진완료",
  "재특진예정",
  "재특진중",
  "재특진완료",
  "재재특진예정",
  "재재특진중",
  "재재특진완료",
  "전문예정",
  "전문완료",
  "승인",
  "불승인",
  "반려",
  "보류",
  "파기",
] as const;

export type CaseStatus = typeof CASE_STATUS[number];

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
