"use client";

import { useState, useMemo, useRef } from "react";
import {
  WAGE_INCREASE_RATIO,
  CPI_RATIO,
  DATA_START_YEAR,
  DATA_END_YEAR,
} from "./wageData";
import type { ParsedNotice } from "@/lib/notice-parser";

/* ═══════════════════════════════════════════════════════════════
   타입
   ═══════════════════════════════════════════════════════════════ */
type RatioType = "wage" | "cpi";
type AccidentType = "occupational" | "general"; // 직업병 / 일반사고

interface WagePeriod {
  yearIndex: number;
  startDate: Date;
  endDate: Date;
  days: number;
  yearlyRatio: number;        // 해당 연차에 적용된 증감 비율
  cumulativeRatio: number;
  adjustedWage: number;
  age: number;
  isReduced: boolean;
  elderlyRate: number | null;
  benefitRate: number;
  benefitLabel: string;
  dailyBenefit: number;
}

interface CalcResult {
  ratioType: RatioType;
  ratioBasis: string;
  age61Date: Date;
  graceEndDate: Date;
  reductionStartDate: Date;
  periods: WagePeriod[];
  finalAdjustedWage: number;
  finalCumulativeRatio: number;
}

/* ═══════════════════════════════════════════════════════════════
   고령자 휴업급여 지급률 (산재법 제55조 별표1)
   ═══════════════════════════════════════════════════════════════ */
const ELDERLY_BENEFIT_RATE = [
  { minAge: 61, maxAge: 62,             rate: 0.67 },
  { minAge: 62, maxAge: 63,             rate: 0.64 },
  { minAge: 63, maxAge: 64,             rate: 0.61 },
  { minAge: 64, maxAge: 65,             rate: 0.58 },
  { minAge: 65, maxAge: null as number | null, rate: 0.50 },
];

/* ═══════════════════════════════════════════════════════════════
   헬퍼 함수
   ═══════════════════════════════════════════════════════════════ */
function detectRatioType(
  accidentDate: Date,
  accidentType: AccidentType
): { type: RatioType; basis: string } {
  const reformDate = new Date("2008-07-01");
  const isBeforeReform = accidentDate < reformDate;

  if (isBeforeReform) {
    return {
      type: "wage",
      basis: "구 산재법 (2008.07.01 이전 재해) → 전체 근로자 임금 평균액 증감률",
    };
  }
  if (accidentType === "occupational") {
    return {
      type: "wage",
      basis: "산재법 시행령 제22조 1호 (직업병) → 전체 근로자 임금 평균액 증감률",
    };
  }
  return {
    type: "cpi",
    basis: "산재법 시행령 제22조 2호 (일반 사고) → 소비자물가변동률",
  };
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function calcAge(birth: Date, ref: Date): number {
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

function getElderlyBenefitRate(age: number): number | null {
  for (const row of ELDERLY_BENEFIT_RATE) {
    if (age >= row.minAge && (row.maxAge === null || age < row.maxAge)) {
      return row.rate;
    }
  }
  return null;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

/* ═══════════════════════════════════════════════════════════════
   핵심 산정 로직
   ═══════════════════════════════════════════════════════════════ */
function calculatePeriods(args: {
  accidentDate: Date;
  birthDate: Date;
  initialWage: number;
  endYear: number;
  accidentType: AccidentType;
  isLowIncome: boolean;
}): CalcResult {
  const { accidentDate, birthDate, initialWage, endYear, accidentType, isLowIncome } = args;
  const { type: ratioType, basis: ratioBasis } = detectRatioType(accidentDate, accidentType);
  const ratioData = ratioType === "wage" ? WAGE_INCREASE_RATIO : CPI_RATIO;

  // 주요 분기점
  const age61Date = addYears(birthDate, 61);
  const graceEndDate = addYears(accidentDate, 2);
  const reductionStartDateRaw = addDays(graceEndDate, 1);
  const reductionStartDate = age61Date > reductionStartDateRaw ? age61Date : reductionStartDateRaw;

  // 분석 종료 시점 = 종료연도 12월 31일
  const finalDate = new Date(endYear, 11, 31);
  const normalRate = isLowIncome ? 0.9 : 0.7;

  const periods: WagePeriod[] = [];
  let currentStart = new Date(accidentDate);
  let cumulativeRatio = 1;
  let yearIdx = 1;
  let yearlyRatio = 1;

  // 안전 가드 (무한루프 방지)
  let safety = 0;

  while (currentStart <= finalDate && safety < 200) {
    safety++;
    // 현재 연차의 자연 종료일 = 재해일 + n주년 - 1일
    const naturalEnd = addDays(addYears(accidentDate, yearIdx), -1);
    const periodEnd = naturalEnd < finalDate ? naturalEnd : finalDate;

    // 감액 시작일이 이 구간 안에 있으면 분기
    const breakpoints: Date[] = [];
    if (reductionStartDate > currentStart && reductionStartDate <= periodEnd) {
      breakpoints.push(addDays(reductionStartDate, -1));
    }
    breakpoints.push(periodEnd);

    let segStart = new Date(currentStart);
    for (const bp of breakpoints) {
      const isReduced = segStart >= reductionStartDate;
      const age = calcAge(birthDate, segStart);
      const elderlyRate = isReduced ? getElderlyBenefitRate(age) : null;
      const benefitRate = elderlyRate !== null ? elderlyRate : normalRate;
      const adjustedWage = initialWage * cumulativeRatio;
      const dailyBenefit = adjustedWage * benefitRate;
      const benefitLabel = isReduced
        ? `별표1 ${(elderlyRate! * 100).toFixed(0)}%`
        : `${(normalRate * 100).toFixed(0)}%`;

      periods.push({
        yearIndex: yearIdx,
        startDate: new Date(segStart),
        endDate: new Date(bp),
        days: diffDays(segStart, bp),
        yearlyRatio,
        cumulativeRatio,
        adjustedWage,
        age,
        isReduced,
        elderlyRate,
        benefitRate,
        benefitLabel,
        dailyBenefit,
      });

      segStart = addDays(bp, 1);
    }

    // 다음 연차로
    currentStart = addDays(periodEnd, 1);
    if (currentStart > finalDate) break;

    yearIdx++;
    // 새 연차 시작 = 재해일 n주년 → 그 시점에 해당 연도의 증감률 적용
    const newYear = currentStart.getFullYear();
    yearlyRatio = ratioData[newYear] ?? 1;
    cumulativeRatio *= yearlyRatio;
  }

  const finalAdjustedWage = initialWage * cumulativeRatio;

  return {
    ratioType,
    ratioBasis,
    age61Date,
    graceEndDate,
    reductionStartDate,
    periods,
    finalAdjustedWage,
    finalCumulativeRatio: cumulativeRatio,
  };
}

/* ═══════════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════════ */
export default function WageChangeCalcPage() {
  const currentYear = new Date().getFullYear();

  // 입력 상태
  const [accidentType, setAccidentType] = useState<AccidentType>("occupational");
  const [accidentDateStr, setAccidentDateStr] = useState("2024-01-19");
  const [birthDateStr, setBirthDateStr] = useState("1949-02-20");
  const [initialWage, setInitialWage] = useState("126290");
  const [endYear, setEndYear] = useState<number>(Math.min(currentYear, DATA_END_YEAR));
  const [officialFinalWage, setOfficialFinalWage] = useState(""); // 공단 산정값 (검증용)
  const [isLowIncome, setIsLowIncome] = useState(false);

  // PDF 업로드 상태
  const [parsedNotice, setParsedNotice] = useState<ParsedNotice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadedFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/notice/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "파싱 실패");

      const parsed: ParsedNotice = data.parsed;
      setParsedNotice(parsed);

      // 추출된 필드로 입력 자동 채우기
      if (parsed.accidentDate) setAccidentDateStr(parsed.accidentDate);
      if (parsed.birthDate) setBirthDateStr(parsed.birthDate);
      if (parsed.initialAvgWage) setInitialWage(String(parsed.initialAvgWage));

      // 결정사항/사업장명으로 직업병 vs 일반사고 자동 추론
      const inferOccupational =
        /난청|진폐|폐암|COPD|규폐|소음성|직업성|광업소|광업|채굴|용해|용접|아스베스트/i.test(
          (parsed.businessName ?? "") +
            " " +
            (parsed.constructionName ?? "") +
            " " +
            (parsed.disabilityGrade ?? "")
        );
      if (inferOccupational) setAccidentType("occupational");

      // 마지막 기간 종료일을 종료연도로 자동 설정
      const lastPeriod = parsed.periods?.[parsed.periods.length - 1];
      if (lastPeriod?.endDate) {
        const yr = parseInt(lastPeriod.endDate.slice(0, 4), 10);
        if (!isNaN(yr) && yr >= DATA_START_YEAR && yr <= DATA_END_YEAR) {
          setEndYear(yr);
        }
      }

      // 공단값 자동 채우기 (휴업급여인 경우 마지막 기간의 평균임금)
      if (parsed.decisionType === "휴업급여" && lastPeriod) {
        const formula = lastPeriod.formula;
        const wageMatch = formula.match(/([\d,]+원\s*\d{0,2}\s*전?)/);
        if (wageMatch) {
          const cleaned = wageMatch[1].replace(/[원전,\s]/g, "");
          const m = cleaned.match(/^(\d+)(\d{2})?$/);
          if (m) {
            const won = parseInt(m[1], 10);
            const jeon = m[2] ? parseInt(m[2], 10) / 100 : 0;
            setOfficialFinalWage(String(won + jeon));
          }
        }
      }
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function resetUpload() {
    setParsedNotice(null);
    setUploadError(null);
    setUploadedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // 계산
  const result = useMemo<CalcResult | null>(() => {
    const accident = new Date(accidentDateStr);
    const birth = new Date(birthDateStr);
    const wage = parseFloat(initialWage);
    if (
      isNaN(accident.getTime()) ||
      isNaN(birth.getTime()) ||
      isNaN(wage) ||
      wage <= 0 ||
      isNaN(endYear) ||
      endYear < accident.getFullYear()
    ) {
      return null;
    }
    return calculatePeriods({
      accidentDate: accident,
      birthDate: birth,
      initialWage: wage,
      endYear,
      accidentType,
      isLowIncome,
    });
  }, [accidentType, accidentDateStr, birthDateStr, initialWage, endYear, isLowIncome]);

  // 공단 산정값 비교
  const verification = useMemo(() => {
    if (!result || !officialFinalWage) return null;
    const official = parseFloat(officialFinalWage);
    if (isNaN(official) || official <= 0) return null;
    const diff = result.finalAdjustedWage - official;
    const tol = 1; // 1원 이내 일치
    return {
      official,
      computed: result.finalAdjustedWage,
      diff,
      isMatch: Math.abs(diff) < tol,
    };
  }, [result, officialFinalWage]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#29ABE2" }}>
        평균임금 증감 + 고령자 휴업급여 통합 검토
      </h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
        재해발생일 ~ 검토시점까지 평균임금 변동 내역과 고령자 별표1 적용 결과를 한번에 산정합니다.<br/>
        <span style={{ color: "#9ca3af" }}>
          • 산재법 시행령 제22조 (직업병/일반사고 분기) • 산재법 제55조 별표1 (고령자 감액) • 2년 유예 + 1일 (실무 지침)
        </span>
      </p>

      {/* ─── 결정통지서 업로드 (자동 입력) ─── */}
      <section style={{ ...sectionStyle, background: "linear-gradient(180deg, #f0f9ff 0%, #fff 100%)" }}>
        <h2 style={sectionTitleStyle}>📎 결정통지서 PDF 업로드 (자동 입력)</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
            disabled={uploading}
            style={{ flex: 1, minWidth: 240, fontSize: 13 }}
          />
          {uploading && (
            <span style={{ fontSize: 13, color: "#0369a1" }}>
              ⏳ OCR 처리 중... (10~30초 소요)
            </span>
          )}
          {parsedNotice && !uploading && (
            <button
              onClick={resetUpload}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                border: "1px solid #d1d5db",
                background: "#fff",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              초기화
            </button>
          )}
        </div>

        {uploadError && (
          <div style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            fontSize: 13,
            color: "#dc2626",
          }}>
            ❌ {uploadError}
          </div>
        )}

        {parsedNotice && !uploading && (
          <div style={{ marginTop: 16 }}>
            <NoticeSummary notice={parsedNotice} fileName={uploadedFileName} />
          </div>
        )}

        <p style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
          ※ 지원: 휴업급여·장해일시금·유족연금·장례비 결정통지서 / 스캔본·이미지 PDF 모두 가능
        </p>
      </section>

      {/* ─── 입력 섹션 ─── */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>입력 정보</h2>

        {/* 재해 유형 */}
        <div style={{ marginBottom: 16 }}>
          <span style={labelTextStyle}>재해 유형</span>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <label style={radioLabel(accidentType === "occupational")}>
              <input
                type="radio"
                name="accidentType"
                checked={accidentType === "occupational"}
                onChange={() => setAccidentType("occupational")}
                style={{ accentColor: "#29ABE2" }}
              />
              <span>직업병 <span style={{ fontSize: 11, color: "#6b7280" }}>(소음성 난청, COPD, 진폐, 폐암 등)</span></span>
            </label>
            <label style={radioLabel(accidentType === "general")}>
              <input
                type="radio"
                name="accidentType"
                checked={accidentType === "general"}
                onChange={() => setAccidentType("general")}
                style={{ accentColor: "#29ABE2" }}
              />
              <span>일반 사고/부상</span>
            </label>
          </div>
        </div>

        {/* 날짜·임금 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>재해발생일</span>
            <input type="date" value={accidentDateStr} onChange={(e) => setAccidentDateStr(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>재해자 생년월일</span>
            <input type="date" value={birthDateStr} onChange={(e) => setBirthDateStr(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>증감 종료 기준연도</span>
            <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: DATA_END_YEAR - DATA_START_YEAR + 1 }, (_, i) => DATA_START_YEAR + i)
                .filter((y) => y >= new Date(accidentDateStr).getFullYear())
                .map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>최초 평균임금 (재해 당시, 원/일)</span>
            <input
              type="text"
              inputMode="numeric"
              value={initialWage}
              onChange={(e) => setInitialWage(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="예: 126290"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>
              공단 산정 평균임금 (검증용, 선택)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={officialFinalWage}
              onChange={(e) => setOfficialFinalWage(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="예: 132679.47"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingTop: 22 }}>
            <input
              type="checkbox"
              checked={isLowIncome}
              onChange={(e) => setIsLowIncome(e.target.checked)}
              style={{ accentColor: "#29ABE2" }}
            />
            <span style={{ fontSize: 13, color: "#374151" }}>저소득근로자 (90%)</span>
          </label>
        </div>
      </section>

      {/* ─── 자동 판단 + 결과 ─── */}
      {result && (
        <>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>자동 판단 결과</h2>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: 0, marginBottom: 4 }}>
                ⚖️ 적용 증감유형: {result.ratioType === "wage" ? "전체 근로자 임금 평균액 증감률" : "소비자물가변동률"}
              </p>
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>{result.ratioBasis}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <InfoCell label="만 61세 도달일" value={formatDate(result.age61Date)} />
              <InfoCell label="2년 유예 종료일" value={formatDate(result.graceEndDate)} />
              <InfoCell label="감액 실제 시작일 (+1일)" value={formatDate(result.reductionStartDate)} highlight />
              <InfoCell
                label="검토 종료 시점 평균임금"
                value={`${formatNumber(result.finalAdjustedWage, 2)}원`}
                highlight
              />
            </div>
          </section>

          {/* ─── 연차별 평임 누적 테이블 ─── */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>
              연차별 평균임금 산정 내역 ({result.periods.length}개 구간)
            </h2>
            <div style={{ overflow: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                    <th style={thStyle}>연차</th>
                    <th style={thStyle}>기간</th>
                    <th style={thStyle}>일수</th>
                    <th style={thStyleRight}>적용 증감률</th>
                    <th style={thStyleRight}>누적 배율</th>
                    <th style={thStyleRight}>평균임금 (원/일)</th>
                    <th style={thStyle}>만 나이</th>
                    <th style={thStyle}>지급률</th>
                    <th style={thStyleRight}>1일 휴업급여</th>
                  </tr>
                </thead>
                <tbody>
                  {result.periods.map((p, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: p.isReduced ? "#fef3c7" : i % 2 === 0 ? "#fff" : "#fafafa",
                      }}
                    >
                      <td style={tdStyle}>{p.yearIndex}년차</td>
                      <td style={tdStyle}>
                        {formatDate(p.startDate)} ~ {formatDate(p.endDate)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{p.days}일</td>
                      <td style={tdStyleRight}>{p.yearlyRatio.toFixed(4)}</td>
                      <td style={tdStyleRight}>{p.cumulativeRatio.toFixed(4)}</td>
                      <td style={tdStyleRight}>{formatNumber(p.adjustedWage, 2)}</td>
                      <td style={tdStyle}>만 {p.age}세</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontWeight: p.isReduced ? 700 : 400,
                          color: p.isReduced ? "#92400e" : "#374151",
                        }}>
                          {p.benefitLabel}
                        </span>
                      </td>
                      <td style={{ ...tdStyleRight, fontWeight: 700, color: "#0369a1" }}>
                        {formatNumber(p.dailyBenefit, 0)}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
              ※ 노란색 행 = 고령자 감액(별표1) 적용 구간 / 평균임금은 재해발생일 1주년 단위로 증감 적용 (산재법 제36조)
            </p>
          </section>

          {/* ─── 공단값 비교 ─── */}
          {verification && (
            <section style={{
              ...sectionStyle,
              background: verification.isMatch ? "#f0fdf4" : "#fef2f2",
              borderColor: verification.isMatch ? "#bbf7d0" : "#fecaca",
            }}>
              <h2 style={{ ...sectionTitleStyle, borderColor: verification.isMatch ? "#16a34a" : "#dc2626" }}>
                {verification.isMatch ? "✅ 공단 산정값과 일치" : "❌ 공단 산정값과 불일치"}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <InfoCell label="공단 산정값" value={`${formatNumber(verification.official, 2)}원`} />
                <InfoCell label="검토 산정값" value={`${formatNumber(verification.computed, 2)}원`} />
                <InfoCell
                  label="차이"
                  value={`${verification.diff >= 0 ? "+" : ""}${formatNumber(verification.diff, 2)}원`}
                  color={verification.isMatch ? "#16a34a" : "#dc2626"}
                />
              </div>
            </section>
          )}
        </>
      )}

      {/* ─── 법령 안내 ─── */}
      <section style={{ ...sectionStyle, background: "#fffbeb", borderColor: "#fde68a" }}>
        <h2 style={{ ...sectionTitleStyle, borderColor: "#f59e0b" }}>법령 근거</h2>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: "#374151" }}>
          <p style={{ margin: 0, marginBottom: 6 }}>
            <strong>산재법 시행령 제22조 (평균임금의 증감)</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>1호 직업병에 걸린 사람: <strong>전체 근로자 임금 평균액 증감률</strong></li>
            <li>2호 그 밖의 보험가입자(일반 사고): <strong>소비자물가변동률</strong></li>
          </ul>
          <p style={{ margin: "10px 0 6px" }}>
            <strong>산재법 제55조 별표 1 (고령자 휴업급여 지급률)</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>61~62세 67% / 62~63세 64% / 63~64세 61% / 64~65세 58% / 65세+ 50%</li>
            <li>실무: 재해발생일로부터 2년간 감액 미적용 (지침)</li>
            <li>감액 실제 시작일 = 유예 종료일 + 1일</li>
          </ul>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#92400e" }}>
            ※ 2008.07.01 이전 재해는 종전 규정에 따라 모든 케이스에 임금증감률 적용
          </p>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   서브 컴포넌트
   ═══════════════════════════════════════════════════════════════ */
function InfoCell({
  label,
  value,
  highlight = false,
  color,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        background: highlight ? "#dbeafe" : "#f9fafb",
        border: `1px solid ${highlight ? "#93c5fd" : "#e5e7eb"}`,
        borderRadius: 8,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? (highlight ? "#1d4ed8" : "#111827") }}>
        {value}
      </div>
    </div>
  );
}

function NoticeSummary({
  notice,
  fileName,
}: {
  notice: ParsedNotice;
  fileName: string | null;
}) {
  const formatNum = (n: number | null | undefined) =>
    n != null ? n.toLocaleString("ko-KR") : "-";

  const isHuyup = notice.decisionType === "휴업급여";
  const totalSum = notice.periods.reduce((s, p) => s + (p.amount ?? 0), 0);
  const periodMatch =
    notice.paymentAmount && totalSum
      ? Math.abs(notice.paymentAmount - totalSum) < 100
      : null;

  return (
    <div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>📄 {fileName}</span>
        <span style={{
          background: "#0369a1",
          color: "#fff",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 12,
          fontWeight: 600,
        }}>
          {notice.decisionType}
        </span>
        {notice.resultStatus && (
          <span style={{
            background: "#dcfce7",
            color: "#166534",
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 12,
            fontWeight: 600,
          }}>
            {notice.resultStatus}
          </span>
        )}
      </div>

      {/* 핵심 정보 그리드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
        marginBottom: 12,
      }}>
        <InfoCell label="산재근로자" value={notice.workerName ?? "-"} />
        <InfoCell label="생년월일" value={notice.birthDate ?? notice.birthDateRaw ?? "-"} />
        <InfoCell label="재해발생일" value={notice.accidentDate ?? "-"} />
        <InfoCell label="결정일" value={notice.decisionDate ?? "-"} />
        <InfoCell
          label="최초 평균임금"
          value={notice.initialAvgWage ? `${formatNum(notice.initialAvgWage)}원` : "-"}
          highlight
        />
        <InfoCell
          label="지급결정액"
          value={notice.paymentAmount ? `${formatNum(notice.paymentAmount)}원` : "-"}
          highlight
        />
      </div>

      {/* 사업장 정보 */}
      {(notice.businessName || notice.constructionName) && (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
          🏢 {notice.businessName ?? "-"}
          {notice.constructionName && ` / ${notice.constructionName}`}
        </div>
      )}

      {/* 기간별 산정내역 (휴업급여 등) */}
      {notice.periods.length > 0 && (
        <details open style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", marginBottom: 8 }}>
            기간별 산정내역 ({notice.periods.length}개)
            {periodMatch !== null && (
              <span style={{
                marginLeft: 8,
                fontSize: 11,
                color: periodMatch ? "#16a34a" : "#dc2626",
              }}>
                {periodMatch ? "✅ 합계 일치" : "⚠️ 합계 불일치"}
              </span>
            )}
          </summary>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ padding: 6, textAlign: "left", fontWeight: 600 }}>#</th>
                <th style={{ padding: 6, textAlign: "left", fontWeight: 600 }}>기간</th>
                <th style={{ padding: 6, textAlign: "left", fontWeight: 600 }}>산정내역</th>
                <th style={{ padding: 6, textAlign: "right", fontWeight: 600 }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {notice.periods.map((p) => (
                <tr key={p.index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 6 }}>{p.index}</td>
                  <td style={{ padding: 6 }}>{p.startDate} ~ {p.endDate}</td>
                  <td style={{ padding: 6, fontFamily: "monospace", fontSize: 11, color: "#374151" }}>
                    {p.formula}
                  </td>
                  <td style={{ padding: 6, textAlign: "right", fontWeight: 600, color: "#0369a1" }}>
                    {p.amount ? `${formatNum(p.amount)}원` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* 장해 정보 */}
      {(notice.disabilityGrade || notice.disabilityDays) && (
        <div style={{ background: "#fef9c3", borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#854d0e", marginBottom: 4 }}>
            장해 정보
          </div>
          <div style={{ fontSize: 12, color: "#374151" }}>
            등급: {notice.disabilityGrade ?? "-"} / 일수: {formatNum(notice.disabilityDays)}일
            {notice.disabilityUnitWage && ` / 일당: ${formatNum(notice.disabilityUnitWage)}원`}
            {notice.disabilityTotalAmount && ` / 결정액: ${formatNum(notice.disabilityTotalAmount)}원`}
          </div>
          {notice.legacyDeduction && (
            <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
              ※ 기수령액 차감: {formatNum(notice.legacyDeduction)}원
            </div>
          )}
        </div>
      )}

      {/* 청력 정보 */}
      {notice.hearingDb && (
        <div style={{ background: "#dbeafe", borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e40af", marginBottom: 4 }}>
            청력 데이터
          </div>
          <div style={{ fontSize: 12, color: "#374151" }}>
            청력 좌 {notice.hearingDb.left}dB / 우 {notice.hearingDb.right}dB
            {notice.speechDiscrim && (
              <> / 어음명료도 좌 {notice.speechDiscrim.left}% / 우 {notice.speechDiscrim.right}%</>
            )}
          </div>
        </div>
      )}

      {/* 검증 안내 */}
      {isHuyup ? (
        <div style={{ background: "#dbeafe", color: "#1e40af", padding: 10, borderRadius: 8, fontSize: 12 }}>
          ✅ 휴업급여 통지서입니다. 아래 입력 정보가 자동으로 채워졌습니다. 연차별 평임 산정 결과를 확인하세요.
        </div>
      ) : (
        <div style={{ background: "#fffbeb", color: "#92400e", padding: 10, borderRadius: 8, fontSize: 12 }}>
          ⚠️ {notice.decisionType} 통지서 — 본 도구는 평균임금 증감 검증용입니다. 등급 일수·가족구성 등 추가 검증 로직은 향후 단계에서 추가 예정입니다.
        </div>
      )}

      {/* 경고 */}
      {notice.warnings.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#92400e" }}>
          ⚠️ {notice.warnings.join(" · ")}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   스타일
   ═══════════════════════════════════════════════════════════════ */
const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 16,
  paddingBottom: 8,
  borderBottom: "2px solid #29ABE2",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const radioLabel = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  border: `2px solid ${active ? "#29ABE2" : "#e5e7eb"}`,
  background: active ? "#f0f9ff" : "#fff",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  flex: 1,
});

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: "#374151",
};

const thStyleRight: React.CSSProperties = { ...thStyle, textAlign: "right" };

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  color: "#374151",
};

const tdStyleRight: React.CSSProperties = { ...tdStyle, textAlign: "right" };
