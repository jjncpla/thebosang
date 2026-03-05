import { NextRequest, NextResponse } from 'next/server';
import { htmlToPdfBuffer } from '@/lib/server/pdf';
import { FIELD_MAP } from '@/forms/sanjae/fieldMeta';

export const runtime = 'nodejs';

// 🔥 날짜 쪼개기
const splitDate = (date: string) => {
  if (!date) return {};

  const [y, m, d] = date.split('-');

  return {
    y1: y?.[0], y2: y?.[1], y3: y?.[2], y4: y?.[3],
    m1: m?.[0], m2: m?.[1],
    d1: d?.[0], d2: d?.[1],
  };
};

// 🔥 데이터 변환 (핵심)
const transformSanJae = (data: any) => {
  return {
    ...data,

    birthSplit: splitDate(data.worker?.birth),
    accidentDateSplit: splitDate(data.accidentDate),
    claimDateSplit: splitDate(data.claimDate),
  };
};

export async function POST(req: NextRequest) {
  try {
    const { data } = await req.json();

    const payload = transformSanJae(data);

    const pdfBuffer = await htmlToPdfBuffer({
      payload,
      fieldMap: FIELD_MAP,
      
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="sanjae.pdf"',
      },
    });

  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      { error: err.message || 'PDF 생성 실패' },
      { status: 500 }
    );
  }
}