import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');

// 눈금자 선: 특정 x 또는 y 위치에 빨간선을 그어서 mm 위치를 확인
const mmToPx = (mm) => Math.round(mm * 3.78);

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });

  // ── 1. 서명란 분석 ──
  // x=60,70,80,90,100,110,120mm 에 수직선을 그어서 (서명 또는 인) 위치 확인
  const sigLines = [60, 70, 80, 90, 100, 108.75, 110, 120].map(mm => {
    const px = mmToPx(mm);
    return `<div style="position:absolute;left:${px}px;top:0;width:1px;height:1123px;background:rgba(255,0,0,0.4);z-index:20;">
      <span style="position:absolute;top:660px;left:2px;font-size:8px;color:red;white-space:nowrap;background:white;">${mm}mm</span>
    </div>`;
  }).join('');

  const html1 = `
<html><head><style>
  body{margin:0;width:794px;height:1123px;position:relative;font-family:'Malgun Gothic',sans-serif;}
  .bg{position:absolute;top:0;left:0;width:794px;height:1123px;z-index:0;}
</style></head><body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${sigLines}
</body></html>`;

  await page.setContent(html1, { waitUntil: 'domcontentloaded' });
  await page.screenshot({
    path: path.join(__dirname, 'measure-sig-x.png'),
    clip: { x: 0, y: 645, width: 794, height: 100 },
  });

  // ── 2. 지사명 분석 ──
  // y=260,265,270,275,278,280,283,285,287,290mm 에 수평선을 그어서 근로복지공단 위치 확인
  const branchLines = [258, 260, 263.79, 265, 270, 275, 278, 280, 283, 285, 288, 290].map(mm => {
    const px = mmToPx(mm);
    return `<div style="position:absolute;top:${px}px;left:0;width:794px;height:1px;background:rgba(255,0,0,0.5);z-index:20;">
      <span style="position:absolute;top:1px;left:5px;font-size:8px;color:red;white-space:nowrap;background:white;">${mm}mm</span>
    </div>`;
  }).join('');

  const html2 = `
<html><head><style>
  body{margin:0;width:794px;height:1123px;position:relative;font-family:'Malgun Gothic',sans-serif;}
  .bg{position:absolute;top:0;left:0;width:794px;height:1123px;z-index:0;}
</style></head><body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${branchLines}
</body></html>`;

  await page.setContent(html2, { waitUntil: 'domcontentloaded' });
  await page.screenshot({
    path: path.join(__dirname, 'measure-branch-y.png'),
    clip: { x: 0, y: 960, width: 794, height: 130 },
  });

  await browser.close();
  console.log('측정 스크린샷 저장:');
  console.log('  scripts/measure-sig-x.png');
  console.log('  scripts/measure-branch-y.png');
}

main().catch(console.error);
