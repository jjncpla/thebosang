import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 더보상울산 담당 지사사건 목록 (엑셀에서 확인된 16건)
    const targets = [
      { month: 1, victimName: '김수철5' },
      { month: 1, victimName: '김수옥' },
      { month: 1, victimName: '양만근' },
      { month: 2, victimName: '김영식22' },
      { month: 2, victimName: '김형진3' },
      { month: 2, victimName: '계운송' },
      { month: 2, victimName: '김수옥' },
      { month: 3, victimName: '계운송' },
      { month: 3, victimName: '이진욱1' },
      { month: 3, victimName: '김태수18' },
      { month: 3, victimName: '김수옥' },
      { month: 3, victimName: '박명석3' },
      { month: 3, victimName: '신상식2' },
    ]

    const branchName = '울산지사'
    const year = 2026
    const results: string[] = []

    for (const t of targets) {
      // 같은 월/재해자 중복 가능 → findMany
      const recs = await prisma.settlementRecord.findMany({
        where: { branchName, year, month: t.month, victimName: t.victimName }
      })

      for (const rec of recs) {
        await prisma.settlementRecord.update({
          where: { id: rec.id },
          data: { salesStaffName: '더보상울산', settlementStaffName: '더보상울산' }
        })
        results.push(`${t.month}월 ${t.victimName}: ${rec.salesStaffName} → 더보상울산`)
      }

      if (recs.length === 0) {
        results.push(`${t.month}월 ${t.victimName}: 미발견`)
      }
    }

    return NextResponse.json({ ok: true, count: results.length, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
