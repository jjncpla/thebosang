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
  const [targetYear, setTargetYear] = useState(
    Math.min(currentYear, DATA_END_YEAR)
  );
  const [originalWage, setOriginalWage] = useState<string>("50000");
  const [ratioType, setRatioType] = useState<RatioType>("wage");
  const [showDetail, setShowDetail] = useState(false);

  const wageResult = useMemo(() => {
    const wage = parseFloat(originalWage) || 0;
    return calcWageIncrease(accidentYear, targetYear, wage, ratioType);
  }, [accidentYear, targetYear, originalWage, ratioType]);

  // targetYear 가 accidentYear 보다 작아지지 않도록
  const handleAccidentYearChange = (y: number) => {
    setAccidentYear(y);
    if (targetYear <= y) setTargetYear(Math.min(y + 1, DATA_END_YEAR));
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

    // 감액 시작일: 유예 조건 해당 시 61세 도달일과 유예종료일 중 늦은 날, 아닐 경우 61세 도달일
    let reductionStartDate: Date;
    if (hasGrace) {
      reductionStartDate =
        age61Date > graceEndDate ? age61Date : graceEndDate;
    } else {
      // 실무상 재해발생일로부터 2년간 감액 미적용 (지침)
      reductionStartDate =
        age61Date > graceEndDate ? age61Date : graceEndDate;
    }

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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 8,
          color: "#29ABE2",
        }}
      >
        임금증감 계산기
      </h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 32 }}>
        산재 평균임금의 증감률 적용 및 고령자 휴업급여 감액 계산
      </p>

      {/* ─── 섹션 1: 임금증감 계산 ─── */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: "2px solid #29ABE2",
          }}
        >
          임금증감률 적용
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {/* 재해발생연도 */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              재해발생연도
            </span>
            <select
              value={accidentYear}
              onChange={(e) =>
                handleAccidentYearChange(Number(e.target.value))
              }
              style={selectStyle}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>

          {/* 기준연도 */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              기준연도 (적용할 연도)
            </span>
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(Number(e.target.value))}
              style={selectStyle}
            >
              <option value={accidentYear}>{accidentYear}년 (증감 없음)</option>
              {targetYearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 평균임금 */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
            평균임금 (원/일)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={originalWage}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              setOriginalWage(v);
            }}
            placeholder="예: 50000"
            style={inputStyle}
          />
        </label>

        {/* 증감률 유형 */}
        <div style={{ marginBottom: 20 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#374151",
              display: "block",
              marginBottom: 8,
            }}
          >
            증감률 유형
          </span>
          <div style={{ display: "flex", gap: 16 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              <input
                type="radio"
                name="ratioType"
                checked={ratioType === "wage"}
                onChange={() => setRatioType("wage")}
                style={{ accentColor: "#29ABE2" }}
              />
              전체 근로자 임금 평균액
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              <input
                type="radio"
                name="ratioType"
                checked={ratioType === "cpi"}
                onChange={() => setRatioType("cpi")}
                style={{ accentColor: "#29ABE2" }}
              />
              소비자물가변동률
            </label>
          </div>
        </div>

        {/* 결과 */}
        <div
          style={{
            background: "#f0f9ff",
            borderRadius: 8,
            padding: 20,
            border: "1px solid #bae6fd",
          }}
        >
          {accidentYear === targetYear ? (
            <p style={{ fontSize: 15, color: "#374151", textAlign: "center" }}>
              재해연도와 기준연도가 동일합니다. 증감 없음 (배율 1.0000)
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  증감 배율
                </span>
                <p
                  style={{ fontSize: 22, fontWeight: 700, color: "#0369a1" }}
                >
                  {wageResult.ratio.toFixed(4)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  증감 적용 평균임금
                </span>
                <p
                  style={{ fontSize: 22, fontWeight: 700, color: "#0369a1" }}
                >
                  {formatNumber(wageResult.adjustedWage, 2)}원
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 연도별 상세 (접기/펼치기) */}
        {accidentYear !== targetYear && wageResult.yearlyRatios.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowDetail(!showDetail)}
              style={{
                background: "none",
                border: "none",
                color: "#29ABE2",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {showDetail ? "▲" : "▼"} 연도별 증감률 상세 (
              {wageResult.yearlyRatios.length}개년)
            </button>
            {showDetail && (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <th style={thStyle}>연도</th>
                    <th style={thStyle}>증감률</th>
                    <th style={thStyle}>누적 배율</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let cum = 1;
                    return wageResult.yearlyRatios.map((yr) => {
                      cum *= yr.ratio;
                      return (
                        <tr
                          key={yr.year}
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                        >
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
      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: "2px solid #29ABE2",
          }}
        >
          고령자 휴업급여 감액 (산재법 제55조)
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              생년월일
            </span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              재해발생일
            </span>
            <input
              type="date"
              value={accidentDate}
              onChange={(e) => setAccidentDate(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        {/* 유예 조건 */}
        <div
          style={{
            marginBottom: 16,
            background: "#f9fafb",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#374151",
              display: "block",
              marginBottom: 8,
            }}
          >
            유예 조건 (해당 시 재해발생일로부터 2년 유예)
          </span>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              fontSize: 13,
              marginBottom: 6,
              cursor: "pointer",
            }}
          >
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
                <br />③ 61세 이전에 동일 질병으로 장해급여를 받은 자 (산재법
                제55조)
              </span>
            </span>
          </label>
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            * 실무상 위 조건 해당 여부와 무관하게, 재해발생일로부터 2년간은
            감액을 적용하지 않음 (지침)
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
              평균임금 (원/일)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={avgWage}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                setAvgWage(v);
              }}
              placeholder="예: 80000"
              style={inputStyle}
            />
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              paddingTop: 20,
            }}
          >
            <input
              type="checkbox"
              checked={isLowIncome}
              onChange={(e) => setIsLowIncome(e.target.checked)}
              style={{ accentColor: "#29ABE2" }}
            />
            <span style={{ fontSize: 13, color: "#374151" }}>
              저소득근로자 (90% 기준 적용)
            </span>
          </label>
        </div>

        {/* 감액률 참조 테이블 */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f1f5f9",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <th style={thStyle}>연령</th>
              <th style={thStyle}>감액률</th>
            </tr>
          </thead>
          <tbody>
            {ELDERLY_REDUCTION_RATE.map((row) => (
              <tr
                key={row.minAge}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  background:
                    elderlyResult &&
                    elderlyResult.isReduced &&
                    elderlyResult.currentAge >= row.minAge &&
                    (row.maxAge === null ||
                      elderlyResult.currentAge < row.maxAge)
                      ? "#dbeafe"
                      : undefined,
                }}
              >
                <td style={tdStyle}>
                  만 {row.minAge}세 이상{" "}
                  {row.maxAge ? `~ ${row.maxAge}세 미만` : ""}
                </td>
                <td style={tdStyle}>{(row.reductionRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 결과 */}
        {elderlyResult && (
          <div
            style={{
              background: "#f0f9ff",
              borderRadius: 8,
              padding: 20,
              border: "1px solid #bae6fd",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  만 61세 도달일
                </span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  {formatDate(elderlyResult.age61Date)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  2년 유예 종료일
                </span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  {formatDate(elderlyResult.graceEndDate)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  감액 실제 시작일
                </span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#0369a1" }}>
                  {formatDate(elderlyResult.reductionStartDate)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  현재 만 나이
                </span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  만 {elderlyResult.currentAge}세
                </p>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid #bae6fd",
                paddingTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  감액 여부
                </span>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: elderlyResult.isReduced ? "#dc2626" : "#16a34a",
                  }}
                >
                  {elderlyResult.isReduced
                    ? `감액 적용 (${(elderlyResult.reductionRate * 100).toFixed(0)}%)`
                    : "감액 미적용"}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  지급률
                </span>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#0369a1" }}>
                  {(elderlyResult.payRate * 100).toFixed(0)}%
                  {elderlyResult.isReduced &&
                    ` × ${((1 - elderlyResult.reductionRate) * 100).toFixed(0)}%`}
                </p>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  1일 휴업급여
                </span>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#0369a1" }}>
                  {formatNumber(elderlyResult.dailyBenefit, 0)}원
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 주의사항 */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: 14,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#92400e",
          }}
        >
          <strong>주의</strong>
          <br />
          공단이 재해발생일로부터 2년 이내에 감액을 적용하는 경우 정정 청구
          가능합니다.
          <br />
          법령(산재법 제55조)상 유예 요건(①③)과 지침상 유예 요건(②) 모두
          확인하세요.
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   공통 스타일
   ═══════════════════════════════════════════════════════════════ */
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
