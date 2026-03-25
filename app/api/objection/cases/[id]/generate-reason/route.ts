import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

// A4 기준 상수
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 60;
const LINE_HEIGHT = 22;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { docType } = await req.json();
  // docType: 'reason'(이유서) | 'opinion'(의견서)

  const objCase = await prisma.objectionCase.findUnique({
    where: { id },
    select: {
      patientName: true,
      caseType: true,
      tfName: true,
      decisionDate: true,
      examClaimDate: true,
      reExamClaimDate: true,
      reasonContent: true,
      manager: { select: { name: true } },
    },
  });

  if (!objCase) {
    return NextResponse.json({ error: "사건을 찾을 수 없습니다" }, { status: 404 });
  }

  // PDF 생성
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // NotoSansKR 폰트 로드 (프로젝트 기존 경로: .otf)
  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansKR-Regular.otf");
  const fontBytes = await fs.readFile(fontPath);
  const font = await pdfDoc.embedFont(fontBytes);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const docTitle = docType === "reason" ? "이    유    서" : "의    견    서";

  // 제목 (가운데 정렬)
  const titleSize = 18;
  const titleWidth = font.widthOfTextAtSize(docTitle, titleSize);
  page.drawText(docTitle, {
    x: PAGE_WIDTH / 2 - titleWidth / 2,
    y,
    size: titleSize,
    font,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT * 2.5;

  // 구분선
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT * 1.5;

  // 사건 정보 헤더
  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("ko-KR") : "";

  const headerItems = [
    { label: "재해자", value: objCase.patientName ?? "" },
    { label: "사건분류", value: objCase.caseType ?? "" },
    { label: "담당 TF", value: objCase.tfName ?? "" },
    { label: "처분일", value: fmtDate(objCase.decisionDate) },
    { label: "담당 노무사", value: objCase.manager?.name ?? "" },
  ];

  for (const item of headerItems) {
    page.drawText(`${item.label}: ${item.value}`, {
      x: MARGIN,
      y,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });
    y -= LINE_HEIGHT;
  }

  y -= LINE_HEIGHT;

  // 구분선
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= LINE_HEIGHT * 1.5;

  // 이유서 본문 제목
  const sectionTitle = "【 이    유 】";
  page.drawText(sectionTitle, {
    x: MARGIN,
    y,
    size: 13,
    font,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT * 1.5;

  // 본문 내용
  const content = objCase.reasonContent ?? "(내용 없음)";
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  const fontSize = 11;

  const ensurePage = () => {
    if (y < MARGIN + LINE_HEIGHT * 3) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.trim()) {
      y -= LINE_HEIGHT;
      ensurePage();
      continue;
    }
    let remaining = line;
    while (remaining.length > 0) {
      let chunk = remaining;
      while (font.widthOfTextAtSize(chunk, fontSize) > maxWidth && chunk.length > 1) {
        chunk = chunk.slice(0, -1);
      }
      page.drawText(chunk, {
        x: MARGIN,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= LINE_HEIGHT;
      remaining = remaining.slice(chunk.length);
      ensurePage();
    }
  }

  // 서명란
  y -= LINE_HEIGHT * 2;
  ensurePage();
  const today = new Date().toLocaleDateString("ko-KR");

  const dateLine = `작성일: ${today}`;
  page.drawText(dateLine, {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(dateLine, 11),
    y,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT * 1.5;

  const signLine = `노무법인 더보상  ${objCase.manager?.name ?? "담당노무사"}  (인)`;
  page.drawText(signLine, {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(signLine, 11),
    y,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();

  const fileName = `${docType === "reason" ? "이유서" : "의견서"}_${objCase.patientName}_${today.replace(/\./g, "")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
