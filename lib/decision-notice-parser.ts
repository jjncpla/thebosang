/**
 * 근로복지공단 요양·보험급여 결정통지서 OCR 텍스트 파서 (별지 제6호 서식)
 *
 * 입력: Document AI 또는 Tesseract OCR 후의 평문 텍스트
 * 출력: 구조화된 결정통지서 데이터
 *
 * 양식 구조 (별지 제6호 서식):
 *  - 발신: 근로복지공단 OOO지사
 *  - 수신: 받는사람 (재해자) + 우편번호
 *  - 산재보험관리번호 / 사업개시번호
 *  - (1) 의료기관명 (의료기관번호)
 *  - (2) 의료기관 변경시(특진시)의료기관명
 *  - (3) 상병명 + ICD코드 [승인]/[불승인]
 *  - (4) 결정내용 (요양기간 / 입원·통원 일수)
 *  - (5) 불승인·반려·삭감 사유
 *  - (6) 통지사항 (수수료지급 타당여부 등)
 *  - 결정일 (YYYY년 MM월 DD일)
 *
 * 참고: 본 파서는 "요양급여 결정통지서" 전용. 휴업급여/장해/유족 등 금액 지급
 *       결정통지서는 lib/notice-parser.ts 사용.
 *
 * 분석 근거: docs/forms-learning/결정통지서_OCR_정확도_비교.md
 */

export type ResolutionStatus = "APPROVED" | "REJECTED" | "PARTIAL" | "UNKNOWN";

export type DiseaseCategory =
  | "HEARING_LOSS"        // 소음성 난청
  | "PNEUMOCONIOSIS"      // 진폐
  | "COPD"                // 만성폐쇄성폐질환
  | "LUNG_CANCER"         // 폐암 (직업성)
  | "MUSCULOSKELETAL"     // 근골격계
  | "GENERAL"             // 기타 일반산재
  | "UNKNOWN";

export interface ParsedResolutionNotice {
  // 양식 식별 (필수)
  isResolutionNotice: boolean;

  // === Confidence 높음 (자동 인입 권장 — Tesseract도 70%+ 추출) ===
  decisionDate: string | null;        // YYYY-MM-DD (결정일/통지일)
  comwelBranch: string | null;        // 근로복지공단 OOO지사
  zipcode: string | null;             // 5자리 우편번호
  mgmtNo: string | null;              // 산재보험관리번호 (XXX-XX-XXXXX-X)
  resultStatus: ResolutionStatus;     // 승인/불승인 마커

  // === Confidence 중간 (자동 인입 + 사용자 확인 권장) ===
  workerName: string | null;          // 받는사람 (재해자명)
  medicalInstName: string | null;     // 의료기관명
  medicalInstNo: string | null;       // 의료기관번호
  diagnosisName: string | null;       // 상병명 (괄호 안 코드 제외)
  icdCode: string | null;             // ICD-10 코드 (J44 등)
  treatmentStartDate: string | null;  // 요양시작일 YYYY-MM-DD
  treatmentEndDate: string | null;    // 요양종료일 YYYY-MM-DD

  // === Confidence 낮음 (사용자 입력 권장) ===
  rejectionReason: string | null;     // 불승인 사유 (자유 텍스트)
  decisionDetail: string | null;      // 결정내용 상세 (입원/통원 일수)
  feeNotice: string | null;           // 수수료지급 타당여부 등

  // === 파생 ===
  diseaseCategory: DiseaseCategory;   // 양식·문맥 기반 추정

  // === 메타 ===
  warnings: string[];                 // 추출 실패/주의사항
  confidence: "HIGH" | "MEDIUM" | "LOW"; // 자동 인입 신뢰도 종합 점수

  // 디버깅
  rawText?: string;
}

/* ═══════════════════════════════════════════════════════════════
   정규식 (분석 보고서 기반 추출률 70%+ 보장)
   docs/forms-learning/결정통지서_OCR_정확도_비교.md 참조
   ═══════════════════════════════════════════════════════════════ */

// 결정통지서 양식 식별 — Tesseract OCR이 "결정통지서"를 "결정통 |서" / "결정통" 처럼
// 깨뜨리는 경우가 흔함. 다음 중 하나라도 매칭되면 결정통지서로 간주:
//   - "결정통지" (지서 누락 허용)
//   - "급여결정" + 인근 "통지/통" (보험급여결정통지서의 부분)
//   - "진폐정밀진단/진난" (진폐정밀진단 결정통지서)
//   - "별지 제6호" (서식 번호 매칭)
//   - "(3) 상병명" + "결정내용" 동시 출현
const RX_NOTICE_KEYWORD = /결\s*정\s*통\s*지|급\s*여\s*결\s*정|진폐\s*정\s*밀\s*진[단난]|별\s*지\s*제\s*6\s*호|상병명\s*[:：][\s\S]{0,120}?결정내용/;

// 결정일은 본문 내 "위와 같이 결정하여 통지합니다" 직전·직후의 YYYY년 MM월 DD일이
// 가장 정확. 일반 YYYY년 MM월 DD일은 폴백.
const RX_DECISION_DATE_PRIMARY = /(?:결정하여\s*통지|결정하여\s*EAT|결정하여\s*BAY)[\s\S]{0,200}?(20\d{2})\s*[년\.]\s*(\d{1,2})\s*[월\.]\s*(\d{1,2})\s*[일\.]?|(20\d{2})\s*[년\.]\s*(\d{1,2})\s*[월\.]\s*(\d{1,2})\s*[일\.]?[\s\S]{0,80}?결정하여\s*통지/;
const RX_DECISION_DATE = /(20\d{2})\s*[년\.]\s*(\d{1,2})\s*[월\.]\s*(\d{1,2})\s*[일\.]?/g;

const RX_COMWEL_BRANCH = /근\s*로\s*복\s*지\s*공\s*단\s*([가-힣]{2,8}(?:지사|지역본부))/;

// 우편번호: 5자리 연속 숫자 (앞뒤 숫자 없음)
const RX_ZIPCODE = /(?<!\d)([0-9]{5})(?!\d)/;

const RX_MGMT_NO = /(\d{3}[-‐]\s*\d{2}[-‐]\s*\d{5}[-‐]\s*\d)/;

// [승인] / [ 승 인 ] 마커
const RX_APPROVED = /\[\s*승\s*인\s*\]|승\s*인\s*\(20|결정내용\s*[:：]?\s*승\s*인|나\.\s*결정내용\s*[:：]?\s*승\s*인/;
// 불승인 마커 — 단, 양식 템플릿 "(5) 불승인, 반려 또는 삭감사유 :" 뒤에 내용이 있을 때만.
// 빈 라벨은 제외.
const RX_REJECTED = /\[\s*불\s*승\s*인\s*\]|불\s*승\s*인\s*\(20|결정내용\s*[:：]?\s*불\s*승\s*인|나\.\s*결정내용\s*[:：]?\s*불\s*승\s*인|부\s*지\s*급|기\s*각|반\s*려\s*$|미\s*충\s*족/m;
// 양식 템플릿의 빈 라벨 ((5) 불승인 사유 : 다음 내용 없음) 검출용
const RX_REJECTION_TEMPLATE_LABEL = /\(?\s*5\s*\)\s*불승인[\s\S]*?사유[\s\S]*?[:：]\s*([\s\S]{0,40})/;

// 의료기관명 + 번호: "굿모닐병뭔 (1-007722)" 형식
const RX_MEDICAL_INST = /\(?\s*1\s*\)\s*의료기관명\s*[:：]?\s*([^\(\n]{2,20})\s*\(\s*(\d[\s\d\-]+\d)\s*\)/;
const RX_MEDICAL_INST_FALLBACK = /의료기관(?:\s*번호)?\s*[:：]?\s*\(?\s*(\d[\s\d\-]+\d)\s*\)/;

// 상병명: "(3) 상병명 : 만성 폐쇄성 폐질환 NOS, 중등도 [승인] (2026.04.06)"
const RX_DIAGNOSIS = /\(?\s*3\s*\)\s*상\s*병\s*명\s*[:：]?\s*([^\[\n]{2,80}?)(?=\s*\[|\s*\(20|\s*$)/;

// ICD-10 코드 (괄호 안 영문 1글자 + 숫자 2-4자리)
const RX_ICD_CODE = /[\(\[]\s*([HJMSTI]\d{2,4}(?:\.\d+)?)\s*[\)\]]/;

// 요양기간: "요양기간 : 2024-11-04 ~ 2025-02-17"
// OCR이 "요양"을 "요얄"/"요알"로 오인식하는 경우가 있어 첫 글자만 고정
const RX_TREATMENT_PERIOD = /요\s*[양얄알]\s*기\s*간\s*[:：]?\s*(20\d{2}[-\.]\s*\d{1,2}[-\.]\s*\d{1,2})\s*~\s*(20\d{2}[-\.]\s*\d{1,2}[-\.]\s*\d{1,2})/;

// 받는사람: "받는사람 : 광상문 귀중"
const RX_RECIPIENT = /받\s*는\s*사\s*람\s*[:：]?\s*([가-힣]{2,5})\s*[귀님]/;

// 결정내용 상세: "통원1일[2025.08.14-2025.08.14]" 등
const RX_DECISION_DETAIL = /(?:입원|통원|입원\s*\d+일|통원\s*\d+일)[\d\[\]\.\-\s]+/g;

// 수수료지급 등 통지사항
const RX_FEE_NOTICE = /\[\s*수수료지급[\s\S]*?\]/;

/* ═══════════════════════════════════════════════════════════════
   유틸리티
   ═══════════════════════════════════════════════════════════════ */

function normalizeDate(year: string, month: string, day: string): string {
  const y = year.padStart(4, "0");
  const m = month.padStart(2, "0");
  const d = day.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDashedDate(s: string): string | null {
  // "2024-11-04" / "2024.11.04" / "2024-11- 04" → "2024-11-04"
  const m = s.match(/(20\d{2})[-\.]\s*(\d{1,2})[-\.]\s*(\d{1,2})/);
  if (!m) return null;
  return normalizeDate(m[1], m[2], m[3]);
}

function inferDiseaseCategory(text: string, diagnosisName: string | null): DiseaseCategory {
  const checkText = `${text}\n${diagnosisName ?? ""}`;
  if (/소음성\s*난청|감각신경성\s*난청|noise.induced\s*hearing|청력장해/i.test(checkText)) return "HEARING_LOSS";
  if (/진\s*폐|진폐정밀진[단난]|pneumoconiosis/i.test(checkText)) return "PNEUMOCONIOSIS";
  if (/만성\s*폐쇄성\s*폐질환|만성폐쇄성폐질환|폐쇄성\s*페질환|COPD/i.test(checkText)) return "COPD";
  if (/폐\s*암|lung\s*cancer/i.test(checkText)) return "LUNG_CANCER";
  if (/근골격|관절증|디스크|척추|회전근개|어깨\s*손상|요추간판|경추간판/i.test(checkText)) return "MUSCULOSKELETAL";
  if (/요양\s*[\.·,ㆍ]?\s*보험급여\s*결정|요양기간/.test(checkText)) return "GENERAL";
  return "UNKNOWN";
}

function evaluateConfidence(p: ParsedResolutionNotice): "HIGH" | "MEDIUM" | "LOW" {
  // Confidence 높음 5개 필드 중 몇 개 추출되었는지
  const highConf = [
    p.decisionDate,
    p.comwelBranch,
    p.zipcode,
    p.mgmtNo,
    p.resultStatus !== "UNKNOWN" ? "ok" : null,
  ].filter(Boolean).length;
  if (highConf >= 4) return "HIGH";
  if (highConf >= 2) return "MEDIUM";
  return "LOW";
}

/* ═══════════════════════════════════════════════════════════════
   메인 파서
   ═══════════════════════════════════════════════════════════════ */

export function parseResolutionNotice(rawText: string): ParsedResolutionNotice {
  const text = rawText.replace(/[ \t]+/g, " ");

  // 1. 양식 식별
  const isResolutionNotice = RX_NOTICE_KEYWORD.test(text);
  if (!isResolutionNotice) {
    return {
      isResolutionNotice: false,
      decisionDate: null,
      comwelBranch: null,
      zipcode: null,
      mgmtNo: null,
      resultStatus: "UNKNOWN",
      workerName: null,
      medicalInstName: null,
      medicalInstNo: null,
      diagnosisName: null,
      icdCode: null,
      treatmentStartDate: null,
      treatmentEndDate: null,
      rejectionReason: null,
      decisionDetail: null,
      feeNotice: null,
      diseaseCategory: "UNKNOWN",
      warnings: ["양식 식별 실패: '결정통지서' 키워드 없음"],
      confidence: "LOW",
      rawText,
    };
  }

  const warnings: string[] = [];

  // === Confidence 높음 ===

  // 2. 결정일 — "결정하여 통지" 인접 날짜를 우선, 없으면 마지막 발견 날짜
  let decisionDate: string | null = null;
  const primaryDateMatch = text.match(RX_DECISION_DATE_PRIMARY);
  if (primaryDateMatch) {
    // group 1-3 또는 4-6에서 추출
    const y = primaryDateMatch[1] ?? primaryDateMatch[4];
    const m = primaryDateMatch[2] ?? primaryDateMatch[5];
    const d = primaryDateMatch[3] ?? primaryDateMatch[6];
    if (y && m && d) decisionDate = normalizeDate(y, m, d);
  }
  if (!decisionDate) {
    // 모든 날짜 중 마지막 (대개 본문 하단의 결정일)
    const allDates = Array.from(text.matchAll(RX_DECISION_DATE));
    if (allDates.length > 0) {
      const last = allDates[allDates.length - 1];
      decisionDate = normalizeDate(last[1], last[2], last[3]);
    }
  }
  if (!decisionDate) warnings.push("결정일 추출 실패");

  // 3. 공단지사
  const branchMatch = text.match(RX_COMWEL_BRANCH);
  const comwelBranch = branchMatch ? `근로복지공단 ${branchMatch[1]}` : null;
  if (!comwelBranch) warnings.push("공단지사 추출 실패");

  // 4. 우편번호
  const zipMatch = text.match(RX_ZIPCODE);
  const zipcode = zipMatch ? zipMatch[1] : null;

  // 5. 산재보험관리번호
  const mgmtMatch = text.match(RX_MGMT_NO);
  const mgmtNo = mgmtMatch ? mgmtMatch[1].replace(/\s+/g, "") : null;

  // 6. 결정구분 (승인/불승인)
  // 양식 템플릿 "(5) 불승인 사유 :"는 빈 라벨 가능 → 라벨 뒤에 의미있는 내용이 있는지 확인
  let resultStatus: ResolutionStatus = "UNKNOWN";
  const isApproved = RX_APPROVED.test(text);
  const isRejected = RX_REJECTED.test(text);

  // 템플릿 라벨 뒤에 실제 사유가 있는지 (양식 빈 칸인지) 검사
  const rejTemplate = text.match(RX_REJECTION_TEMPLATE_LABEL);
  const hasRejectionContent = rejTemplate
    ? rejTemplate[1].trim().length > 5 // 5글자 이상이면 실제 내용 있다고 판단
    : false;

  if (isApproved && !isRejected) {
    resultStatus = "APPROVED";
  } else if (isApproved && hasRejectionContent) {
    // [승인]도 [불승인]도 둘 다 있고, 사유 라벨에 실제 내용 → 부분 승인
    resultStatus = "PARTIAL";
  } else if (isApproved) {
    // [승인] 마커 있고 사유 라벨은 빈칸 → 단순 승인
    resultStatus = "APPROVED";
  } else if (isRejected || hasRejectionContent) {
    resultStatus = "REJECTED";
  }
  if (resultStatus === "UNKNOWN") warnings.push("결정구분(승인/불승인) 추출 실패");

  // === Confidence 중간 ===

  // 7. 받는사람 (재해자명)
  const recipMatch = text.match(RX_RECIPIENT);
  const workerName = recipMatch ? recipMatch[1].trim() : null;

  // 8. 의료기관명/번호
  let medicalInstName: string | null = null;
  let medicalInstNo: string | null = null;
  const instMatch = text.match(RX_MEDICAL_INST);
  if (instMatch) {
    medicalInstName = instMatch[1].trim();
    medicalInstNo = instMatch[2].replace(/\s+/g, "");
  } else {
    const fb = text.match(RX_MEDICAL_INST_FALLBACK);
    if (fb) medicalInstNo = fb[1].replace(/\s+/g, "");
  }

  // 9. 상병명 + ICD 코드
  let diagnosisName: string | null = null;
  const dxMatch = text.match(RX_DIAGNOSIS);
  if (dxMatch) {
    diagnosisName = dxMatch[1]
      .replace(/^[\d\s\.,]+/, "") // OCR 노이즈 제거 (앞쪽 숫자/공백/콤마)
      .trim();
  }
  const icdMatch = text.match(RX_ICD_CODE);
  const icdCode = icdMatch ? icdMatch[1] : null;

  // 10. 요양기간
  let treatmentStartDate: string | null = null;
  let treatmentEndDate: string | null = null;
  const periodMatch = text.match(RX_TREATMENT_PERIOD);
  if (periodMatch) {
    treatmentStartDate = normalizeDashedDate(periodMatch[1]);
    treatmentEndDate = normalizeDashedDate(periodMatch[2]);
  }

  // === Confidence 낮음 ===

  // 11. 결정내용 상세 (입원/통원 일수)
  const detailMatches = text.match(RX_DECISION_DETAIL);
  const decisionDetail = detailMatches ? detailMatches.join(" ").trim() : null;

  // 12. 통지사항 (수수료지급 등)
  const feeMatch = text.match(RX_FEE_NOTICE);
  const feeNotice = feeMatch ? feeMatch[0] : null;

  // 13. 불승인 사유 — 거부된 경우에만 의미 있음. 자유서술이라 정밀 추출 어려움
  let rejectionReason: string | null = null;
  if (resultStatus === "REJECTED" || resultStatus === "PARTIAL") {
    // (5) 불승인, 반려 또는 삭감사유 : ... 패턴 시도
    const reasonMatch = text.match(/\(?\s*5\s*\)\s*불승인[^:：]*[:：]\s*([^\n]{1,200})/);
    if (reasonMatch && reasonMatch[1].trim().length > 2) {
      rejectionReason = reasonMatch[1].trim();
    }
  }

  // === 파생 ===
  const diseaseCategory = inferDiseaseCategory(text, diagnosisName);

  const result: ParsedResolutionNotice = {
    isResolutionNotice: true,
    decisionDate,
    comwelBranch,
    zipcode,
    mgmtNo,
    resultStatus,
    workerName,
    medicalInstName,
    medicalInstNo,
    diagnosisName,
    icdCode,
    treatmentStartDate,
    treatmentEndDate,
    rejectionReason,
    decisionDetail,
    feeNotice,
    diseaseCategory,
    warnings,
    confidence: "LOW", // 아래에서 갱신
    rawText,
  };
  result.confidence = evaluateConfidence(result);

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   트리거 룰: 자동 인입 가능 여부 판정
   ═══════════════════════════════════════════════════════════════ */

export interface AutoIngestDecision {
  canAutoIngest: boolean;          // 자동 인입 가능 여부
  requiresUserReview: boolean;     // 사용자 확인 필수 (자동이지만 알림)
  blockedReason: string | null;    // 자동 인입 차단 사유
}

export function evaluateAutoIngest(parsed: ParsedResolutionNotice): AutoIngestDecision {
  if (!parsed.isResolutionNotice) {
    return {
      canAutoIngest: false,
      requiresUserReview: true,
      blockedReason: "결정통지서 양식 식별 실패 — 다른 양식 가능성",
    };
  }

  // Confidence HIGH: Confidence 높음 5개 필드 중 4개 이상 추출 → 자동 인입
  if (parsed.confidence === "HIGH") {
    // 단, 재해자명·상병명 같은 중요 필드가 빠지면 사용자 확인 필요
    const requiresReview =
      !parsed.workerName ||
      !parsed.diagnosisName ||
      parsed.resultStatus === "UNKNOWN";
    return {
      canAutoIngest: true,
      requiresUserReview: requiresReview,
      blockedReason: null,
    };
  }

  // Confidence MEDIUM: 자동 인입은 하되 사용자 검토 필수
  if (parsed.confidence === "MEDIUM") {
    return {
      canAutoIngest: true,
      requiresUserReview: true,
      blockedReason: null,
    };
  }

  // Confidence LOW: 핵심 필드 추출 실패 → 자동 인입 차단
  return {
    canAutoIngest: false,
    requiresUserReview: true,
    blockedReason: "OCR 추출 신뢰도 낮음 — 사용자 수기 입력 권장",
  };
}
