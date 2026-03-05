import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');
const mmToPx = (mm) => Math.round(mm * 3.78);

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });

  // 청 구 인 행(y≈179mm)에 세밀한 수직선 그리기
  const xMarks = [82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108.75];
  const lines = xMarks.map(mm => {
    const px = mmToPx(mm);
    const color = mm === 108.75 ? 'rgba(0,0,255,0.7)' : 'rgba(255,0,0,0.5)';
    return `
      <div style="position:absolute;left:${px}px;top:0;width:1px;height:1123px;background:${color};z-index:20;"></div>
      <div style="position:absolute;left:${px+1}px;top:673px;font-size:7px;color:${mm===108.75?'blue':'red'};background:white;z-index:21;white-space:nowrap;">${mm}</div>`;
  }).join('');

  const html = `
<html><head><style>
  body{margin:0;width:794px;height:1123px;position:relative;}
  .bg{position:absolute;top:0;left:0;width:794px;height:1123px;z-index:0;}
</style></head><body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${lines}
</body></html>`;

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.screenshot({
    path: path.join(__dirname, 'measure-sig-fine.png'),
    clip: { x: 0, y: 660, width: 794, height: 55 },
  });

  await browser.close();
  console.log('저장: scripts/measure-sig-fine.png');
}

main().catch(console.error);
