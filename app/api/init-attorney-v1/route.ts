import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const branchName = '울산지사'
    const results: string[] = []

    const attorneys = [
      { staffName: '이정준', startYear: 2018, startMonth: 1 },
    ]

    for (const atty of attorneys) {
      const existing = await prisma.staffRoster.findFirst({
        where: { branchName, staffName: atty.staffName }
      })
      if (existing) {
        await prisma.staffRoster.update({
          where: { id: existing.id },
          data: { staffType: 'ATTORNEY' }
        })
        results.push('updated ' + atty.staffName + ' → ATTORNEY')
      } else {
        await prisma.staffRoster.create({
          data: { branchName, staffName: atty.staffName, staffType: 'ATTORNEY', startYear: atty.startYear, startMonth: atty.startMonth }
        })
        results.push('created ' + atty.staffName + ' as ATTORNEY')
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
