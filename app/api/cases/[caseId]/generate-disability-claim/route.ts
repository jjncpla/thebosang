import { NextRequest, NextResponse } from 'next/server';
import { htmlToPdfBuffer } from '@/lib/server/pdf';
import { FIELD_MAP } from '@/forms/sanjae/fieldMeta';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    if (!caseId) {
      return NextResponse.json({ error: 'caseId 없음' }, { status: 400 });
    }

    const payload = await request.json();

    const buffer = await htmlToPdfBuffer({ payload, fieldMap: FIELD_MAP });

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="disability-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF 생성 오류:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}