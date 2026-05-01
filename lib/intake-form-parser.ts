// 자료입력서식 (.xls/.xlsx) 파서
// 시트 구조: "0. 이용방법 / 1. 입력 / 2. 데이터 / 3. 대리인 / 4. 특별&전문"
// 라벨-값 행 단위 (한 시트 안에서 [라벨] 셀 → 같은 행 또는 우측 셀에 값)

import * as XLSX from "xlsx";

export type ParsedIntakeForm = {
  fileName: string;
  ok: boolean;
  error: string | null;

  // 근로자
  patientName: string | null;
  patientRrn: string | null;          // 주민번호 (평문)
  patientPhone: string | null;
  patientAddress: string | null;

  // 사건 분류
  caseType: string | null;            // raw 라벨 (난청/COPD/진폐/폐암/근골격계/유족/사고)
  caseTypeCode: string | null;        // TBSS Enum 매핑 결과
  tfName: string | null;
  branchName: string | null;
  receptionDate: string | null;       // YYYY-MM-DD

  // 영업/소개 (신규 4 필드)
  introducer: string | null;
  salesStaff: string | null;
  caseChannel: string | null;
  preliminaryConsult: string | null;

  // 대리인 정보
  agentName: string | null;
  agentBranch: string | null;         // 대리인 지사명 → User 매칭용
  agentBirthDate: string | null;      // YYYY-MM-DD
  agentGender: string | null;
  agentAddress: string | null;
  agentLicenseNo: string | null;      // 직무개시번호
  agentMobile: string | null;
  agentTel: string | null;
  agentFax: string | null;

  // 특별진찰 (난청만 의미 있음)
  specialClinic: string | null;
  expertClinic: string | null;

  // 메모/원시 라벨 dump (디버깅용)
  rawLabels: Record<string, string>;
};

const EMPTY_RESULT = (
  fileName: string,
  error: string
): ParsedIntakeForm => ({
  fileName,
  ok: false,
  error,
  patientName: null,
  patientRrn: null,
  patientPhone: null,
  patientAddress: null,
  caseType: null,
  caseTypeCode: null,
  tfName: null,
  branchName: null,
  receptionDate: null,
  introducer: null,
  salesStaff: null,
  caseChannel: null,
  preliminaryConsult: null,
  agentName: null,
  agentBranch: null,
  agentBirthDate: null,
  agentGender: null,
  agentAddress: null,
  agentLicenseNo: null,
  agentMobile: null,
  agentTel: null,
  agentFax: null,
  specialClinic: null,
  expertClinic: null,
  rawLabels: {},
});

// caseType 매핑
export function mapCaseType(raw: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/\s/g, "").toUpperCase();

  if (s.includes("난청") || /HEARING/i.test(s)) return "HEARING_LOSS";
  if (s.includes("COPD") || s.includes("폐쇄성")) return "COPD";
  if (s.includes("진폐")) return "PNEUMOCONIOSIS";
  if (s.includes("폐암") || s.includes("암") || /CANCER/i.test(s)) return "OCCUPATIONAL_CANCER";
  if (s.includes("근골격") || s.includes("디스크") || s.includes("어깨") || s.includes("허리"))
    return "MUSCULOSKELETAL";
  if (s.includes("사고") || s.includes("재해사고") || s.includes("업무상사고") || /ACCIDENT/i.test(s))
    return "OCCUPATIONAL_ACCIDENT";
  if (s.includes("유족") || /BEREAV/i.test(s)) return "BEREAVED";
  return "OTHER";
}

// 셀 → 문자열
function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    // Excel 시리얼 날짜 범위
    if (v > 1000 && v < 2958465 && Number.isInteger(v)) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const dt = new Date(epoch.getTime() + v * 86400000);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(v);
  }
  return String(v).trim();
}

// 시트를 2D 배열로 (셀 미스 허용)
function sheetTo2D(ws: XLSX.WorkSheet): string[][] {
  if (!ws) return [];
  const arr = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];
  return arr.map((row) =>
    Array.isArray(row) ? row.map((v) => cellStr(v)) : []
  );
}

// 라벨 → 값 추출. 한 시트 내에서 라벨 셀 발견 시 같은 행의 우측 셀들 중 첫 비어있지 않은 값을 반환
function findValueByLabel(
  rows: string[][],
  labelMatchers: (string | RegExp)[]
): string | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || "").trim();
      if (!cell) continue;
      const hit = labelMatchers.some((m) =>
        typeof m === "string" ? cell.includes(m) : m.test(cell)
      );
      if (!hit) continue;
      // 같은 행 우측 셀 탐색
      for (let cc = c + 1; cc < row.length; cc++) {
        const val = (row[cc] || "").trim();
        // 라벨 같은 셀 (다른 라벨)이면 skip
        if (val && !looksLikeLabel(val)) {
          return val;
        }
      }
      // 다음 행 같은 열도 탐색 (병합셀 케이스)
      if (r + 1 < rows.length) {
        const v2 = (rows[r + 1][c] || "").trim();
        if (v2 && !looksLikeLabel(v2)) return v2;
        const v3 = (rows[r + 1][c + 1] || "").trim();
        if (v3 && !looksLikeLabel(v3)) return v3;
      }
    }
  }
  return null;
}

function looksLikeLabel(s: string): boolean {
  // [근로자], [대리인] 같은 라벨 헤더는 값으로 보지 않음
  // (Ex: ...), 안내 문구도 값으로 보지 않음
  return (
    /^\[[^\]]+\]/.test(s) ||
    /^[★※]/.test(s) ||
    /^\(Ex\s*[:：]/i.test(s) ||
    /^Ex\s*[:：]/i.test(s)
  );
}

// 모든 라벨/값 dump (디버깅 + 알려지지 않은 라벨 추적용)
function collectAllLabels(rows: string[][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || "").trim();
      if (!cell) continue;
      // 명시적 [..] 라벨만 dump
      const m = cell.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (!m) continue;
      const labelKey = m[1] + (m[2] ? " " + m[2] : "");
      // 우측 첫 비어있지 않은 값
      let val: string | null = null;
      for (let cc = c + 1; cc < row.length; cc++) {
        const v = (row[cc] || "").trim();
        if (v && !looksLikeLabel(v)) {
          val = v;
          break;
        }
      }
      if (val) out[labelKey] = val;
    }
  }
  return out;
}

// 주민번호 정규화: 6자리-7자리 패턴, 하이픈 자동 추가
function normalizeRrn(s: string | null): string | null {
  if (!s) return null;
  const cleaned = s.replace(/[\s-]/g, "");
  if (/^\d{13}$/.test(cleaned)) {
    return `${cleaned.slice(0, 6)}-${cleaned.slice(6)}`;
  }
  if (/^\d{6}-\d{7}$/.test(s.trim())) return s.trim();
  return null;
}

// 파일명에서 caseType 키워드 추출 (자료입력서식260212_폐암,폐섬유화_김현수.xls 같은 패턴)
function inferCaseTypeFromFileName(fileName: string): string | null {
  const stripped = fileName.replace(/\.[^.]+$/, "");
  // 가장 먼저 매칭되는 키워드 반환 (mapCaseType에서 다시 코드 변환됨)
  const KEYWORDS = [
    "난청",
    "COPD",
    "폐쇄성",
    "진폐",
    "폐암",
    "근골격",
    "유족",
    "직업성암",
    "사고",
    "재해사고",
  ];
  for (const k of KEYWORDS) {
    if (stripped.toUpperCase().includes(k.toUpperCase())) return k;
  }
  return null;
}

// 라벨 dump에서 caseType 추론 (예: "[근로자 분진 사업장명]" 있으면 진폐, "[근로자 난청 직종]" 있으면 난청)
function inferCaseTypeFromRawLabels(
  ...rowGroups: string[][][]
): string | null {
  let hasNoise = false;
  let hasDust = false;
  let hasCopd = false;
  for (const rows of rowGroups) {
    for (const row of rows) {
      for (const cell of row) {
        if (!cell) continue;
        const c = cell as string;
        if (c.includes("난청")) hasNoise = true;
        if (c.includes("분진")) hasDust = true;
        if (c.toUpperCase().includes("COPD")) hasCopd = true;
      }
    }
  }
  if (hasCopd) return "COPD";
  if (hasDust) return "진폐";
  if (hasNoise) return "난청";
  return null;
}

// 날짜 정규화 (YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD or Excel 시리얼 string)
function normalizeDate(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // 이미 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

/**
 * 자료입력서식 단일 파일 버퍼 → ParsedIntakeForm
 */
export function parseIntakeFormBuffer(
  buf: Buffer,
  fileName: string
): ParsedIntakeForm {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch (e) {
    return EMPTY_RESULT(
      fileName,
      `엑셀 파싱 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`
    );
  }

  const sheetNames = wb.SheetNames;

  // 시트 매칭 (정확 매칭 → 부분 매칭)
  const findSheet = (...keywords: string[]): XLSX.WorkSheet | null => {
    for (const kw of keywords) {
      const exact = sheetNames.find((n) => n === kw);
      if (exact) return wb.Sheets[exact];
    }
    for (const kw of keywords) {
      const partial = sheetNames.find((n) => n.includes(kw));
      if (partial) return wb.Sheets[partial];
    }
    return null;
  };

  const inputSheet = findSheet("1. 입력", "1.입력", "입력");
  const agentSheet = findSheet("3. 대리인", "3.대리인", "대리인");
  const examSheet = findSheet("4. 특별&전문", "4.특별&전문", "4. 특별", "특별&전문", "특별");

  if (!inputSheet) {
    return EMPTY_RESULT(
      fileName,
      `필수 시트 "1. 입력"을 찾을 수 없습니다 (시트: ${sheetNames.join(", ")})`
    );
  }

  const inputRows = sheetTo2D(inputSheet);
  const agentRows = agentSheet ? sheetTo2D(agentSheet) : [];
  const examRows = examSheet ? sheetTo2D(examSheet) : [];

  const result = EMPTY_RESULT(fileName, "");
  result.ok = true;
  result.error = null;

  // ─ 근로자 정보 ─
  // 라벨 형식이 두 가지 혼재: "[근로자] 성명" 과 "[근로자 성명]" — 둘 다 대응
  result.patientName =
    findValueByLabel(inputRows, [/\[근로자[\]\s]*\s*(성명|이름)\]?/]) ||
    findValueByLabel(inputRows, ["성명", "이름"]);

  result.patientRrn = normalizeRrn(
    findValueByLabel(inputRows, [/\[근로자[\]\s]*\s*주민번호\]?/, "주민번호"])
  );

  result.patientPhone = findValueByLabel(inputRows, [
    /\[근로자[\]\s]*\s*연락처/,
    /\[근로자[\]\s]*\s*휴대/,
    /\[근로자[\]\s]*\s*H\.?P/i,
  ]);

  result.patientAddress = findValueByLabel(inputRows, [
    /\[근로자[\]\s]*\s*주소\]?/,
  ]);

  // ─ 사건 분류 ─
  result.caseType =
    findValueByLabel(inputRows, [
      "사건종류",
      "사건 종류",
      "사건구분",
    ]) ||
    // 파일명에서도 추론 (예: "1_자료입력서식260212_폐암,폐섬유화,간폐_김현수.xls")
    inferCaseTypeFromFileName(fileName) ||
    // 라벨 dump에서 추론 (분진/난청 prefix가 있으면 해당 caseType으로)
    inferCaseTypeFromRawLabels(inputRows, agentRows, examRows);

  result.caseTypeCode = mapCaseType(result.caseType);

  result.tfName = findValueByLabel(inputRows, [/\bTF\b/, "관할TF"]);

  result.branchName = findValueByLabel(inputRows, [
    "지사명",
    "[지사]",
    "관할지사",
    "지역본부",
  ]);

  // 접수일자는 정확한 라벨 매칭만 (안내문/Ex 문구가 함께 들어가는 셀이 많음)
  result.receptionDate = normalizeDate(
    findValueByLabel(inputRows, [
      /^\[?접수일자\]?$/,
      /^\[?접수일\]?$/,
      /^\[?수임일자\]?$/,
      /^\[?수임일\]?$/,
      /^\[?위임일\]?$/,
    ])
  );

  // ─ 신규 4 필드 ─
  result.introducer = findValueByLabel(inputRows, [
    "소개자",
    "[소개자]",
  ]);

  result.salesStaff = findValueByLabel(inputRows, [
    "영업담당자",
    "[영업담당자]",
    "영업 담당자",
  ]);

  result.caseChannel = findValueByLabel(inputRows, [
    "사건경로",
    "[사건경로]",
    "사건 경로",
    "유입경로",
  ]);

  result.preliminaryConsult = findValueByLabel(inputRows, [
    "예비 문진",
    "예비문진",
    "[예비문진]",
    "[예비 문진]",
  ]);

  // ─ 대리인 정보 (시트 "3. 대리인" 우선, 없으면 "1. 입력") ─
  // 라벨 형식: "[대리인] 이름" 과 "[대리인 이름]" 둘 다 대응
  const agentLookupRows =
    agentRows.length > 0 ? [...agentRows, ...inputRows] : inputRows;

  result.agentName = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*(이름|성명)\]?/,
  ]);

  result.agentBranch = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*지사/,
  ]);

  result.agentBirthDate = normalizeDate(
    findValueByLabel(agentLookupRows, [/\[대리인[\]\s]*\s*생년/])
  );

  result.agentGender = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*성별/,
  ]);

  result.agentAddress = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*주소/,
  ]);

  result.agentLicenseNo = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*직무개시/,
    "직무개시번호",
  ]);

  result.agentMobile = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*연락처(?!.*FAX)/,
    /\[대리인[\]\s]*\s*휴대/,
    /\[대리인[\]\s]*\s*H\.?P/i,
  ]);

  result.agentTel = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*전화/,
    /\[대리인[\]\s]*\s*☎/,
  ]);

  result.agentFax = findValueByLabel(agentLookupRows, [
    /\[대리인[\]\s]*\s*FAX/i,
    /\[대리인[\]\s]*\s*팩스/,
  ]);

  // ─ 특별진찰 / 전문조사 (시트 "4. 특별&전문") ─
  const examLookupRows =
    examRows.length > 0 ? [...examRows, ...inputRows] : inputRows;

  result.specialClinic = findValueByLabel(examLookupRows, [
    /\[특별진찰[\]\s]*\s*(병원명|의료기관|병원)\]?/,
    "특별진찰 병원",
  ]);

  result.expertClinic = findValueByLabel(examLookupRows, [
    /\[전문조사[\]\s]*\s*(기관명|병원명|기관)\]?/,
    "전문조사 기관",
  ]);

  // ─ 라벨 dump (디버깅용) ─
  result.rawLabels = {
    ...collectAllLabels(inputRows),
    ...collectAllLabels(agentRows),
    ...collectAllLabels(examRows),
  };

  return result;
}
