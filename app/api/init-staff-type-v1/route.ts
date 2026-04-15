import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 내근직 멤버 (울산지사)
    const internalStaff = ['이정준', '이환주', '김수진', '문유빈', '김영은']
    // 외근직이지만 로스터 누락된 멤버
    const missingExternal = [{ staffName: '허흔', startYear: 2022, startMonth: 1 }]

    const branchName = '울산지사'
    const results: string[] = []

    // 내근직 staffType 업데이트
    for (const name of internalStaff) {
      const existing = await prisma.staffRoster.findFirst({
        where: { branchName, staffName: name }
      })
      if (existing) {
        await prisma.staffRoster.update({
          where: { id: existing.id },
          data: { staffType: 'INTERNAL' }
        })
        results.push('updated ' + name + ' → INTERNAL')
      } else {
        await prisma.staffRoster.create({
          data: { branchName, staffName: name, staffType: 'INTERNAL', startYear: 2020, startMonth: 1 }
        })
        results.push('created ' + name + ' as INTERNAL')
      }
    }

    for (const staff of missingExternal) {
      const existing = await prisma.staffRoster.findFirst({
        where: { branchName, staffName: staff.staffName }
      })
      if (!existing) {
        await prisma.staffRoster.create({
          data: { branchName, ...staff, staffType: 'EXTERNAL' }
        })
        results.push('created ' + staff.staffName + ' as EXTERNAL')
      } else {
        results.push('already exists: ' + staff.staffName)
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
