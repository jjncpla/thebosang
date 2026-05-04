/**
 * 근로복지공단 결정통지서 OCR 텍스트 파서
 *
 * 지원 결정사항:
 *  - 휴업급여
 *  - 장해일시금 / 장해연금
 *  - 유족연금 / 유족일시금
 *  - 장례비
 *
 * 입력: Document AI OCR 후의 평문 텍스트
 * 출력: 구조화된 결정통지서 데이터
 */

export type DecisionType =
  | "휴업급여"
  | "상병보상연금"
  | "장해일시금"
  | "장해연금"
  | "유족연금"
  | "유족일시금"
  | "장례비"
  | "요양급여"
  | "재요양"
  | "기타";

export interface PaymentPeriod {
  index: number;
  startDate: string | null;   // YYYY-MM-DD
  endDate: string | null;
  wageType: string | null;    // "평균임금" / "장례비 최저금액" 등
  formula: string;            // 산정내역 raw 텍스트
  rate: number | null;        // 70%, 90% 등 (휴업급여)
  reductionLabel: string | null; // "50.0/70.0" 등 (감액 적용 시)
  days: number | null;
  amount: number | null;      // 지급대상 금액
}

export interface ParsedNotice {
  // 메타
  decisionDate: string | null;     // 통지일
  managementNo: string | null;     // 관리번호
  businessRegNo: string | null;    // 사업개시번호
  caseNo: string | null;           // 원부번호
  decisionType: DecisionType;      // 결정사항 (휴업급여 등)
  resultStatus: string | null;     // 처리결과 (지급 등)

  // 산재근로자
  workerName: string | null;
  birthDateRaw: string | null;     // YYMMDD
  birthDate: string | null;        // YYYY-MM-DD (추정)
  accidentDate: string | null;     // YYYY-MM-DD
  businessName: string | null;     // 소속사업장명
  constructionName: string | null; // 공사명

  // 수령인 (유족 등 본인 외)
  recipientName: string | null;
  relation: string | null;         // 본인/배우자/자녀 등

  // 금액
  paymentAmount: number | null;    // 지급결정액
  cumulativeAmount: number | null; // 누계액
  initialAvgWage: number | null;   // 결정통지서 본문 "평균임금 산정 후 최초로 지급되는 급여" — 실제 의미는 최종 증감임금
  originalAvgWage: number | null;  // 재해 당시 산정된 원시 평균임금 (장해급여 산정 기초가 되는 최초 평균임금)

  // 기간별 산정내역
  periods: PaymentPeriod[];

  // 장해일시금/연금 등에서 추출되는 별도 필드
  disabilityGrade: string | null;        // 09급07호 등
  disabilityDays: number | null;         // 385일 등
  disabilityUnitWage: number | null;     // 일당
  disabilityTotalAmount: number | null;  // 장해급여 결정액

  // 청력 정보 (난청 케이스)
  hearingDb: { left: number | null; right: number | null } | null;
  speechDiscrim: { left: number | null; right: number | null } | null;

  // 진폐 등 - 7번 통지사항에 들어가는 수식 (148,079.72 * 616 - 30,257,980)
  legacyDeduction: number | null; // 기수령액 차감

  // 경고/주의사항
  warnings: string[];

  // 디버깅용
  rawText?: string;
}

/* ═══════════════════════════════════════════════════════════════
   유틸리티
   ═══════════════════════════════════════════════════════════════ */

function pickFirst<T>(matches: RegExpMatchArray | null, group = 1): T | null {
  if (!matches || !matches[group]) return null;
  return matches[group] as unknown as T;
}

function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  // "178,850원00전" 또는 "11,392,740원" 또는 "178850.00"
  const m1 = s.match(/^([\d,]+)원\s*(\d{1,2})?\s*전?$/);
  if (m1) {
    const won = parseInt(m1[1].replace(/,/g, ""), 10);
    const jeon = m1[2] ? parseInt(m1[2], 10) / 100 : 0;
    return won + jeon;
  }
  const m2 = s.replace(/[,원전\s]/g, "").match(/^(\d+(\.\d+)?)$/);
  if (m2) return parseFloat(m2[1]);
  return null;
}

function parseAmountWithJeon(s: string | null | undefined): number | null {
  // "178,850원00전" → 178850.00
  if (!s) return null;
  const m = s.match(/([\d,]+)원\s*(\d{1,2})\s*전/);
  if (m) {
    const won = parseInt(m[1].replace(/,/g, ""), 10);
    const jeon = parseInt(m[2], 10) / 100;
    return won + jeon;
  }
  return parseAmount(s);
}

function inferBirthYear(yymmdd: string): string | null {
  // YYMMDD → YYYY-MM-DD (간단 추정: 30년 전~지금까지가 19YY, 그 전은 20YY)
  if (!yymmdd || yymmdd.length !== 6) return null;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // 보통 산재근로자는 1930~2010년생, 주민번호 7번째 자리 정보가 잘렸으니 휴리스틱
  // 50 이상이면 19xx, 50 미만이면 20xx로 가정
  const fullYear = yy >= 30 ? 1900 + yy : 2000 + yy;
  return `${fullYear}-${mm}-${dd}`;
}

/* ═══════════════════════════════════════════════════════════════
   메인 파서
   ═══════════════════════════════════════════════════════════════ */
export function parseDecisionNotice(rawText: string): ParsedNotice {
  // OCR 결과 정리: 다중 공백 → 1개
  const text = rawText.replace(/[ \t]+/g, " ").replace(/ /g, " ");

  const warnings: string[] = [];

  // ── 1. 단순 필드들 ──
  const managementNo = pickFirst<string>(
    text.match(/관\s*리\s*번\s*호[\s:]*([\d-]+)/)
  );
  const businessRegNo = pickFirst<string>(
    text.match(/사업\s*개시\s*번호[\s:]*([\d-]+)/)
  );
  const caseNo = pickFirst<string>(
    text.match(/원\s*부\s*번\s*호[\s:]*(\d+)/)
  );
  const decisionDateMatch = text.match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일/);
  const decisionDate = decisionDateMatch
    ? `${decisionDateMatch[1]}-${decisionDateMatch[2]}-${decisionDateMatch[3]}`
    : null;

  // 산재근로자명: 다양한 양식 지원
  let workerName: string | null = null;
  const namePatterns = [
    /산재근로자명[\s:]+([가-힣]{2,5})(?=\s|$|생년)/,
    /성\s*명[\s:]+([가-힣]{2,5})(?=\s+생년월일)/,
    /산\s*재\s*근로자[\s\S]{0,80}?성\s*명[\s:]+([가-힣]{2,5})/, // 표 형식 (장해통지서)
    /^([가-힣]{2,5})\s+귀하/m,                                // 우편 발송 헤더
    /수\s*급\s*권자\s*[성|이][\s:]+([가-힣]{2,5})/,         // 유족 케이스
  ];
  for (const re of namePatterns) {
    const mm = text.match(re);
    if (mm && mm[1]) { workerName = mm[1].trim(); break; }
  }

  // 생년월일
  const birthMatch = text.match(/생년월일[\s:]+(\d{6})/);
  const birthDateRaw = birthMatch ? birthMatch[1] : null;
  const birthDate = birthDateRaw ? inferBirthYear(birthDateRaw) : null;

  // 재해발생일
  const accidentMatch = text.match(/재해발생일[\s:]+(\d{4}-\d{2}-\d{2})/);
  const accidentDate = accidentMatch ? accidentMatch[1] : null;

  // 결정사항: 명시 라벨 → 실패 시 제목 키워드로 추론
  // ※ 우선순위: 장해 > 장례 (장해 결정통지서 본문에 "장례비" 단어가 단순 등장하는 경우 false-positive 회피)
  let decisionType: DecisionType = "기타";
  const decisionMatch = text.match(/결정사항[\s:]+(휴업급여|장해일시금|장해연금|유족연금|유족일시금|상병보상연금|장례비|요양급여|재요양|간병급여|장례비)/);
  if (decisionMatch) {
    decisionType = decisionMatch[1] as DecisionType;
  } else {
    // 1순위: 장해(난청/일반/진폐) — "장해등급" 또는 "장해급여 일시금/연금" 명시
    const hasDisabilityGrade = /장\s*해\s*\(?중증요양상태\)?\s*등\s*급|난청\s*장해|일반\s*\d{2}급\d{2}호|진폐\s*\d{2}급\d{2}호/.test(text);
    const hasDisabilityKeyword = /장해보상연금|장해보상일시금|장해\s*연금|장해급여\s*일시금|장해급여\s*결정액/.test(text);
    if (hasDisabilityGrade || hasDisabilityKeyword) {
      decisionType = /일시금|장해급여\s*결정액/.test(text) ? "장해일시금" : "장해연금";
    }
    // 2순위: 유족
    else if (/유족보상연금|유족\s*연금/.test(text)) decisionType = "유족연금";
    else if (/유족보상일시금|유족\s*일시금/.test(text)) decisionType = "유족일시금";
    // 3순위: 휴업/상병
    else if (/상병보상연금/.test(text)) decisionType = "상병보상연금";
    else if (/휴업급여/.test(text)) decisionType = "휴업급여";
    // 4순위: 요양
    else if (/요양급여|재요양/.test(text)) decisionType = "요양급여";
    // 5순위(최후): 장례비 — "장의비" 라벨 또는 결정사항 명시가 직접 있을 때만
    else if (/장의비|장례비\s*(?:결정|지급|일시금)|결정사항[^\n]{0,30}장례비/.test(text)) decisionType = "장례비";
    // 폴백: 단순 "장례비" 단어만 있는 경우 기타로 분류 (장해 통지서 본문에 단순 등장하는 false-positive 회피)
  }

  // 처리결과
  const resultStatus = pickFirst<string>(
    text.match(/처리\s*결과[\s:]+([가-힣]+)/)
  );

  // 사업장
  const businessName = pickFirst<string>(
    text.match(/소속사업장명[\s:]+([^\n]+?)(?=\s*공\s*사\s*명|\s*$)/)
  )?.trim() ?? null;
  const constructionName = pickFirst<string>(
    text.match(/공\s*사\s*명[\s:]+([^\n]+?)(?=\s*산재근로자명|\s*$)/)
  )?.trim() ?? null;

  // 수령인 + 관계
  const recipientName = pickFirst<string>(
    text.match(/수\s*령\s*인[\s:]+([가-힣]{2,5})/)
  );
  const relation = pickFirst<string>(
    text.match(/재해자와의\s*관계[\s:]+([가-힣]+)/)
  );

  // 금액 (지급결정액 또는 장해급여 결정액)
  const paymentAmount = parseAmount(
    pickFirst<string>(text.match(/지급결정액[\s:]+([\d,]+)\s*원/))
  ) ?? parseAmount(
    pickFirst<string>(text.match(/장해급여\s*결정액[\s:]+([\d,]+)\s*원/))
  ) ?? parseAmount(
    pickFirst<string>(text.match(/결\s*정\s*액[\s:]+([\d,]+)\s*원/))
  );
  const cumulativeAmount = parseAmount(
    pickFirst<string>(text.match(/누\s*계\s*액[\s:]+([\d,]+)\s*원/))
  );
  const initialAvgWage = parseAmountWithJeon(
    pickFirst<string>(text.match(/평균임금\(보수\)\s*산정\s*후\s*최초로?\s*지급되는?\s*급여\)?[\s:]*([\d,]+원\s*\d{0,2}\s*전?)/))
  ) ?? parseAmountWithJeon(
    pickFirst<string>(text.match(/평균임금[\s:]+([\d,]+\.?\d*원\s*\d{0,2}\s*전?)/))
  );

  // 원시(재해 당시) 최초 평균임금 — 장해급여 일시금 산정의 기초가 되는 값
  // 패턴 후보:
  //   "최초 평균임금 126,290원" / "최초평균임금 : 126,290원"
  //   "당초 평균임금 ..." / "재해 당시 평균임금 ..."
  //   "평균임금산정내역서 평균임금 ..."
  let originalAvgWage: number | null = null;
  const originalPatterns = [
    /최\s*초\s*평\s*균\s*임\s*금[\s:：]*([\d,]+(?:\.\d+)?원?\s*\d{0,2}\s*전?)/,
    /당\s*초\s*평\s*균\s*임\s*금[\s:：]*([\d,]+(?:\.\d+)?원?\s*\d{0,2}\s*전?)/,
    /재\s*해\s*당\s*시\s*평\s*균\s*임\s*금[\s:：]*([\d,]+(?:\.\d+)?원?\s*\d{0,2}\s*전?)/,
    /평\s*균\s*임\s*금\s*산\s*정\s*내\s*역[^\n]{0,40}?([\d,]+(?:\.\d+)?원?\s*\d{0,2}\s*전?)/,
  ];
  for (const re of originalPatterns) {
    const mm = text.match(re);
    if (mm) {
      const v = parseAmountWithJeon(mm[1]);
      if (v && v > 1000 && v < 1_000_000) { // 일급 1천 ~ 100만원 범위만 인정 (오인식 차단)
        originalAvgWage = v;
        break;
      }
    }
  }

  // ── 2. 기간별 산정내역 (통합 파서) ──
  const periods = parsePaymentPeriods(text);

  // ── 3. 장해 관련 ──
  let disabilityGrade: string | null = null;
  let disabilityDays: number | null = null;
  let disabilityUnitWage: number | null = null;
  let disabilityTotalAmount: number | null = null;

  // 장해등급 패턴: "일반 09급07호 일시금 385일"
  const gradeMatch = text.match(/(?:일반|진폐)\s*(\d{2}급\d{2}호)\s*(?:일시금|연금)?\s*(\d+)일/);
  if (gradeMatch) {
    disabilityGrade = gradeMatch[1];
    disabilityDays = parseInt(gradeMatch[2], 10);
  }

  // 장해급여 일시금 산출내역: "(253,051원55전 * 385일 = 97,424,840)"
  const ilsiMatch = text.match(/장해급여\s*일시금\s*[:：]?\s*\(?\s*([\d,]+원\s*\d{0,2}\s*전?)\s*\*\s*(\d+)일\s*=\s*([\d,]+)/);
  if (ilsiMatch) {
    disabilityUnitWage = parseAmountWithJeon(ilsiMatch[1]);
    disabilityDays = disabilityDays ?? parseInt(ilsiMatch[2], 10);
    disabilityTotalAmount = parseAmount(ilsiMatch[3]);
  } else {
    // 일반 장해급여 결정액 패턴
    const totalMatch = text.match(/장해급여\s*결정액[\s:]+([\d,]+)\s*원/);
    if (totalMatch) disabilityTotalAmount = parseAmount(totalMatch[1]);
  }

  // ── 4. 청력 (난청) ──
  let hearingDb: { left: number | null; right: number | null } | null = null;
  let speechDiscrim: { left: number | null; right: number | null } | null = null;
  const audioMatch = text.match(/청력좌\s*([\d.]+)dB\s*청력우\s*([\d.]+)dB/);
  if (audioMatch) {
    hearingDb = { left: parseFloat(audioMatch[1]), right: parseFloat(audioMatch[2]) };
  }
  const speechMatch = text.match(/어음명료도\s*좌\s*([\d.]+)%\s*어음명료도\s*우\s*([\d.]+)%/);
  if (speechMatch) {
    speechDiscrim = { left: parseFloat(speechMatch[1]), right: parseFloat(speechMatch[2]) };
  }

  // ── 5. 윤태선 케이스 (진폐 장해일시금 + 기수령 차감) ──
  // "지급결정액 60,959,120원 = 148,079.72 * 616 - 30,257,980원"
  let legacyDeduction: number | null = null;
  const yoonMatch = text.match(/지급결정액\s*[\d,]+\s*원\s*=\s*([\d,.]+)\s*\*\s*(\d+)\s*-\s*([\d,]+)/);
  if (yoonMatch) {
    disabilityUnitWage = disabilityUnitWage ?? parseFloat(yoonMatch[1].replace(/,/g, ""));
    disabilityDays = disabilityDays ?? parseInt(yoonMatch[2], 10);
    legacyDeduction = parseAmount(yoonMatch[3]);
  }

  // ── 6. 검증 경고 ──
  if (!workerName) warnings.push("산재근로자명 추출 실패");
  if (!accidentDate) warnings.push("재해발생일 추출 실패");
  if (decisionType === "기타") warnings.push("결정사항 분류 실패");
  if (decisionType === "휴업급여" && periods.length === 0) {
    warnings.push("휴업급여인데 기간별 산정내역이 추출되지 않음");
  }

  return {
    decisionDate,
    managementNo,
    businessRegNo,
    caseNo,
    decisionType,
    resultStatus,

    workerName,
    birthDateRaw,
    birthDate,
    accidentDate,
    businessName,
    constructionName,

    recipientName,
    relation,

    paymentAmount,
    cumulativeAmount,
    initialAvgWage,
    originalAvgWage,

    periods,

    disabilityGrade,
    disabilityDays,
    disabilityUnitWage,
    disabilityTotalAmount,

    hearingDb,
    speechDiscrim,

    legacyDeduction,

    warnings,
  };
}

/* ═══════════════════════════════════════════════════════════════
   기간별 산정내역 파서
   ═══════════════════════════════════════════════════════════════ */
function parsePaymentPeriods(text: string): PaymentPeriod[] {
  const periods: PaymentPeriod[] = [];

  // (1)지급기간: 2024-01-19 ~ 2025-01-18
  //   평균임금(보수)구분:(평균임금)
  //   산정내역:126,290원00전 * 70% * 366일 = 32,355,490원 지급대상
  // 또는 감액 적용 케이스:
  //   132,679원47전 * 70% * 50.0/70.0 * 14일 = 928,760원 지급대상
  const periodRegex = /\((\d+)\)지급기간[:：]?\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})[\s\S]*?평균임금\(보수\)구분[:：]?\(?([^)\n]+)\)?[\s\S]*?산정내역[:：]?\s*([^\n]+)/g;

  let m: RegExpExecArray | null;
  while ((m = periodRegex.exec(text)) !== null) {
    const idx = parseInt(m[1], 10);
    const startDate = m[2];
    const endDate = m[3];
    const wageType = m[4]?.trim() ?? null;
    const formula = m[5]?.trim() ?? "";

    // formula 분해: "126,290원00전 * 70% * 366일 = 32,355,490원 지급대상"
    // 또는: "132,679원47전 * 70% * 50.0/70.0 * 14일 = 928,760원 지급대상"
    // 또는: "214,349원40전 * 120일 = 25,721,920원" (장례비)
    // 또는: "214,349원40전 * 365일 * (0.47 + 0.05) * 1개월/12개월 * 43개월 = 145,782,590"
    let rate: number | null = null;
    let reductionLabel: string | null = null;
    let days: number | null = null;
    let amount: number | null = null;

    const rateMatch = formula.match(/\*\s*(\d+)%/);
    if (rateMatch) rate = parseInt(rateMatch[1], 10) / 100;

    const reduceMatch = formula.match(/\*\s*([\d.]+\/[\d.]+)/);
    if (reduceMatch) reductionLabel = reduceMatch[1];

    const daysMatch = formula.match(/\*\s*(\d+)일/);
    if (daysMatch) days = parseInt(daysMatch[1], 10);

    const amountMatch = formula.match(/=\s*([\d,]+)/);
    if (amountMatch) amount = parseAmount(amountMatch[1]);

    periods.push({
      index: idx,
      startDate,
      endDate,
      wageType,
      formula,
      rate,
      reductionLabel,
      days,
      amount,
    });
  }

  return periods;
}

/* ═══════════════════════════════════════════════════════════════
   휴업급여 검증
   ═══════════════════════════════════════════════════════════════ */
export interface VerifyResult {
  isMatch: boolean;
  expected: number;
  actual: number;
  diff: number;
  message: string;
}

export function verifyHuyup(
  avgWage: number,           // 산정 평균임금
  periods: PaymentPeriod[],
  totalDecided: number       // 지급결정액
): VerifyResult {
  let expected = 0;
  for (const p of periods) {
    if (p.amount !== null) {
      expected += p.amount;
    }
  }
  const diff = expected - totalDecided;
  const isMatch = Math.abs(diff) < 100; // 100원 미만 오차는 일치 처리

  return {
    isMatch,
    expected,
    actual: totalDecided,
    diff,
    message: isMatch
      ? "기간별 산정내역의 합계가 지급결정액과 일치합니다."
      : `차이 ${diff.toLocaleString()}원 발생 - 검토 필요`,
  };
}
