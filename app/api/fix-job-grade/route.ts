import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function classify(title: string): string {
  if (!title) return '기타'
  // 등기노무사 먼저 (더 구체적인 조건)
  if (/수석노무사|지사장|권역지사장|권역장|센터장|부센터장|부대표|전무이사|부문장/.test(title)) return '등기노무사'
  if (/^대표$/.test(title.trim())) return '등기노무사'
  if (/이사/.test(title) && !/전무이사/.test(title)) return '등기노무사'
  // 변호사
  if (/변호사/.test(title)) return '변호사'
  // 노무사 (공인노무사, 전임노무사, 수습노무사 등 포함)
  if (/노무사/.test(title)) return '노무사'
  // 외근직
  if (/팀장|차장|과장/.test(title)) return '외근직'
  // 내근직
  if (/파트장|매니저|실장|부장|사원|주임|대리|디자이너|계장/.test(title)) return '내근직'
  return '기타'
}

export async function GET() {
  try {
    const all = await prisma.contact.findMany({
      select: { id: true, title: true }
    })

    let updated = 0
    for (const c of all) {
      const grade = classify(c.title)
      await prisma.contact.update({
        where: { id: c.id },
        data: { jobGrade: grade }
      })
      updated++
    }

    const stats = await prisma.contact.groupBy({
      by: ['jobGrade'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    return NextResponse.json({
      ok: true,
      total: updated,
      stats: stats.map(s => ({ grade: s.jobGrade, count: s._count.id }))
    })
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
