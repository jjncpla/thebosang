import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: 진찰요구서 수령일은 있으나 1차 특진일정이 없는 소음성 난청 케이스
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const results = await prisma.hearingLossDetail.findMany({
      where: {
        examRequestReceivedAt: { not: null },
        specialExam1Date: null,
      },
      include: {
        case: {
          include: {
            patient: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { examRequestReceivedAt: 'asc' },
    })

    // 특진병원별로 그룹핑
    const grouped: Record<string, typeof results> = {}
    for (const item of results) {
      const clinic = item.specialClinic ?? '병원 미선택'
      if (!grouped[clinic]) grouped[clinic] = []
      grouped[clinic].push(item)
    }

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('[HearingLoss Unscheduled GET]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
