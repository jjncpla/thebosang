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

    const mappedPayload = {
      worker: {
        name: payload.victimName,
        phone: payload.claimantPhone,
      },
      birthSplit: payload.birthSplit,
      accidentDateSplit: payload.accidentDateSplit,
      claimDateSplit: payload.claimDateSplit,
      confirm: {
        disabilityClaim: payload.disabilityClaim ? 'V' : '',
        preventionClaim: payload.preventionClaim ? 'V' : '',
        preExistingDisability: payload.preExistingDisability ? 'V' : '',
        compensationReceived: payload.compensationReceived ? 'V' : '',
      },
      account: {
        change: payload.accountChange ? 'V' : '',
        typeRegular: payload.accountType === 'regular' ? 'V' : '',
        typeSaving: payload.accountType === 'saving' ? 'V' : '',
      },
      bankName: payload.bankName,
      accountNumber: payload.accountNumber,
      compensation: {
        date: payload.compensationDate,
        amount: payload.compensationAmount,
        payer: payload.compensationPayer,
      },
      transportCost: payload.transportCost,
      disease: {
        name: payload.diseaseName,
        hospitalName: payload.hospitalName,
      },
      claimant: {
        name: payload.claimantName,
      },
      claim: {
        agentName: payload.agentName,
        phone: payload.agentPhone,
      },
      branchName: payload.officeName?.replace(/지사$/, '') ?? '',
    };

    const buffer = await htmlToPdfBuffer({ payload: mappedPayload, fieldMap: FIELD_MAP });

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