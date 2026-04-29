/**
 * 빈 A4에 한국어 텍스트로 양식을 그려서 PDF 생성하는 유틸리티.
 *
 * 신규 자동생성 양식 (배경 PDF가 없는 자유 양식)에서 공통 사용:
 *  - 평균임금 정정청구서 (WAGE_CORRECTION_CLAIM)
 *  - 심사청구서 (EXAM_CLAIM)
 *  - 재심사청구서 (REEXAM_CLAIM)
 *  - 추가상병 신청서 (ADDITIONAL_INJURY_CLAIM)
 *  - 재요양 신청서 (REQUOTE_REQUEST)
 *
 * 추후 공단이 표준 양식 PDF를 발표하면 public/forms/에 추가 후
 * 좌표 기반 (FORM_FIELDS) 방식으로 마이그레이션 가능.
 */
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

export interface TextFormSection {
  heading?: string;       // 섹션 제목 (생략 가능)
  rows?: Array<[string, string]>;  // [라벨, 값] 표 형식
  paragraphs?: string[];  // 자유 텍스트 단락
}

export interface TextFormSpec {
  title: string;                // 양식 제목
  subtitle?: string;            // 부제목 (예: "산업재해보상보험법 제5조")
  sections: TextFormSection[];
  signatureBlock?: {
    dateText: string;           // "2026년 4월 30일"
    rows: Array<[string, string]>;  // [라벨, 값] (예: ["청구인", "홍길동 (인)"])
  };
  footnote?: string;            // 하단 안내문
}

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 50;
const MAX_CHARS_PER_LINE = 38;  // 본문 한 줄 최대 한글 문자 (대략)

let cachedFontBytes: Buffer | null = null;
function loadFontBytes(): Buffer {
  if (cachedFontBytes) return cachedFontBytes;
  const p = path.join(process.cwd(), "public", "fonts", "NotoSansKR-Regular.otf");
  cachedFontBytes = fs.readFileSync(p);
  return cachedFontBytes;
}

/**
 * 한글이 섞인 문자열을 폭 기준으로 줄바꿈.
 * pdf-lib은 자동 줄바꿈을 지원하지 않으므로 수동 처리.
 */
function wrapKorean(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(cur);
      cur = "";
      continue;
    }
    const next = cur + ch;
    const w = font.widthOfTextAtSize(next, size);
    if (w > maxWidth) {
      if (cur) lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length === 0 ? [""] : lines;
}

interface DrawCtx {
  page: PDFPage;
  font: PDFFont;
  pdf: PDFDocument;
  y: number;
}

function ensureSpace(ctx: DrawCtx, needed: number): DrawCtx {
  if (ctx.y - needed < MARGIN) {
    const newPage = ctx.pdf.addPage([A4_W, A4_H]);
    return { page: newPage, font: ctx.font, pdf: ctx.pdf, y: A4_H - MARGIN };
  }
  return ctx;
}

function drawTextLine(
  ctx: DrawCtx,
  text: string,
  opts: { x?: number; size?: number; bold?: boolean; align?: "left" | "center" }
): DrawCtx {
  const size = opts.size ?? 11;
  const x = opts.x ?? MARGIN;
  ctx = ensureSpace(ctx, size + 4);
  let drawX = x;
  if (opts.align === "center") {
    const w = ctx.font.widthOfTextAtSize(text, size);
    drawX = (A4_W - w) / 2;
  }
  ctx.page.drawText(text, {
    x: drawX,
    y: ctx.y,
    size,
    font: ctx.font,
    color: rgb(0, 0, 0),
  });
  return { ...ctx, y: ctx.y - size - 4 };
}

function drawParagraph(ctx: DrawCtx, text: string, size = 11): DrawCtx {
  const lines = wrapKorean(text, A4_W - MARGIN * 2, ctx.font, size);
  for (const line of lines) {
    ctx = drawTextLine(ctx, line, { size });
  }
  return ctx;
}

function drawHeading(ctx: DrawCtx, text: string): DrawCtx {
  ctx = ensureSpace(ctx, 24);
  ctx.y -= 6;
  return drawTextLine(ctx, text, { size: 13 });
}

function drawRow(ctx: DrawCtx, label: string, value: string): DrawCtx {
  // 표 형식: 라벨 (왼쪽 100px) | 값
  const labelX = MARGIN;
  const valueX = MARGIN + 110;
  const size = 11;
  ctx = ensureSpace(ctx, size + 6);
  // 라벨
  ctx.page.drawText(label, {
    x: labelX,
    y: ctx.y,
    size,
    font: ctx.font,
    color: rgb(0.3, 0.3, 0.3),
  });
  // 값 (긴 경우 줄바꿈)
  const valueLines = wrapKorean(value, A4_W - valueX - MARGIN, ctx.font, size);
  for (let i = 0; i < valueLines.length; i++) {
    ctx.page.drawText(valueLines[i], {
      x: valueX,
      y: ctx.y,
      size,
      font: ctx.font,
      color: rgb(0, 0, 0),
    });
    if (i < valueLines.length - 1) {
      ctx.y -= size + 4;
      ctx = ensureSpace(ctx, size + 4);
    }
  }
  return { ...ctx, y: ctx.y - size - 6 };
}

/**
 * 명세에 따라 텍스트 기반 PDF 생성 → Uint8Array 반환
 */
export async function buildTextFormPdf(spec: TextFormSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(loadFontBytes());

  let page = pdf.addPage([A4_W, A4_H]);
  let ctx: DrawCtx = { page, font, pdf, y: A4_H - MARGIN };

  // ── 제목 ──
  ctx = drawTextLine(ctx, spec.title, { size: 20, align: "center" });
  if (spec.subtitle) {
    ctx = drawTextLine(ctx, spec.subtitle, { size: 11, align: "center" });
  }
  ctx.y -= 16;
  // 구분선
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: A4_W - MARGIN, y: ctx.y },
    thickness: 0.7,
    color: rgb(0, 0, 0),
  });
  ctx.y -= 16;

  // ── 섹션 ──
  for (const sec of spec.sections) {
    if (sec.heading) ctx = drawHeading(ctx, sec.heading);
    if (sec.rows) {
      for (const [label, value] of sec.rows) {
        ctx = drawRow(ctx, label, value);
      }
    }
    if (sec.paragraphs) {
      for (const p of sec.paragraphs) {
        ctx = drawParagraph(ctx, p);
        ctx.y -= 4;
      }
    }
    ctx.y -= 8;
  }

  // ── 서명 블록 ──
  if (spec.signatureBlock) {
    ctx = ensureSpace(ctx, 80);
    ctx.y -= 24;
    ctx = drawTextLine(ctx, spec.signatureBlock.dateText, { size: 12, align: "center" });
    ctx.y -= 12;
    for (const [label, value] of spec.signatureBlock.rows) {
      ctx = drawRow(ctx, label, value);
    }
  }

  // ── 하단 안내문 ──
  if (spec.footnote) {
    ctx.y -= 20;
    ctx = drawParagraph(ctx, spec.footnote, 9);
  }

  return pdf.save();
}
