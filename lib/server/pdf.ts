// lib/pdf.ts

import { PDFOptions } from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

async function getBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;
  const executablePath =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome';
  return puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
}

export async function htmlToPdfBuffer(
  htmlContent: string,
  options?: Partial<PDFOptions>
): Promise<Buffer> {
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
    await browser.close(); // 서버리스는 매번 닫아야 함
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