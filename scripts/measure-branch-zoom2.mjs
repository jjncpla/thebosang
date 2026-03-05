import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');

function mmToPx(mm) { return Math.round(mm * 3.78); }

// 0.5mm 간격 눈금 (258~268mm)
const lines = [];
for (let i = 0; i <= 20; i++) {
  const mm = 258 + i * 0.5;
  const px = mmToPx(mm);
  const isFull = Number.isInteger(mm);
  lines.push(`<div style="position:absolute;top:${px}px;left:0;width:794px;height:${isFull?2:1}px;background:${isFull?'rgba(255,0,0,0.7)':'rgba(0,0,255,0.4)'};z-index:20;"></div>`);
  if (isFull) {
    lines.push(`<div style="position:absolute;top:${px-12}px;left:4px;background:red;color:white;font-size:11px;font-weight:bold;z-index:30;padding:0 3px;">${mm}mm</div>`);
  }
}

const html = `
<html><head><style>
  body { margin:0; width:794px; height:1123px; position:relative; font-family:'Malgun Gothic',sans-serif; }
  .bg { position:absolute; top:0; left:0; width:794px; height:1123px; }
</style></head>
<body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${lines.join('\n')}
  <div style="position:absolute;top:${mmToPx(261.5)-6}px;left:${mmToPx(95)}px;color:green;font-size:12px;font-weight:bold;z-index:30;">▶울산남부[현재261.5]</div>
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const y1 = mmToPx(257);
  const y2 = mmToPx(269);
  await page.screenshot({
    path: path.join(__dirname, 'measure-branch-zoom2.png'),
    clip: { x: 0, y: y1, width: 794, height: y2 - y1 },
  });

  await browser.close();
  console.log(`clip: y=${y1}px~${y2}px (${y2-y1}px 높이)`);
  console.log('완료: measure-branch-zoom2.png');
}

main().catch(console.error);
