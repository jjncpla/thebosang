import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const results: string[] = []

    // 이정준의 모든 StaffRoster 레코드 확인
    const allRecords = await prisma.staffRoster.findMany({
      where: { staffName: '이정준' }
    })
    results.push(`이정준 전체 레코드: ${JSON.stringify(allRecords)}`)

    // 울산지사 이정준 레코드가 있으면 endYear/endMonth 초기화 + staffType 수정
    const existing = allRecords.find(r => r.branchName === '울산지사')
    if (existing) {
      await prisma.staffRoster.update({
        where: { id: existing.id },
        data: { staffType: 'ATTORNEY', endYear: null, endMonth: null }
      })
      results.push(`updated: 울산지사/이정준 endYear/endMonth → null, staffType → ATTORNEY`)
    } else {
      // 없으면 새로 생성
      await prisma.staffRoster.create({
        data: {
          branchName: '울산지사',
          staffName: '이정준',
          staffType: 'ATTORNEY',
          startYear: 2018,
          startMonth: 1,
        }
      })
      results.push(`created: 울산지사/이정준 as ATTORNEY (2018.1~)`)
    }

    // 최종 확인
    const final = await prisma.staffRoster.findMany({
      where: { branchName: '울산지사', staffName: '이정준' }
    })
    results.push(`최종 이정준 레코드: ${JSON.stringify(final)}`)

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
