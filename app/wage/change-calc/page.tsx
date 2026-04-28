"use client";

import { useState, useMemo } from "react";
import {
  WAGE_INCREASE_RATIO,
  CPI_RATIO,
  DATA_START_YEAR,
  DATA_END_YEAR,
} from "./wageData";

/* ═══════════════════════════════════════════════════════════════
   타입
   ═══════════════════════════════════════════════════════════════ */
type RatioType = "wage" | "cpi";

interface WageResult {
  ratio: number;
  adjustedWage: number;
  yearlyRatios: { year: number; ratio: number }[];
}

interface ElderlyResult {
  age61Date: Date;
  graceEndDate: Date;
  reductionStartDate: Date;
  currentAge: number;
  reductionRate: number;
  isReduced: boolean;
  payRate: number;
  dailyBenefit: number;
}

/* ═══════════════════════════════════════════════════════════════
   고령자 감액률 테이블 (산재법 별표1)
   ═══════════════════════════════════════════════════════════════ */
const ELDERLY_REDUCTION_RATE = [
  { minAge: 61, maxAge: 62, reductionRate: 0.04 },
  { minAge: 62, maxAge: 63, reductionRate: 0.08 },
  { minAge: 63, maxAge: 64, reductionRate: 0.12 },
  { minAge: 64, maxAge: 65, reductionRate: 0.16 },
  { minAge: 65, maxAge: null as number | null, reductionRate: 0.2 },
];

/* ═══════════════════════════════════════════════════════════════
   2008년 전후 적용 기준 자동 판단
   산재법 제36조 개정(시행 2008.07.01) 기준
   - 2008.06.30 이전 재해: 소비자물가변동률(CPI)
   - 2008.07.01 이후 재해: 전체 근로자 임금 평균액 증감률
   ═══════════════════════════════════════════════════════════════ */
function detectRatioType(year: number, month: number): {
  type: RatioType;
  basis: string;
  isAmbiguous: boolean;
} {
  if (year < 2008) {
    return {
      type: "cpi",
      basis: "구 산재법 적용 (2008.07.01 이전 재해) → 소비자물가변동률",
      isAmbiguous: false,
    };
  }
  if (year > 2008) {
    return {
      type: "wage",
      basis: "개정 산재법 제36조 적용 (2008.07.01 이후 재해) → 전체 근로자 임금 평균액 증감률",
      isAmbiguous: false,
    };
  }
  // 2008년: 월 기준으로 분기
  if (month < 7) {
    return {
      type: "cpi",
      basis: `2008년 ${month}월 재해 → 2008.07.01 시행 전 → 소비자물가변동률`,
      isAmbiguous: false,
    };
  }
  return {
    type: "wage",
    basis: `2008년 ${month}월 재해 → 개정 산재법 시행 후 → 전체 근로자 임금 평균액 증감률`,
    isAmbiguous: false,
  };
}

/* ═══════════════════════════════════════════════════════════════
   헬퍼 함수
   ═══════════════════════════════════════════════════════════════ */
function calcWageIncrease(
  accidentYear: number,
  targetYear: number,
  originalWage: number,
  type: RatioType
): WageResult {
  const ratioData = type === "wage" ? WAGE_INCREASE_RATIO : CPI_RATIO;
  const yearlyRatios: { year: number; ratio: number }[] = [];
  let cumulativeRatio = 1;

  for (let y = accidentYear + 1; y <= targetYear; y++) {
    const r = ratioData[y] ?? 1;
    cumulativeRatio *= r;
    yearlyRatios.push({ year: y, ratio: r });
  }

  return {
    ratio: cumulativeRatio,
    adjustedWage: originalWage * cumulativeRatio,
    yearlyRatios,
  };
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function calcAge(birth: Date, ref: Date): number {
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

function getReductionRate(age: number): number {
  for (const row of ELDERLY_REDUCTION_RATE) {
    if (age >= row.minAge && (row.maxAge === null || age < row.maxAge)) {
      return row.reductionRate;
    }
  }
  return 0;
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

/* ═══════════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════════ */
export default function WageChangeCalcPage() {
  const currentYear = new Date().getFullYear();

  /* --- 섹션1: 임금증감 --- */
  const [accidentYear, setAccidentYear] = useState(2020);
  const [accidentMonth, setAccidentMonth] = useState(1);
  const [targetYear, setTargetYear] = useState(
    Math.min(currentYear, DATA_END_YEAR)
  );
  const [originalWage, setOriginalWage] = useState<string>("50000");
  const [showDetail, setShowDetail] = useState(false);
  const [manualOverride, setManualOverride] = useState<RatioType | null>(null);

  const autoDetected = useMemo(
    () => detectRatioType(accidentYear, accidentMonth),
    [accidentYear, accidentMonth]
  );
  const activeType: RatioType = manualOverride ?? autoDetected.type;

  const wageResult = useMemo(() => {
    const wage = parseFloat(originalWage) || 0;
    return calcWageIncrease(accidentYear, targetYear, wage, "wage");
  }, [accidentYear, targetYear, originalWage]);

  const cpiResult = useMemo(() => {
    const wage = parseFloat(originalWage) || 0;
    return calcWageIncrease(accidentYear, targetYear, wage, "cpi");
  }, [accidentYear, targetYear, originalWage]);

  const activeResult = activeType === "wage" ? wageResult : cpiResult;

  const handleAccidentYearChange = (y: number) => {
    setAccidentYear(y);
    if (targetYear <= y) setTargetYear(Math.min(y + 1, DATA_END_YEAR));
    setManualOverride(null); // 연도 바꾸면 자동 판단 초기화
  };

  const handleAccidentMonthChange = (m: number) => {
    setAccidentMonth(m);
    setManualOverride(null);
  };

  /* --- 섹션2: 고령자 감액 --- */
  const [birthDate, setBirthDate] = useState("");
  const [accidentDate, setAccidentDate] = useState("");
  const [hasGrace, setHasGrace] = useState(false);
  const [avgWage, setAvgWage] = useState<string>("80000");
  const [isLowIncome, setIsLowIncome] = useState(false);

  const elderlyResult = useMemo<ElderlyResult | null>(() => {
    if (!birthDate || !accidentDate) return null;
    const birth = new Date(birthDate);
    const accident = new Date(accidentDate);
    if (isNaN(birth.getTime()) || isNaN(accident.getTime())) return null;

    const today = new Date();
    const age61Date = addYears(birth, 61);
    const graceEndDate = addYears(accident, 2);

    // 감액 시작일: 실무상 재해발생일로부터 2년간 감액 미적용 (지침)
    const reductionStartDate =
      age61Date > graceEndDate ? age61Date : graceEndDate;

    const currentAge = calcAge(birth, today);
    const isReduced = today >= reductionStartDate && currentAge >= 61;
    const reductionRate = isReduced ? getReductionRate(currentAge) : 0;
    const payRate = isLowIncome ? 0.9 : 0.7;
    const wage = parseFloat(avgWage) || 0;
    const dailyBenefit = wage * payRate * (1 - reductionRate);

    return {
      age61Date,
      graceEndDate,
      reductionStartDate,
      currentAge,
      reductionRate,
      isReduced,
      payRate,
      dailyBenefit,
    };
  }, [birthDate, accidentDate, hasGrace, avgWage, isLowIncome]);

  /* ═══════════════════════════════════════════════════════════════
     렌더링
     ═══════════════════════════════════════════════════════════════ */
  const yearOptions = Array.from(
    { length: DATA_END_YEAR - DATA_START_YEAR + 1 },
    (_, i) => DATA_START_YEAR + i
  );

  const targetYearOptions = Array.from(
    { length: DATA_END_YEAR - accidentYear },
    (_, i) => accidentYear + 1 + i
  );

  const isSameYear = accidentYear === targetYear;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#29ABE2" }}>
        임금증감 계산기
      </h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 32 }}>
        산재 평균임금의 증감률 적용 및 고령자 휴업급여 감액 계산
      </p>

      {/* ─── 섹션 1: 임금증감 계산 ─── */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>임금증감률 적용</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* 재해발생연도 */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>재해발생연도</span>
            <select
              value={accidentYear}
              onChange={(e) => handleAccidentYearChange(Number(e.target.value))}
              style={selectStyle}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </label>

          {/* 재해발생월 — 2008년일 때만 강조 */}
          <label style={labelStyle}>
            <span style={{
              ...labelTextStyle,
              color: accidentYear === 2008 ? "#dc2626" : "#374151",
              fontWeight: accidentYear === 2008 ? 700 : 500,
            }}>
              재해발생월 {accidentYear === 2008 && <span style={{ fontSize: 11, color: "#dc2626" }}>★ 2008년 필수</span>}
            </span>
            <select
              value={accidentMonth}
              onChange={(e) => handleAccidentMonthChange(Number(e.target.value))}
              style={{
                ...selectStyle,
                borderColor: accidentYear === 2008 ? "#dc2626" : "#d1d5db",
                background: accidentYear === 2008 ? "#fff5f5" : "#fff",
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </label>

          {/* 기준연도 */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>기준연도 (적용할 연도)</span>
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(Number(e.target.value))}
              style={selectStyle}
            >
              <option value={accidentYear}>{accidentYear}년 (증감 없음)</option>
              {targetYearOptions.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </label>
        </div>

        {/* 평균임금 */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          <span style={labelTextStyle}>평균임금 (원/일)</span>
          <input
            type="text"
            inputMode="numeric"
            value={originalWage}
            onChange={(e) => setOriginalWage(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="예: 50000"
            style={inputStyle}
          />
        </label>

        {/* ── 법령 자동 판단 배너 ── */}
        <div style={{
          background: manualOverride ? "#fffbeb" : "#f0fdf4",
          border: `1px solid ${manualOverride ? "#fde68a" : "#bbf7d0"}`,
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>
            {manualOverride ? "⚠️" : "⚖️"}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#166534", margin: 0, marginBottom: 2 }}>
              {manualOverride
                ? `수동 선택: ${activeType === "wage" ? "전체 근로자 임금 평균액 증감률" : "소비자물가변동률"}`
                : `자동 판단: ${autoDetected.type === "wage" ? "전체 근로자 임금 평균액 증감률" : "소비자물가변동률"}`}
            </p>
            <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
              {autoDetected.basis}
            </p>
            {manualOverride && (
              <button
                onClick={() => setManualOverride(null)}
                style={{ marginTop: 6, fontSize: 11, color: "#6b7280", background: "none", border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
              >
                자동 판단으로 되돌리기
              </button>
            )}
          </div>
        </div>

        {/* ── 두 증감률 비교 ── */}
        {!isSameYear && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* 전체 근로자 임금 증감률 */}
            <div
              onClick={() => setManualOverride("wage")}
              style={{
                border: `2px solid ${activeType === "wage" ? "#29ABE2" : "#e5e7eb"}`,
                borderRadius: 10,
                padding: 16,
                cursor: "pointer",
                background: activeType === "wage" ? "#f0f9ff" : "#fafafa",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>전체 근로자 임금 평균액</span>
                {autoDetected.type === "wage" && (
                  <span style={{ fontSize: 10, background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>자동적용</span>
                )}
                {manualOverride === "wage" && (
                  <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>수동선택</span>
                )}
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#0369a1", margin: 0 }}>
                {wageResult.ratio.toFixed(4)}배
              </p>
              <p style={{ fontSize: 14, color: "#0369a1", margin: "4px 0 0" }}>
                {formatNumber(wageResult.adjustedWage, 2)}원
              </p>
            </div>

            {/* 소비자물가변동률 */}
            <div
              onClick={() => setManualOverride("cpi")}
              style={{
                border: `2px solid ${activeType === "cpi" ? "#29ABE2" : "#e5e7eb"}`,
                borderRadius: 10,
                padding: 16,
                cursor: "pointer",
                background: activeType === "cpi" ? "#f0f9ff" : "#fafafa",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>소비자물가변동률</span>
                {autoDetected.type === "cpi" && (
                  <span style={{ fontSize: 10, background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>자동적용</span>
                )}
                {manualOverride === "cpi" && (
                  <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>수동선택</span>
                )}
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#0369a1", margin: 0 }}>
                {cpiResult.ratio.toFixed(4)}배
              </p>
              <p style={{ fontSize: 14, color: "#0369a1", margin: "4px 0 0" }}>
                {formatNumber(cpiResult.adjustedWage, 2)}원
              </p>
            </div>
          </div>
        )}

        {/* 최종 결과 */}
        <div style={{ background: "#f0f9ff", borderRadius: 8, padding: 20, border: "1px solid #bae6fd" }}>
          {isSameYear ? (
            <p style={{ fontSize: 15, color: "#374151", textAlign: "center" }}>
              재해연도와 기준연도가 동일합니다. 증감 없음 (배율 1.0000)
            </p>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                적용 증감률 ({activeType === "wage" ? "전체 근로자 임금 평균액" : "소비자물가변동률"}) 최종 결과
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>증감 배율</span>
                  <p style={{ fontSize: 26, fontWeight: 700, color: "#0369a1", margin: 0 }}>
                    {activeResult.ratio.toFixed(4)}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>증감 적용 평균임금</span>
                  <p style={{ fontSize: 26, fontWeight: 700, color: "#0369a1", margin: 0 }}>
                    {formatNumber(activeResult.adjustedWage, 2)}원
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 연도별 상세 (접기/펼치기) */}
        {!isSameYear && activeResult.yearlyRatios.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowDetail(!showDetail)}
              style={{ background: "none", border: "none", color: "#29ABE2", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
            >
              {showDetail ? "▲" : "▼"} 연도별 증감률 상세 ({activeResult.yearlyRatios.length}개년)
            </button>
            {showDetail && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={thStyle}>연도</th>
                    <th style={thStyle}>증감률 ({activeType === "wage" ? "임금" : "CPI"})</th>
                    <th style={thStyle}>누적 배율</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let cum = 1;
                    return activeResult.yearlyRatios.map((yr) => {
                      cum *= yr.ratio;
                      return (
                        <tr key={yr.year} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={tdStyle}>{yr.year}년</td>
                          <td style={tdStyle}>{yr.ratio.toFixed(4)}</td>
                          <td style={tdStyle}>{cum.toFixed(4)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {/* ─── 섹션 2: 고령자 휴업급여 감액 ─── */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>고령자 휴업급여 감액 (산재법 제55조)</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>생년월일</span>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>재해발생일</span>
            <input type="date" value={accidentDate} onChange={(e) => setAccidentDate(e.target.value)} style={inputStyle} />
          </label>
        </div>

        {/* 유예 조건 */}
        <div style={{ marginBottom: 16, background: "#f9fafb", borderRadius: 8, padding: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 8 }}>
            유예 조건 (해당 시 재해발생일로부터 2년 유예)
          </span>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, marginBottom: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hasGrace}
              onChange={(e) => setHasGrace(e.target.checked)}
              style={{ marginTop: 2, accentColor: "#29ABE2" }}
            />
            <span>
              해당 조건 있음
              <br />
              <span style={{ color: "#6b7280", fontSize: 12 }}>
                ① 61세 이후 취업 중인 자 (산재법 제55조)
                <br />
                ② 61세 이후 재해를 당한 자 (보상업무처리규정)
                <br />
                ③ 61세 이전에 동일 질병으로 장해급여를 받은 자 (산재법 제55조)
              </span>
            </span>
          </label>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, marginBottom: 0 }}>
            * 실무상 위 조건 해당 여부와 무관하게, 재해발생일로부터 2년간은 감액을 적용하지 않음 (지침)
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>평균임금 (원/일)</span>
            <input
              type="text"
              inputMode="numeric"
              value={avgWage}
              onChange={(e) => setAvgWage(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="예: 80000"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingTop: 20 }}>
            <input
              type="checkbox"
              checked={isLowIncome}
              onChange={(e) => setIsLowIncome(e.target.checked)}
              style={{ accentColor: "#29ABE2" }}
            />
            <span style={{ fontSize: 13, color: "#374151" }}>저소득근로자 (90% 기준 적용)</span>
          </label>
        </div>

        {/* 감액률 참조 테이블 */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
              <th style={thStyle}>연령</th>
              <th style={thStyle}>감액률</th>
              <th style={thStyle}>휴업급여 지급률 (일반)</th>
              <th style={thStyle}>휴업급여 지급률 (저소득)</th>
            </tr>
          </thead>
          <tbody>
            {ELDERLY_REDUCTION_RATE.map((row) => {
              const isHighlighted =
                elderlyResult &&
                elderlyResult.isReduced &&
                elderlyResult.currentAge >= row.minAge &&
                (row.maxAge === null || elderlyResult.currentAge < row.maxAge);
              return (
                <tr
                  key={row.minAge}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: isHighlighted ? "#dbeafe" : undefined,
                    fontWeight: isHighlighted ? 700 : undefined,
                  }}
                >
                  <td style={tdStyle}>
                    만 {row.minAge}세 이상{row.maxAge ? ` ~ ${row.maxAge}세 미만` : ""}
                    {isHighlighted && <span style={{ marginLeft: 6, fontSize: 11, color: "#1d4ed8" }}>◀ 현재</span>}
                  </td>
                  <td style={tdStyle}>{(row.reductionRate * 100).toFixed(0)}%</td>
                  <td style={tdStyle}>{((0.7 * (1 - row.reductionRate)) * 100).toFixed(1)}%</td>
                  <td style={tdStyle}>{((0.9 * (1 - row.reductionRate)) * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 결과 */}
        {elderlyResult && (
          <div style={{ background: "#f0f9ff", borderRadius: 8, padding: 20, border: "1px solid #bae6fd", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>만 61세 도달일</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: 0 }}>{formatDate(elderlyResult.age61Date)}</p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>2년 유예 종료일</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: 0 }}>{formatDate(elderlyResult.graceEndDate)}</p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>감액 실제 시작일</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#0369a1", margin: 0 }}>{formatDate(elderlyResult.reductionStartDate)}</p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>현재 만 나이</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: 0 }}>만 {elderlyResult.currentAge}세</p>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #bae6fd", paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>감액 여부</span>
                <p style={{ fontSize: 16, fontWeight: 700, color: elderlyResult.isReduced ? "#dc2626" : "#16a34a", margin: 0 }}>
                  {elderlyResult.isReduced
                    ? `감액 적용 (${(elderlyResult.reductionRate * 100).toFixed(0)}%)`
                    : "감액 미적용"}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>지급률</span>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#0369a1", margin: 0 }}>
                  {(elderlyResult.payRate * 100).toFixed(0)}%
                  {elderlyResult.isReduced &&
                    ` × ${((1 - elderlyResult.reductionRate) * 100).toFixed(0)}%`}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>1일 휴업급여</span>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#0369a1", margin: 0 }}>
                  {formatNumber(elderlyResult.dailyBenefit, 0)}원
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 주의사항 */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.6, color: "#92400e" }}>
          <strong>주의</strong>
          <br />
          공단이 재해발생일로부터 2년 이내에 감액을 적용하는 경우 정정 청구 가능합니다.
          <br />
          법령(산재법 제55조)상 유예 요건(①③)과 지침상 유예 요건(②) 모두 확인하세요.
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   공통 스타일
   ═══════════════════════════════════════════════════════════════ */
const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginBottom: 24,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 20,
  paddingBottom: 12,
  borderBottom: "2px solid #29ABE2",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 13,
};

const tdStyle: React.CSSProperties = {
  padding: "6px 12px",
  textAlign: "left",
};
