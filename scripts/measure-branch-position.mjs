import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');

// 배경만 렌더링하고 y 눈금자 오버레이 추가 (250~297mm 구간)
function mmToPx(mm) { return Math.round(mm * 3.78); }

// 눈금 라인 생성 (250mm ~ 297mm, 1mm 간격)
const rulerLines = [];
for (let mm = 250; mm <= 297; mm++) {
  const px = mmToPx(mm);
  const color = mm % 5 === 0 ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,255,0.3)';
  const width = mm % 5 === 0 ? 2 : 1;
  const label = mm % 5 === 0 ? `<span style="background:red;color:white;font-size:10px;padding:1px 2px;">${mm}mm</span>` : '';
  rulerLines.push(`<div style="position:absolute;top:${px}px;left:0;width:100%;height:${width}px;background:${color};z-index:20;">${label}</div>`);
}

const html = `
<html><head><style>
  body { margin:0; width:794px; height:1123px; position:relative; font-family:'Malgun Gothic',sans-serif; }
  .bg { position:absolute; top:0; left:0; width:794px; height:1123px; z-index:0; }
</style></head>
<body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${rulerLines.join('')}
  <!-- 현재 branchName 위치 표시 -->
  <div style="position:absolute;top:${mmToPx(261.5)}px;left:${mmToPx(101.6)}px;background:rgba(0,255,0,0.7);color:black;font-size:11px;z-index:30;padding:1px 4px;border:2px solid green;">울산남부 [현재 y=261.5]</div>
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // 하단 250mm~297mm 구간 크롭
  await page.screenshot({
    path: path.join(__dirname, 'measure-branch-area.png'),
    clip: { x: 0, y: mmToPx(248), width: 794, height: mmToPx(297) - mmToPx(248) },
  });

  await browser.close();
  console.log('완료: measure-branch-area.png');
  console.log(`250mm = ${mmToPx(250)}px`);
  console.log(`261.5mm = ${mmToPx(261.5)}px`);
  console.log(`297mm = ${mmToPx(297)}px`);
}

main().catch(console.error);
