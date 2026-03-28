import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 외근직: 과장, 선임과장, 책임과장, 차장, 팀장
    await prisma.contact.updateMany({
      where: { title: { contains: '과장' } },
      data: { jobGrade: '외근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '차장' } },
      data: { jobGrade: '외근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '팀장' } },
      data: { jobGrade: '외근직' }
    })

    // 내근직: 사원, 주임, 대리, 파트장, 매니저, 실장, 디자이너
    await prisma.contact.updateMany({
      where: { title: { contains: '사원' } },
      data: { jobGrade: '내근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '주임' } },
      data: { jobGrade: '내근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '대리' } },
      data: { jobGrade: '내근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '파트장' } },
      data: { jobGrade: '내근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '매니저' } },
      data: { jobGrade: '내근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '실장' } },
      data: { jobGrade: '내근직' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '디자이너' } },
      data: { jobGrade: '내근직' }
    })

    // 등기노무사: 수석노무사, 지사장, 권역지사장, 센터장, 부센터장, 부대표, 대표, 전무이사, 이사, 부문장, 연구원, 권역장
    await prisma.contact.updateMany({
      where: { title: { contains: '수석노무사' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '지사장' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '센터장' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '부대표' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '대표' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '이사' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '부문장' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '연구원' } },
      data: { jobGrade: '등기노무사' }
    })
    await prisma.contact.updateMany({
      where: { title: { contains: '권역장' } },
      data: { jobGrade: '등기노무사' }
    })

    // 노무사 (수석노무사 제외)
    await prisma.contact.updateMany({
      where: {
        AND: [
          { title: { contains: '노무사' } },
          { title: { not: { contains: '수석노무사' } } },
        ]
      },
      data: { jobGrade: '노무사' }
    })

    // 변호사
    await prisma.contact.updateMany({
      where: { title: { contains: '변호사' } },
      data: { jobGrade: '변호사' }
    })

    // 손해사정사 → 기타
    // 나머지 미분류 → 기타
    await prisma.contact.updateMany({
      where: {
        OR: [
          { jobGrade: '' },
          { jobGrade: '미분류' },
        ]
      },
      data: { jobGrade: '기타' }
    })

    // 결과 집계
    const stats = await prisma.contact.groupBy({
      by: ['jobGrade'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    return NextResponse.json({
      ok: true,
      stats: stats.map(s => ({ grade: s.jobGrade, count: s._count.id }))
    })
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
