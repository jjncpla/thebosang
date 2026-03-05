// lib/pdf.ts

import { PDFOptions } from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';

async function getBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;

  if (process.env.VERCEL === '1') {
    // ── Vercel 서버리스 환경 ───────────────────────────
    const chromiumPkg = '@sparticuz/chromium-min';
    const chromium = (await import(/* webpackIgnore: true */ chromiumPkg)).default;
    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar'
    );
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });
  } else {
    // ── 로컬 개발 환경 ─────────────────────────────────
    const executablePath =
      process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome';
    return puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
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