import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── 수정된 fieldMeta FIELD_MAP ──
const FIELD_MAP = [
  { key: 'worker.name', x: 49.74, y: 59.3 },
  { key: 'birthSplit.y1', x: 100.81, y: 60.59 },
  { key: 'birthSplit.y2', x: 106.89, y: 60.59 },
  { key: 'birthSplit.y3', x: 112.45, y: 60.59 },
  { key: 'birthSplit.y4', x: 118.8,  y: 60.59 },
  { key: 'birthSplit.m1', x: 129.65, y: 60.59 },
  { key: 'birthSplit.m2', x: 135.0,  y: 60.59 },
  { key: 'birthSplit.d1', x: 146.58, y: 60.59 },
  { key: 'birthSplit.d2', x: 153.2,  y: 60.59 },
  { key: 'accidentDateSplit.y1', x: 35.98, y: 71.17 },
  { key: 'accidentDateSplit.y2', x: 42.33, y: 71.17 },
  { key: 'accidentDateSplit.y3', x: 48.15, y: 71.17 },
  { key: 'accidentDateSplit.y4', x: 54.24, y: 71.17 },
  { key: 'accidentDateSplit.m1', x: 65.35, y: 71.17 },
  { key: 'accidentDateSplit.m2', x: 71.44, y: 71.17 },
  { key: 'accidentDateSplit.d1', x: 82.55, y: 71.17 },
  { key: 'accidentDateSplit.d2', x: 88.11, y: 71.17 },
  { key: 'confirm.disabilityClaim', x: 68.77, y: 32.80 },
  { key: 'confirm.preventionClaim', x: 68.77, y: 39.14 },
  { key: 'account.change',      x: 99.18, y: 76.43 },
  { key: 'account.typeRegular', x: 40.47, y: 96.52 },
  { key: 'account.typeSaving',  x: 76.44, y: 96.52 },
  { key: 'bankName',      x: 74.06, y: 83.31 },
  { key: 'accountNumber', x: 74.06, y: 89.39 },
  { key: 'confirm.preExistingDisability', x: 153.0, y: 103.14 },
  { key: 'confirm.compensationReceived',  x: 153.0, y: 111.08 },
  { key: 'compensation.date',   x: 29.09, y: 130.82 },
  { key: 'compensation.amount', x: 58.19, y: 130.82 },
  { key: 'compensation.payer',  x: 84.61, y: 130.82 },
  { key: 'transportCost',       x: 48.11, y: 139.80 },
  { key: 'disease.name',         x: 33.83,  y: 155.12 },
  { key: 'disease.hospitalName', x: 134.82, y: 155.91 },
  // ── 수정: claimant.name, agentName x 78mm로 변경 ──
  { key: 'claimant.name',   x: 113.0,  y: 179.44 },
  { key: 'worker.phone',    x: 161.66, y: 181.5  },
  { key: 'claim.agentName', x: 113.0,  y: 184.21 },
  { key: 'claim.phone',     x: 161.66, y: 186.27 },
  // ── 수정: branchName y 263.5mm로 변경 ──
  { key: 'branchName', x: 101.6, y: 263.5 },
  { key: 'claimDateSplit.y1', x: 135.73, y: 176.74 },
  { key: 'claimDateSplit.y2', x: 137.73, y: 176.74 },
  { key: 'claimDateSplit.y3', x: 139.73, y: 176.74 },
  { key: 'claimDateSplit.y4', x: 141.73, y: 176.74 },
  { key: 'claimDateSplit.m1', x: 153.99, y: 176.74 },
  { key: 'claimDateSplit.m2', x: 155.99, y: 176.74 },
  { key: 'claimDateSplit.d1', x: 164.84, y: 176.74 },
  { key: 'claimDateSplit.d2', x: 166.84, y: 176.74 },
];

const testPayload = {
  victimName: '홍길동',
  birthDate: '1980-01-01',
  accidentDate: '2024-03-15',
  officeName: '울산남부지사',
  bankName: '국민은행',
  accountNumber: '123-456-7890',
  claimantName: '홍길동',
  claimantPhone: '010-1234-5678',
  agentName: '홍대리',
  agentPhone: '010-9999-8888',
  disabilityClaim: true,
  preventionClaim: false,
  accountChange: false,
  accountType: 'regular',
  preExistingDisability: false,
  compensationReceived: false,
  compensationDate: '2024-01-01',
  compensationAmount: '1000000',
  compensationPayer: '근로복지공단',
  transportCost: '45000',
  diseaseName: '요추 추간판 탈출증',
  hospitalName: '서울대학교병원',
  claimDate: '2024-07-01',
};

function splitDate(date) {
  if (!date) return {};
  const clean = date.replace(/-/g, '');
  return {
    y1: clean[0], y2: clean[1], y3: clean[2], y4: clean[3],
    m1: clean[4], m2: clean[5],
    d1: clean[6], d2: clean[7],
  };
}
function tick(v) { return v ? '✔' : ''; }
function transformSanJae(data) {
  return {
    worker: { name: data.victimName ?? '', phone: data.claimantPhone ?? '' },
    branchName: data.officeName?.replace(/지사$/, '') ?? '',
    bankName: data.bankName ?? '',
    accountNumber: data.accountNumber ?? '',
    confirm: {
      disabilityClaim: tick(data.disabilityClaim),
      preventionClaim: tick(data.preventionClaim),
      preExistingDisability: tick(data.preExistingDisability),
      compensationReceived: tick(data.compensationReceived),
    },
    account: {
      change: tick(data.accountChange),
      typeRegular: tick(data.accountType === 'regular'),
      typeSaving: tick(data.accountType === 'saving'),
    },
    compensation: {
      date: data.compensationDate ?? '',
      amount: data.compensationAmount ?? '',
      payer: data.compensationPayer ?? '',
    },
    transportCost: data.transportCost ?? '',
    disease: { name: data.diseaseName ?? '', hospitalName: data.hospitalName ?? '' },
    claimant: { name: data.claimantName ?? '' },
    claim: { agentName: data.agentName ?? '', phone: data.agentPhone ?? '' },
    birthSplit: splitDate(data.birthDate),
    accidentDateSplit: splitDate(data.accidentDate),
    claimDateSplit: splitDate(data.claimDate),
  };
}
function getValue(obj, pathStr) {
  return pathStr.split('.').reduce((acc, key) => acc?.[key], obj);
}
const mmToPx = (mm) => Math.round(mm * 3.78);

async function main() {
  const finalPayload = transformSanJae(testPayload);
  const fields = FIELD_MAP.map(f => ({
    left: mmToPx(f.x) - 1,
    top:  mmToPx(f.y) - 2,
    value: getValue(finalPayload, f.key) ?? '',
    key: f.key,
  })).filter(f => f.value !== '');

  const imagePath = path.join(ROOT, 'public/form-backgrounds/disability-claim-v1-page1.jpg');
  const imageBase64 = fs.readFileSync(imagePath).toString('base64');

  const html = `
<html><head><style>
  body { margin:0; width:794px; height:1123px; position:relative; font-family:'Malgun Gothic',sans-serif; }
  .bg { position:absolute; top:0; left:0; width:794px; height:1123px; z-index:0; }
  .field { position:absolute; font-size:12px; z-index:10; white-space:nowrap; display:flex; align-items:center; justify-content:center; }
  .field-debug { position:absolute; font-size:12px; z-index:10; white-space:nowrap; display:flex; align-items:center; justify-content:center; outline:2px solid red; background:rgba(255,255,0,0.4); }
</style></head>
<body>
  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />
  ${fields.map(f => {
    const isTarget = ['claimant.name','claim.agentName','branchName'].includes(f.key);
    return `<div class="${isTarget ? 'field-debug' : 'field'}" style="top:${f.top}px; left:${f.left}px;">${f.value}</div>`;
  }).join('')}
</body></html>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // 서명란 크롭 (y자 측정용으로 넓게)
  await page.screenshot({
    path: path.join(__dirname, 'after-sig.png'),
    clip: { x: 0, y: 620, width: 794, height: 160 },
  });

  // 지사명 크롭
  await page.screenshot({
    path: path.join(__dirname, 'after-branch.png'),
    clip: { x: 0, y: 950, width: 794, height: 100 },
  });

  // 전체
  await page.screenshot({
    path: path.join(__dirname, 'after-full.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('완료: after-sig.png / after-branch.png / after-full.png');
}

main().catch(console.error);
