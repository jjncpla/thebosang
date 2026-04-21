import * as XLSX from "xlsx";

/** Excel 시리얼 넘버 또는 Date 객체 또는 문자열을 JS Date로 변환 */
export function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** TF명 정규화: "울산" → "울산TF", "울동" → "울산동부TF" 등 */
export function normalizeTfName(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const MAP: Record<string, string> = {
    "울산": "이산울산TF",
    "울동": "울산동부TF",
    "울산동부": "울산동부TF",
    "울산남부": "울산남부TF",
    "울산북부": "울산북부TF",
    "부산": "이산부산TF",
    "경남": "경남TF",
    "서울": "서울TF",
    "경기": "경기TF",
    "인천": "인천TF",
    "대구": "이산대구TF",
    "광주": "광주TF",
    "대전": "대전TF",
  };
  return MAP[s] ?? (s ? s + "TF" : null);
}

/** 심사청구/재심사청구 필드 파싱
 *  예: "기각(23-09-14)", "인용(23-09-07)", "제척도과", Date 객체, null
 */
export function parseClaimField(value: unknown): {
  claimDate: Date | null;
  result: string | null;
  resultDate: Date | null;
} {
  if (!value) return { claimDate: null, result: null, resultDate: null };

  // 이미 Date 객체 (날짜만 있는 경우)
  if (value instanceof Date) {
    return { claimDate: isNaN(value.getTime()) ? null : value, result: null, resultDate: null };
  }

  // 숫자(Excel 시리얼 날짜)
  if (typeof value === "number") {
    const d = toDate(value);
    return { claimDate: d, result: null, resultDate: null };
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return { claimDate: null, result: null, resultDate: null };

    // "기각(23-09-14)" / "인용(23-09-07)" 패턴
    const match = s.match(/^(기각|인용|취하|각하|인정|부인)\((\d{2,4}-\d{2}-\d{2})\)$/);
    if (match) {
      const raw = match[2];
      // 2자리 연도 처리
      const parts = raw.split("-");
      const year = parts[0].length === 2 ? "20" + parts[0] : parts[0];
      const dateStr = `${year}-${parts[1]}-${parts[2]}`;
      return { claimDate: null, result: match[1], resultDate: new Date(dateStr) };
    }

    // "제척도과" 등 특수 텍스트
    if (/[가-힣]/.test(s) && !s.includes("(")) {
      return { claimDate: null, result: s, resultDate: null };
    }

    // 날짜 문자열 시도
    const d = toDate(s);
    if (d) return { claimDate: d, result: null, resultDate: null };
  }

  return { claimDate: null, result: null, resultDate: null };
}

/** arrayBuffer → 워크북 */
export function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

/** 워크북에서 특정 시트를 JSON 배열로 추출
 *  headerRow: 0-indexed 헤더 행 번호
 *  dataStartRow: 0-indexed 데이터 시작 행
 */
export function sheetToRows(
  wb: XLSX.WorkBook,
  sheetName: string | number,
  headerRow: number,
  dataStartRow: number
): Record<string, unknown>[] {
  let ws: XLSX.WorkSheet | undefined;
  if (typeof sheetName === "number") {
    ws = wb.Sheets[wb.SheetNames[sheetName]];
  } else {
    ws = wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames[0]];
  }
  if (!ws) return [];

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  if (!raw || raw.length <= headerRow) return [];

  const headers = (raw[headerRow] as unknown[]).map((h) =>
    h !== null && h !== undefined ? String(h).trim() : ""
  );

  const rows: Record<string, unknown>[] = [];
  for (let i = dataStartRow; i < raw.length; i++) {
    const rowArr = raw[i] as unknown[];
    // 빈 행 스킵 (모든 값이 null/undefined/빈문자열)
    const hasData = rowArr.some((v) => v !== null && v !== undefined && v !== "");
    if (!hasData) continue;

    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      if (h) row[h] = rowArr[j] ?? null;
    });
    rows.push(row);
  }
  return rows;
}

/** 셀 값을 문자열로 (null/undefined → null) */
export function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

/** 셀 값을 Float로 (파싱 실패 → null) */
export function flt(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}
