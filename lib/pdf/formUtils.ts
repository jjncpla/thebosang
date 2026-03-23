import { PDFDocument, PDFPage, PDFFont, rgb, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

// 주민번호에서 성별 파싱: 1,3 → "남", 2,4 → "여"
export function parseGender(jumin: string): string {
  const clean = jumin.replace(/[-\s]/g, "");
  const code = clean[6];
  if (code === "1" || code === "3") return "남";
  if (code === "2" || code === "4") return "여";
  return "";
}

// 주민번호에서 생년월일 각 자리 파싱
// 7번째 자리 기준: 1,2→19xx, 3,4→20xx
export function parseBirthDate(jumin: string): Record<string, string> {
  const clean = jumin.replace(/[-\s]/g, "");
  if (clean.length < 7) return { Y1: "", Y2: "", Y3: "", Y4: "", M1: "", M2: "", D1: "", D2: "" };

  const code = clean[6];
  const century = code === "3" || code === "4" ? "20" : "19";
  const yy = clean.slice(0, 2);
  const mm = clean.slice(2, 4);
  const dd = clean.slice(4, 6);
  const fullYear = century + yy;

  return {
    Y1: fullYear[0], Y2: fullYear[1], Y3: fullYear[2], Y4: fullYear[3],
    M1: mm[0], M2: mm[1],
    D1: dd[0], D2: dd[1],
  };
}

// 날짜 → 각 자리 분리 및 포맷 반환
export function parseDateFields(date: Date | string | null): Record<string, string> {
  const empty = {
    연도: "", 월자: "", 일자: "",
    y1: "", y2: "", y3: "", y4: "",
    m1: "", m2: "", d1: "", d2: "",
    YY: "", MM: "", DD: "",
  };
  if (!date) return empty;

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return empty;

  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return {
    연도: yyyy, 월자: mm, 일자: dd,
    y1: yyyy[0], y2: yyyy[1], y3: yyyy[2], y4: yyyy[3],
    m1: mm[0], m2: mm[1],
    d1: dd[0], d2: dd[1],
    YY: yyyy.slice(2), MM: mm, DD: dd,
  };
}

// 주민번호 → 각 자리 { "1"~"13" } (하이픈 제외)
export function parseJumin(jumin: string): Record<string, string> {
  const clean = jumin.replace(/[-\s]/g, "");
  const result: Record<string, string> = {};
  for (let i = 0; i < 13; i++) {
    result[String(i + 1)] = clean[i] ?? "";
  }
  return result;
}

// 공란 PDF 로드 (오버레이용) — public/forms/ 내 파일명 사용
export async function loadBlankForm(fileName: string): Promise<PDFDocument> {
  const filePath = path.join(process.cwd(), "public", "forms", fileName);
  const fileBuffer = fsSync.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  return pdfDoc;
}

// NotoSansKR 폰트 로드
export async function loadKoreanFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = await fs.readFile(
    path.join(process.cwd(), "public", "fonts", "NotoSansKR-Regular.otf")
  );
  return pdfDoc.embedFont(fontBytes);
}

// A4 페이지 생성 (595 x 842 pt)
export function createA4Page(pdfDoc: PDFDocument) {
  return pdfDoc.addPage([595, 842]);
}

// 텍스트 그리기 헬퍼
export function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize = 9,
  color: RGB = rgb(0, 0, 0)
): void {
  if (!text) return;
  page.drawText(text, { x, y, size: fontSize, font, color });
}

// 체크박스 [√] 그리기
export function drawCheck(page: PDFPage, x: number, y: number, font: PDFFont): void {
  page.drawText("√", { x, y, size: 10, font, color: rgb(0, 0, 0) });
}

// 선 그리기
export function drawLine(
  page: PDFPage,
  x1: number, y1: number,
  x2: number, y2: number,
  thickness = 0.5,
  color: RGB = rgb(0, 0, 0)
): void {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

// 사각형 (테두리만)
export function drawRect(
  page: PDFPage,
  x: number, y: number,
  width: number, height: number,
  thickness = 0.5,
  color: RGB = rgb(0, 0, 0)
): void {
  page.drawRectangle({ x, y, width, height, borderWidth: thickness, borderColor: color, color: undefined });
}

// 사각형 (채우기)
export function drawFilledRect(
  page: PDFPage,
  x: number, y: number,
  width: number, height: number,
  fillColor: RGB
): void {
  page.drawRectangle({ x, y, width, height, color: fillColor, borderWidth: 0 });
}

// 텍스트 + 아래 밑줄 (답변란용)
export function drawUnderlineField(
  page: PDFPage,
  x: number, y: number,
  width: number,
  font: PDFFont,
  value = "",
  fontSize = 9
): void {
  if (value) {
    page.drawText(value, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
  }
  page.drawLine({ start: { x, y: y - 2 }, end: { x: x + width, y: y - 2 }, thickness: 0.4, color: rgb(0.3, 0.3, 0.3) });
}
