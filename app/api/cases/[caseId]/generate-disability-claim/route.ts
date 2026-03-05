import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getCaseById } from '@/lib/mockDb';
import { renderTemplate } from '@/lib/template';
import { htmlToPdfBuffer } from '@/lib/server/pdf';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    // ✅ 1. params 반드시 await
    const { caseId } = await params;

    if (!caseId) {
      return NextResponse.json({ error: 'caseId 없음' }, { status: 400 });
    }

    console.log('요청된 caseId:', caseId);

    // ✅ 2. 문자열 그대로 사용 (🔥 핵심)
    const caseData = getCaseById(caseId);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // ✅ 배경 이미지
    const bgPath = path.join(
      process.cwd(),
      'public',
      'form-backgrounds',
      'disability-claim-v1-page1.jpg'
    );

    if (!fs.existsSync(bgPath)) {
      return NextResponse.json(
        { error: 'Background image not found' },
        { status: 500 }
      );
    }

    const base64Image = fs.readFileSync(bgPath).toString('base64');
    const backgroundImage = `data:image/jpeg;base64,${base64Image}`;

    // ✅ 템플릿 경로
    const templatePath = 'disability-claim-v1.html';

    const html = await renderTemplate(
  'disability-claim-v1.html',
  {
    ...caseData,
    backgroundImage,
  }
);

    // ✅ PDF 생성
    const buffer = await htmlToPdfBuffer(html);

    // ✅ 저장
    const fileName = `disability-${Date.now()}.pdf`;
    const filePath = path.join(
      process.cwd(),
      'public',
      'generated',
      caseId,
      fileName
    );

    await savePdfToFile(buffer, filePath);

    return NextResponse.json({
      success: true,
      file: `/generated/${caseId}/${fileName}`,
    });

  } catch (error) {
    console.error('PDF 생성 에러:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}