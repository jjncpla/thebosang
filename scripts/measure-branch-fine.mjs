import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');

function mmToPx(mm) { return Math.round(mm * 3.78); }

// 260~270mm 구간 0.5mm 간격 눈금
const rulerLines = [];
for (let i = 0; i <= 20; i++) {
  const mm = 260 + i * 0.5;
  const px = mmToPx(mm);
  const isFull = Number.isInteger(mm);
  const color = isFull ? 'rgba(255,0,0,0.9)' : 'rgba(0,0,255,0.5)';
  const h = isFull ? 2 : 1;
  const label = isFull ? `<span style="position:absolute;left:2px;background:red;color:white;font-size:9px;padding:0 2px;line-height:1;">${mm}mm</span>` : '';
  rulerLines.push(`<div style="position:absolute;top:${px}px;left:0;width:100%;height:${h}px;background:${color};z-index:20;">${label}</div>`);
}

const html = `
<html><head><style>
  body { margin:0; width:794px; height:1123px; position:relative; }
  .bg { position:absolute; top:0; left:0; width:794px; height:1123px; z-index:0; }
</style></head>
<body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${rulerLines.join('')}
  <!-- y 후보들 표시 -->
  <div style="position:absolute;top:${mmToPx(261.5)}px;left:${mmToPx(101.6)}px;background:rgba(0,255,0,0.8);font-size:10px;z-index:30;padding:1px 3px;border:1px solid green;">울산남부 [261.5]</div>
  <div style="position:absolute;top:${mmToPx(263.5)}px;left:${mmToPx(101.6)}px;background:rgba(255,165,0,0.8);font-size:10px;z-index:30;padding:1px 3px;border:1px solid orange;">울산남부 [263.5]</div>
  <div style="position:absolute;top:${mmToPx(264.5)}px;left:${mmToPx(101.6)}px;background:rgba(0,200,255,0.8);font-size:10px;z-index:30;padding:1px 3px;border:1px solid blue;">울산남부 [264.5]</div>
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // 258~272mm 구간
  const y1 = mmToPx(258), y2 = mmToPx(272);
  await page.screenshot({
    path: path.join(__dirname, 'measure-branch-fine.png'),
    clip: { x: 0, y: y1, width: 794, height: y2 - y1 },
  });

  await browser.close();
  console.log('완료: measure-branch-fine.png');
  console.log(`258mm=${mmToPx(258)}px, 265mm=${mmToPx(265)}px, 272mm=${mmToPx(272)}px`);
}

main().catch(console.error);
