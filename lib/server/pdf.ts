import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs/promises';
import path from 'path';
import get from 'lodash.get';

type FieldEntry = { key: string; x: number; y: number };

export interface PdfInput {
  payload: Record<string, unknown>;
  fieldMap: FieldEntry[];
  backgroundImagePath?: string;
}

export async function htmlToPdfBuffer(input: PdfInput): Promise<Buffer> {
  const {
    payload,
    fieldMap,
    backgroundImagePath = path.join(
      process.cwd(), 'public', 'form-backgrounds', 'disability-claim-v1-page1.jpg'
    ),
  } = input;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const jpgBytes = await fs.readFile(backgroundImagePath);
  const jpgImage = await pdfDoc.embedJpg(jpgBytes);

  const { width, height } = jpgImage.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(jpgImage, { x: 0, y: 0, width, height });

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const { key, x, y } of fieldMap) {
    const value = String(get(payload, key) ?? '');
    if (!value) continue;
    page.drawText(value, {
      x,
      y: height - y,  // PDF 좌표계는 좌하단 기준이라 y 반전
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function savePdfToFile(buffer: Buffer, filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, buffer);
}
