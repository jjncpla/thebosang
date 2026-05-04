// 근로복지공단 소속병원 (COPD 특진 가능 의료기관)
// — 특진은 공단 소속 산재병원에서만 진행
export const KWC_HOSPITALS = [
  "창원병원",
  "안산병원",
  "인천병원",
  "대구병원",
  "태백병원",
  "동해병원",
  "정선병원",
  "순천병원",
  "경기요양병원",
  "중랑요양병원",
] as const;

export type KwcHospital = (typeof KWC_HOSPITALS)[number];

// 흡연 상태
export const SMOKING_STATUS = ["현재흡연", "금연", "비흡연"] as const;

// 특진 결과
export const COPD_EXAM_RESULT = ["수치미달", "기준내", "재실시"] as const;

// 처분 종류 (요양)
export const COPD_DISPOSAL_TYPE = ["승인", "부지급", "반려", "보류"] as const;

// 장해 처분 종류
export const COPD_DISABILITY_DISPOSITION_TYPE = ["일시금", "연금", "부지급"] as const;

// 질판위 참석 유형
export const OCC_ATTENDANCE_TYPE = ["출석", "서면", "불참"] as const;

// 특진 결과 텍스트 파싱 (엑셀 기존 데이터: "1차 : 율 65 량 84 / 특이사항 : 수치미달")
export function parseExamResultText(text: string): {
  fev1Rate: number | null;
  fev1Volume: number | null;
  note: string | null;
} {
  if (!text) return { fev1Rate: null, fev1Volume: null, note: null };
  const rateMatch = text.match(/율\s*(\d+(?:\.\d+)?)/);
  const volMatch = text.match(/[량양]\s*(\d+(?:\.\d+)?)/);
  const noteMatch = text.match(/특이사항\s*[:：]?\s*([^\/\n]+)/);
  return {
    fev1Rate: rateMatch ? parseFloat(rateMatch[1]) : null,
    fev1Volume: volMatch ? parseFloat(volMatch[1]) : null,
    note: noteMatch ? noteMatch[1].trim() : null,
  };
}
