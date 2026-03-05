import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { transformSanJae } from '@/forms/sanjae/transformSanJae';

type Field = {
  key: string;
  x: number; // mm
  y: number; // mm
};

// 값 꺼내기
function getValue(obj: any, pathStr: string) {
  return pathStr.split('.').reduce((acc, key) => acc?.[key], obj);
}

// mm → px
const mmToPx = (mm: number) => Math.round(mm * 3.78);

export async function htmlToPdfBuffer({
  payload,
  fieldMap,
}: {
  payload: any;
  fieldMap: Field[];
}) {
  try {
    console.log('PAYLOAD:', JSON.stringify(payload, null, 2));

    // ✅ 외부 transform 사용
    const finalPayload = transformSanJae(payload);

    console.log('FINAL PAYLOAD:', JSON.stringify(finalPayload, null, 2));

    const fields = fieldMap.map((f) => ({
   left: mmToPx(f.x) - 1,
    top: mmToPx(f.y) - 2,
    value: getValue(finalPayload, f.key) ?? '',
   }));

    console.log('FIELDS:', fields);

    const imagePath = path.join(
      process.cwd(),
      'public/form-backgrounds/disability-claim-v1-page1.jpg'
    );

    const imageBase64 = fs.readFileSync(imagePath).toString('base64');

    const html = `
<html>
<head>
  <style>
    body {
      margin: 0;
      width: 794px;
      height: 1123px;
      position: relative;
      font-family: 'Malgun Gothic', sans-serif;
    }

    .bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 794px;
      height: 1123px;
      z-index: 0;
    }

    .field {
     position: absolute;
     font-size: 12px;
     z-index: 10;
     white-space: nowrap;

     display: flex;
     align-items: center;
     justify-content: center;
    }


  </style>
</head>

<body>

  <img class="bg" src="data:image/jpeg;base64,${imageBase64}" />

  ${fields
    .map(
      (f) => `
    <div 
      class="field" 
      style="top:${f.top}px; left:${f.left}px;"
    >
      ${f.value}
    </div>
  `
    )
    .join('')}

</body>
</html>
`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 794,
      height: 1123,
    });

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
    });

    const pdf = await page.pdf({
      width: '794px',
      height: '1123px',
      printBackground: true,
    });

    await browser.close();

    return pdf;

  } catch (err) {
    console.error('PDF 생성 오류:', err);
    throw err;
  }
}