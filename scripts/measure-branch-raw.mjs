import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');

function mmToPx(mm) { return Math.round(mm * 3.78); }

// 배경만, 오버레이 없음 - 그냥 크롭
const html = `
<html><head><style>
  body { margin:0; width:794px; height:1123px; position:relative; }
  .bg { position:absolute; top:0; left:0; width:794px; height:1123px; }
</style></head>
<body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // 하단 전체 (250mm~297mm) - 원본 비율
  await page.screenshot({
    path: path.join(__dirname, 'bg-bottom-raw.png'),
    clip: { x: 0, y: mmToPx(250), width: 794, height: mmToPx(297) - mmToPx(250) },
  });

  // 좁은 구간 (259~267mm) - 더 세밀하게
  await page.screenshot({
    path: path.join(__dirname, 'bg-branch-area.png'),
    clip: { x: 0, y: mmToPx(259), width: 794, height: mmToPx(267) - mmToPx(259) },
  });

  await browser.close();
  console.log('완료');
  console.log(`259mm=${mmToPx(259)}px, 267mm=${mmToPx(267)}px, diff=${mmToPx(267)-mmToPx(259)}px`);
}

main().catch(console.error);
