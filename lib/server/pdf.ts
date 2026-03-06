import { PDFOptions } from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';
import get from 'lodash.get';
import { renderTemplate } from '@/lib/template';

type FieldEntry = { key: string; x: number; y: number };

export interface PdfInput {
  payload: Record<string, unknown>;
  fieldMap: FieldEntry[];
  templateName?: string;
  backgroundImagePath?: string;
}

async function getBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;
  const executablePath =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : (process.env.CHROMIUM_PATH || '/usr/bin/chromium');
  return puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
}

export async function htmlToPdfBuffer(
  input: PdfInput,
  options?: Partial<PDFOptions>
): Promise<Buffer> {
  const {
    payload,
    fieldMap,
    templateName = 'disability-claim-v1.html',
    backgroundImagePath = path.join(
      process.cwd(),
      'public',
      'form-backgrounds',
      'disability-claim-v1-page1.jpg'
    ),
  } = input;

  // 배경 이미지를 base64 data URL로 변환 (Puppeteer가 file:// 없이도 렌더링 가능)
  const bgData = await fs.readFile(backgroundImagePath);
  const bgDataUrl = `data:image/jpeg;base64,${bgData.toString('base64')}`;

  // fieldMap의 각 key로 payload에서 값을 꺼내 { x, y, value } 배열 생성
  const fields = fieldMap.map(({ key, x, y }) => ({
    x,
    y,
    value: get(payload, key) ?? '',
  }));

  // Handlebars 템플릿 렌더링
  const htmlContent = await renderTemplate(templateName, {
    backgroundImage: bgDataUrl,
    fields,
  });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      ...options,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function savePdfToFile(
  buffer: Buffer,
  filePath: string
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, buffer);
}
