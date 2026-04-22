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

// ── HCell (한컴셀) xlsx 전용 파서 ──────────────────────────────────────────
// XLSX 라이브러리가 hs: 네임스페이스 태그를 처리하지 못하는 문제를 우회.
// bookFiles 옵션으로 raw zip 엔트리에 직접 접근해 XML을 자체 파싱한다.

function colLetterToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + col.charCodeAt(i) - 64;
  }
  return idx - 1;
}

function parseHCellSharedStrings(xml: string): string[] {
  // hs: 네임스페이스 태그 제거 (한컴셀 전용 서식 태그)
  const clean = xml
    .replace(/<hs:[^>]*\/>/g, "")
    .replace(/<hs:[^>]*>[\s\S]*?<\/hs:[^>]*>/g, "");
  const strs: string[] = [];
  const siRe = /<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(clean)) !== null) {
    let text = "";
    const tRe = /<(?:\w+:)?t(?:\s[^>]*)?>([^<]*)<\/(?:\w+:)?t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(m[1])) !== null) text += tm[1];
    strs.push(text);
  }
  return strs;
}

function excelSerialToDate(serial: number): Date {
  // Excel 날짜 시리얼 → JS Date (UTC)
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(epoch.getTime() + serial * 86400000);
}

function parseHCellWorksheet(
  xml: string,
  strs: string[],
  headerRow: number,   // 0-indexed
  dataStartRow: number // 0-indexed
): Record<string, unknown>[] {
  // 각 행을 파싱: <x:row r="N" ...>...</x:row>
  const rowRe = /<(?:\w+:)?row\s[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g;
  const cellRe = /<(?:\w+:)?c\s[^>]*r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g;
  const vRe = /<(?:\w+:)?v[^>]*>([^<]*)<\/(?:\w+:)?v>/;
  const fRe = /<(?:\w+:)?f[^>]*>([^<]*)<\/(?:\w+:)?f>/;

  const rowMap: Map<number, Record<number, unknown>> = new Map();

  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) !== null) {
    const rowIdx = parseInt(rm[1], 10) - 1; // 0-indexed
    if (rowIdx < headerRow) continue;

    const colMap: Record<number, unknown> = {};
    const rowXml = rm[2];
    const cellReLocal = new RegExp(cellRe.source, "g");
    let cm: RegExpExecArray | null;
    while ((cm = cellReLocal.exec(rowXml)) !== null) {
      const colLetter = cm[1];
      const colIdx = colLetterToIndex(colLetter);
      const attrs = cm[3];
      const cellBody = cm[4];
      const isSharedStr = /t\s*=\s*["']s["']/.test(attrs);
      const isInlineStr = /t\s*=\s*["']inlineStr["']/.test(attrs);
      const isDate = /s\s*=\s*["']\d+["']/.test(attrs); // 스타일 있으면 날짜일 수 있음

      if (isSharedStr) {
        const vMatch = vRe.exec(cellBody);
        const idx = vMatch ? parseInt(vMatch[1], 10) : -1;
        colMap[colIdx] = idx >= 0 ? (strs[idx] ?? null) : null;
      } else if (isInlineStr) {
        const tMatch = /<(?:\w+:)?t[^>]*>([^<]*)<\/(?:\w+:)?t>/.exec(cellBody);
        colMap[colIdx] = tMatch ? tMatch[1] : null;
      } else {
        const vMatch = vRe.exec(cellBody);
        if (!vMatch) { colMap[colIdx] = null; continue; }
        const raw = vMatch[1].trim();
        const num = parseFloat(raw);
        colMap[colIdx] = isNaN(num) ? raw : num;
      }
    }
    rowMap.set(rowIdx, colMap);
  }

  const headerColMap = rowMap.get(headerRow);
  if (!headerColMap) return [];

  // 헤더: colIdx → 헤더명
  const headers: Record<number, string> = {};
  for (const [ci, val] of Object.entries(headerColMap)) {
    const h = val != null ? String(val).trim() : "";
    if (h) headers[Number(ci)] = h;
  }

  const results: Record<string, unknown>[] = [];
  for (const [rowIdx, colMap] of rowMap.entries()) {
    if (rowIdx < dataStartRow) continue;

    const hasData = Object.values(colMap).some(
      (v) => v !== null && v !== undefined && v !== ""
    );
    if (!hasData) continue;

    const row: Record<string, unknown> = {};
    for (const [ci, headerName] of Object.entries(headers)) {
      const val = colMap[Number(ci)] ?? null;
      // 숫자가 날짜처럼 보이면 변환 (Excel 날짜 시리얼 범위: 1~2958465)
      if (typeof val === "number" && val > 1000 && val < 2958465) {
        row[headerName] = excelSerialToDate(val);
      } else {
        row[headerName] = val;
      }
    }
    results.push(row);
  }
  return results;
}

/**
 * HCell(한컴셀) xlsx 파일에서 특정 시트를 row 배열로 읽는다.
 * 시트명이 없으면 첫 번째 시트를 사용한다.
 * @param buffer  업로드된 xlsx Buffer
 * @param sheetName  시트명 (없으면 첫 번째 시트)
 * @param headerRow  헤더 행 번호 (0-indexed)
 * @param dataStartRow  데이터 시작 행 번호 (0-indexed)
 */
export function readHCellSheet(
  buffer: Buffer,
  sheetName: string | null,
  headerRow: number,
  dataStartRow: number
): Record<string, unknown>[] {
  // bookFiles 로 raw zip 엔트리 접근
  const wb = XLSX.read(buffer, { type: "buffer", bookFiles: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const files = (wb as any).files as Record<string, { content: Uint8Array }> | undefined;

  // 일반 xlsx 파일(files 없음)이면 기존 방식 사용
  if (!files || Object.keys(files).length === 0) {
    return sheetToRows(wb, sheetName ?? 0, headerRow, dataStartRow);
  }

  // 대상 시트 인덱스 결정
  let targetIdx = 0;
  if (sheetName) {
    const found = wb.SheetNames.indexOf(sheetName);
    targetIdx = found >= 0 ? found : 0;
  }

  // sharedStrings 파싱
  const sstFile = files["xl/sharedStrings.xml"];
  const strs: string[] = sstFile?.content
    ? parseHCellSharedStrings(Buffer.from(sstFile.content).toString("utf8"))
    : [];

  // 워크시트 XML 파싱
  // workbook.xml.rels 에서 시트 인덱스 → 파일명 매핑 시도
  const wbRelsFile = files["xl/_rels/workbook.xml.rels"];
  let wsFileName = `xl/worksheets/sheet${targetIdx + 1}.xml`;

  if (wbRelsFile?.content) {
    const relsXml = Buffer.from(wbRelsFile.content).toString("utf8");
    // 각 시트의 r:id 순서대로 Target 추출
    const relRe = /Id="(rId\d+)"[^>]*Target="worksheets\/([^"]+)"/g;
    const relMap: Record<string, string> = {};
    let rm: RegExpExecArray | null;
    while ((rm = relRe.exec(relsXml)) !== null) {
      relMap[rm[1]] = rm[2];
    }
    // workbook.xml 에서 시트 순서대로 rId 추출
    const wbFile = files["xl/workbook.xml"];
    if (wbFile?.content) {
      const wbXml = Buffer.from(wbFile.content).toString("utf8");
      const sheetRe = /<(?:\w+:)?sheet\s[^>]*r:id="(rId\d+)"/g;
      const rIds: string[] = [];
      let sm: RegExpExecArray | null;
      while ((sm = sheetRe.exec(wbXml)) !== null) rIds.push(sm[1]);
      const rId = rIds[targetIdx];
      if (rId && relMap[rId]) wsFileName = `xl/worksheets/${relMap[rId]}`;
    }
  }

  const wsFile = files[wsFileName];
  if (!wsFile?.content) return [];

  const wsXml = Buffer.from(wsFile.content).toString("utf8");
  return parseHCellWorksheet(wsXml, strs, headerRow, dataStartRow);
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
