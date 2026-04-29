/**
 * 근로복지공단 평균임금산정내역서 OCR 텍스트 파서
 *
 * 입력: Document AI OCR 후의 평문 텍스트
 * 출력: 구조화된 평균임금산정내역서 데이터
 *
 * 양식 구조:
 *  - 헤더: "최초 평균임금산정내역" / "(산업재해보상보험법 제5조)"
 *  - 섹션 1: 관리번호 / 회사명 / 성명 / 주민번호 / 채용일 / 임금산정형태 / 산정사유발생년월일
 *  - 섹션 2: 근로기준법 평균임금 산출내역 (일당 × 통상근로계수 = 평균임금)
 *  - 섹션 3: 산재보험법 특례임금 조건 (성별/규모/업종/직종/신청사유/휴폐업일자/진단일자)
 *  - 섹션 4: 노동통계(사업체노동력조사) — 적용분기/총일수/총금액/월별 일수·금액
 *  - 섹션 5: 산재보험법 특례임금액
 *  - 섹션 6: 최종적용 평균임금 내역 (적용평균임금 / 적용일자)
 *  - 섹션 7: 특이사항 (자유 텍스트)
 */

export interface ParsedAvgWage {
  // 양식 식별
  isAvgWageReport: boolean;

  // 메타
  managementNo: string | null;          // 관리번호
  diagnosisDate: string | null;         // YYYY-MM-DD (산정사유발생년월일)

  // 사업장
  workplaceName: string | null;         // 회사명
  businessRegNo: string | null;         // 사업개시번호
  businessType: string | null;          // 사업종류 (기타건설업 등)

  // 산재근로자
  workerName: string | null;            // 성명
  rrnPrefix: string | null;             // 주민번호 앞 6자리
  hireDate: string | null;              // YYYY-MM-DD (채용일)
  occupation: string | null;            // 직종

  // 임금산정형태
  wageCalcType: string | null;          // "통상근로계수 적용" 등
  dailyWage: number | null;             // 일당
  commuteCoef: number | null;           // 통상근로계수 (0.73 등)

  // 근기법 평균임금
  baseAvgWage: number | null;           // 근기법 평균임금

  // 노동통계
  statQuarter: string | null;           // "2023년도 1분기"
  statSize: string | null;              // "1규모(5~9)"
  statTotalDays: number | null;         // 365
  statTotalAmount: number | null;       // 총금액

  // 특례임금
  statWageBase: number | null;          // 산재보험법 특례임금액

  // 최종
  finalAvgWage: number | null;          // 적용평균임금
  finalApplyDate: string | null;        // YYYY-MM-DD

  // 특이사항 (원문)
  remarks: string | null;

  // 정정청구 트리거 룰
  needsCorrection: boolean;             // appliedWage < max(baseAvgWage, statWageBase) × 0.95
  correctionReason: string | null;

  // 추출 신뢰도
  warnings: string[];

  // 디버깅
  rawText?: string;
}

/* ═══════════════════════════════════════════════════════════════
   유틸리티
   ═══════════════════════════════════════════════════════════════ */

function pickFirst(matches: RegExpMatchArray | null, group = 1): string | null {
  if (!matches || !matches[group]) return null;
  return matches[group].trim();
}

function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  // "124,100원 00전" → 124100.00
  const m1 = s.match(/^([\d,]+)\s*원\s*(\d{1,2})?\s*전?\s*$/);
  if (m1) {
    const won = parseInt(m1[1].replace(/,/g, ""), 10);
    const jeon = m1[2] ? parseInt(m1[2], 10) / 100 : 0;
    return won + jeon;
  }
  // "124,100.00"
  const m2 = s.replace(/[,\s]/g, "").match(/^(\d+(\.\d+)?)$/);
  if (m2) return parseFloat(m2[1]);
  // "124,100"
  const m3 = s.replace(/[,\s원]/g, "").match(/^(\d+)$/);
  if (m3) return parseInt(m3[1], 10);
  return null;
}

function parseAmountWithJeon(wonStr: string | null, jeonStr: string | null): number | null {
  if (!wonStr) return null;
  const won = parseInt(wonStr.replace(/,/g, ""), 10);
  if (isNaN(won)) return null;
  const jeon = jeonStr ? parseInt(jeonStr, 10) / 100 : 0;
  return won + jeon;
}

function normalizeDate(s: string | null): string | null {
  if (!s) return null;
  // 2023-09-15 / 2023.09.15 / 2023/09/15
  const m = s.match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   메인 파서
   ═══════════════════════════════════════════════════════════════ */
export function parseAvgWageNotice(rawText: string): ParsedAvgWage {
  // OCR 결과 정리
  const text = rawText
    .replace(/[ ]/g, " ")       // non-breaking space
    .replace(/[ \t]+/g, " ");

  const warnings: string[] = [];

  // ── 양식 식별 ──
  const isAvgWageReport =
    /최초\s*평균\s*임금\s*산정\s*내역|평균임금\s*산정\s*내역\s*서?/i.test(text);

  // ── 1. 메타 ──
  const managementNo = pickFirst(
    text.match(/관\s*리\s*번\s*호[\s|:.ㆍ│]+([\d-]{8,})/)
  );

  const diagnosisDate = normalizeDate(
    pickFirst(
      text.match(/산정\s*사유\s*발생\s*[년월일]+[\s|:.ㆍ│]+(\d{4}[-./]\d{2}[-./]\d{2})/)
    ) ??
    pickFirst(
      text.match(/산정사유\s*발생\s*년?월?일?[\s|:.ㆍ│]+(\d{4}[-./]\d{2}[-./]\d{2})/)
    )
  );

  // ── 2. 사업장 ──
  // 회사명: 표 셀 내부, OCR 'ㅣ' 또는 '|' 또는 공백 구분, 다음 라벨 (성명/섬명) 전까지
  const workplaceName = pickFirst(
    text.match(/회\s*사\s*명[\s|:.ㆍ│]+([^|\n│]+?)(?=\s*[성섬]\s*[명영]|\s*[|│]\s*[성섬]|\s*\n)/)
  )?.trim() ?? null;

  const businessRegNo = pickFirst(
    text.match(/사\s*업\s*개\s*시\s*번\s*호[\s|:.ㆍ│]+([\d-]{8,})/)
  );

  // 사업종류: 특이사항에서 자주 등장 — "사업종류 '기타건설업'으로 확인"
  const businessType = pickFirst(
    text.match(/사업\s*종류[는은이가]*\s*['"\(]([가-힣A-Za-z\s]+?)['"\)]/)
  ) ?? pickFirst(
    text.match(/사업\s*종류[는은이가]*\s*([가-힣]+업|[가-힣]+제조업)\s*[으로]/)
  );

  // ── 3. 산재근로자 ──
  // 성명: OCR 'ㅁ' → '명', '섬' → '성' 오인식 fallback
  let workerName: string | null = null;
  const namePatterns = [
    /[성섬]\s*[명영]\s*[|:.ㆍ│]+\s*([가-힣]{2,5})(?=\s|\||│|$)/,
    /성명\s+([가-힣]{2,5})\s/,
    /섬명\s+([가-힣]{2,5})\s/,
    /성\s*명\s+([가-힣]{2,5})/,
  ];
  for (const re of namePatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      workerName = m[1].trim();
      break;
    }
  }

  // 주민번호 앞 6자리
  const rrnPrefix = pickFirst(
    text.match(/주민(?:등록)?\s*번호[\s|:.ㆍ│]+(\d{6})[—\-－]/)
  );

  const hireDate = normalizeDate(
    pickFirst(
      text.match(/채\s*용\s*일[\s|:.ㆍ│]+(\d{4}[-./]\d{2}[-./]\d{2})/)
    )
  );

  const occupation = pickFirst(
    text.match(/직\s*종[\s|:.ㆍ│]+([가-힣A-Za-z\s]+?)(?=\s*[|\n│]|\s*신청)/)
  )?.trim() ?? null;

  // ── 4. 임금산정형태 ──
  const wageCalcType = pickFirst(
    text.match(/임금\s*산정\s*형태[\s|:.ㆍ│]+([^\n|│]+?)(?=\s*산정사유|\s*[|│]|\s*\n)/)
  )?.trim() ?? null;

  const dailyWage = parseAmount(
    pickFirst(
      text.match(/일\s*당[\s|:.ㆍ│]+([\d,]+)\s*(?:원)?/)
    )
  );

  const commuteCoef = (() => {
    const m = text.match(/통\s*상\s*근\s*로\s*계\s*수[\s|:.ㆍ│]+(\d+\.\d+)/);
    return m ? parseFloat(m[1]) : null;
  })();

  // ── 5. 근기법 평균임금 (baseAvgWage) ──
  // 패턴 1: "근로기준법 평균임금 산출내역" 섹션 내부 "평균임금: 124,100.00"
  // 패턴 2: 단순 "평균임금 124,100.00"
  // 패턴 3: "적용평균임금 124,100원 00전 (평균임금 124,100.00 * 증감률 %)"
  let baseAvgWage: number | null = null;
  const basePatterns = [
    /근로기준법\s*평균임금\s*산출\s*내역[\s\S]{0,500}?평\s*균\s*임\s*금[\s|:.ㆍ│]+([\d,]+(?:\.\d+)?)/,
    /평\s*균\s*임\s*금[\s|:.ㆍ│]+([\d,]+\.\d{2})/,
    /평균임금[\s|:.ㆍ│]+([\d,]+)\s*원\s*(\d{1,2})\s*전/,
    /\(\s*평균임금\s+([\d,]+\.\d{2})\s*\*/,
  ];
  for (const re of basePatterns) {
    const m = text.match(re);
    if (m) {
      if (m[2]) {
        baseAvgWage = parseAmountWithJeon(m[1], m[2]);
      } else {
        baseAvgWage = parseAmount(m[1]);
      }
      if (baseAvgWage !== null && baseAvgWage > 1000) break;
      baseAvgWage = null;
    }
  }

  // ── 6. 노동통계 ──
  const statQuarter = pickFirst(
    text.match(/적용분기[\s|:.ㆍ│]+(\d{4}\s*년도?\s*\d\s*분기)/)
  )?.replace(/\s+/g, " ") ?? null;

  // 사업체 규모: "1규모(5~9)" / "2규모(10~29)" 등
  const statSize = pickFirst(
    text.match(/(\d규모\s*\(\s*\d+\s*[~∼]\s*\d+\s*\))/)
  );

  const statTotalDays = (() => {
    const m = text.match(/총\s*일\s*수[\s|:.ㆍ│]+(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  })();

  const statTotalAmount = parseAmount(
    pickFirst(
      text.match(/총\s*금?\s*액[\s|:.ㆍ│]+([\d,]+)\s*원?/)
    )
  );

  // ── 7. 특례임금 ──
  let statWageBase: number | null = null;
  const statBasePatterns = [
    /산재보험법\s*특례임금?\s*액?[\s|:.ㆍ│]+([\d,]+)\s*원\s*(\d{1,2})?\s*전?/,
    /산재보험법\s*특례임금[\s|:.ㆍ│]+([\d,]+\.?\d*)/,
    /(?:특례임금|특레임금|독레임금)[\s|:.ㆍ│]*([\d,]+)\s*원\s*(\d{1,2})?\s*전?/,
  ];
  for (const re of statBasePatterns) {
    const m = text.match(re);
    if (m) {
      statWageBase = m[2] ? parseAmountWithJeon(m[1], m[2]) : parseAmount(m[1]);
      if (statWageBase !== null && statWageBase > 1000) break;
      statWageBase = null;
    }
  }

  // ── 8. 최종적용 평균임금 ──
  let finalAvgWage: number | null = null;
  const finalPatterns = [
    /적\s*용\s*평\s*균\s*임\s*금[\s|:.ㆍ│]+([\d,]+)\s*원\s*(\d{1,2})\s*전/,
    /적용평균임금[\s|:.ㆍ│]+([\d,]+\.\d{2})/,
    /적\s*용\s*평\s*균\s*임\s*금[\s|:.ㆍ│]+([\d,]+)/,
  ];
  for (const re of finalPatterns) {
    const m = text.match(re);
    if (m) {
      finalAvgWage = m[2] ? parseAmountWithJeon(m[1], m[2]) : parseAmount(m[1]);
      if (finalAvgWage !== null && finalAvgWage > 1000) break;
      finalAvgWage = null;
    }
  }

  const finalApplyDate = normalizeDate(
    pickFirst(
      text.match(/적용일자[\s|:.ㆍ│]+(\d{4}[-./]\d{2}[-./]\d{2})/)
    )
  );

  // ── 9. 특이사항 (원문 보존) ──
  const remarksMatch = text.match(/특이사[항함][\s:.ㆍ│]+([\s\S]+?)(?=$|위 사실이|위사실이|특이사항|$)/);
  const remarks = remarksMatch ? remarksMatch[1].trim().slice(0, 2000) : null;

  // ── 10. 정정청구 트리거 룰 ──
  // ratio = finalAvgWage / max(baseAvgWage, statWageBase)
  // < 0.95 → needsCorrection=true
  let needsCorrection = false;
  let correctionReason: string | null = null;
  if (finalAvgWage !== null) {
    const candidates: number[] = [];
    if (baseAvgWage !== null) candidates.push(baseAvgWage);
    if (statWageBase !== null) candidates.push(statWageBase);
    if (candidates.length > 0) {
      const referenceWage = Math.max(...candidates);
      const ratio = finalAvgWage / referenceWage;
      if (ratio < 0.95) {
        needsCorrection = true;
        const referenceLabel = referenceWage === statWageBase ? "특례임금" : "근기법 평균임금";
        const pct = (ratio * 100).toFixed(1);
        correctionReason = `${referenceLabel} ${referenceWage.toLocaleString()}원 대비 적용임금 ${finalAvgWage.toLocaleString()}원 = ${pct}% (95% 미만 → 정정청구 검토 필요)`;
      } else {
        correctionReason = `적용임금 / 비교임금 = ${(ratio * 100).toFixed(1)}% (정상 범위)`;
      }
    }
  }

  // ── 11. 검증 경고 ──
  if (!isAvgWageReport) warnings.push("평균임금산정내역서 양식 식별 실패 — 다른 양식일 수 있음");
  if (!workerName) warnings.push("성명 추출 실패");
  if (!workplaceName) warnings.push("회사명 추출 실패");
  if (!finalAvgWage) warnings.push("적용평균임금 추출 실패");
  if (!baseAvgWage && !statWageBase) warnings.push("근기법 평균임금/특례임금 모두 추출 실패");

  return {
    isAvgWageReport,
    managementNo,
    diagnosisDate,
    workplaceName,
    businessRegNo,
    businessType,
    workerName,
    rrnPrefix,
    hireDate,
    occupation,
    wageCalcType,
    dailyWage,
    commuteCoef,
    baseAvgWage,
    statQuarter,
    statSize,
    statTotalDays,
    statTotalAmount,
    statWageBase,
    finalAvgWage,
    finalApplyDate,
    remarks,
    needsCorrection,
    correctionReason,
    warnings,
  };
}

/* ═══════════════════════════════════════════════════════════════
   WageReviewData 매핑 helper
   ═══════════════════════════════════════════════════════════════ */
export interface WageReviewMapping {
  workplaceName: string | null;
  baseAvgWage: number | null;
  finalAvgWage: number | null;
  statWageBase: number | null;
  statWageQuarter: string | null;
  statWageSize: string | null;
  hasCommuteCoef: boolean | null;
  changeRate: number | null;
}

/**
 * ParsedAvgWage → WageReviewData 일부 필드 자동 매핑.
 * 노무사가 검토 후 caseId, tfName, patientName 등은 별도로 채워야 함.
 */
export function mapToWageReview(parsed: ParsedAvgWage): WageReviewMapping {
  return {
    workplaceName: parsed.workplaceName,
    baseAvgWage: parsed.baseAvgWage,
    finalAvgWage: parsed.finalAvgWage,
    statWageBase: parsed.statWageBase,
    statWageQuarter: parsed.statQuarter,
    statWageSize: parsed.statSize,
    hasCommuteCoef: parsed.commuteCoef !== null && parsed.commuteCoef > 0,
    changeRate: null, // 증감률은 별도 입력 (적용시점 차이 계산)
  };
}
