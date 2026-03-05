import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');

function mmToPx(mm) { return Math.round(mm * 3.78); }

// 배경만 - 크롭 후 2배 확대
const html = `
<html><head><style>
  body { margin:0; width:794px; height:1123px; position:relative; }
  .bg { position:absolute; top:0; left:0; width:794px; height:1123px; z-index:0; }
</style></head>
<body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // 2배 deviceScaleFactor로 고해상도
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // 257~270mm 구간 (고해상도)
  const y1 = mmToPx(257) * 2;
  const y2 = mmToPx(270) * 2;
  await page.screenshot({
    path: path.join(__dirname, 'measure-branch-zoom.png'),
    clip: { x: 0, y: y1, width: 1588, height: y2 - y1 },
  });

  await browser.close();
  console.log(`257mm=${mmToPx(257)}px(×2=${mmToPx(257)*2}px)`);
  console.log(`270mm=${mmToPx(270)}px(×2=${mmToPx(270)*2}px)`);
  console.log('완료: measure-branch-zoom.png');
}

main().catch(console.error);
