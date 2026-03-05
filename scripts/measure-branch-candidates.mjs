import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
const imageBase64 = fs.readFileSync(imagePath).toString('base64');

function mmToPx(mm) { return Math.round(mm * 3.78); }

// 후보 y값들을 배경 위에 겹쳐서 확인
const candidates = [261.5, 262.5, 263.5, 264.5, 265.5];
const colors = ['green', 'blue', 'orange', 'red', 'purple'];

const overlays = candidates.map((y, i) => `
  <div style="position:absolute;top:${mmToPx(y)}px;left:${mmToPx(80)}px;
    color:${colors[i]};font-size:12px;font-weight:bold;z-index:30;
    text-shadow:0 0 3px white;">울산남부[y=${y}]</div>
`).join('');

// 수평 눈금선
const hlines = candidates.map((y, i) => `
  <div style="position:absolute;top:${mmToPx(y)}px;left:0;width:794px;height:1px;
    background:${colors[i]};opacity:0.6;z-index:20;"></div>
`).join('');

const html = `
<html><head><style>
  body { margin:0; width:794px; height:1123px; position:relative; font-family:'Malgun Gothic',sans-serif; }
  .bg { position:absolute; top:0; left:0; width:794px; height:1123px; }
</style></head>
<body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${hlines}
  ${overlays}
</body></html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  await page.screenshot({
    path: path.join(__dirname, 'branch-candidates.png'),
    clip: { x: 0, y: mmToPx(258), width: 794, height: mmToPx(270) - mmToPx(258) },
  });

  await browser.close();
  console.log('완료: branch-candidates.png');
  candidates.forEach((y, i) => {
    console.log(`  ${colors[i]}: y=${y}mm → ${mmToPx(y)}px`);
  });
}

main().catch(console.error);
