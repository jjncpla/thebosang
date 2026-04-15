import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Contact 테이블의 노무사/등기노무사를 StaffRoster에 ATTORNEY로 등록
export async function GET() {
  try {
    const results: string[] = []

    // 울산지사 노무사/등기노무사 조회
    const attorneys = await prisma.contact.findMany({
      where: {
        firmType: 'TBOSANG',
        branch: '울산지사',
        jobGrade: { in: ['노무사', '등기노무사'] },
        leaveDate: null, // 퇴사하지 않은 인원만
      },
    })

    results.push(`울산지사 노무사/등기노무사: ${attorneys.length}명 — ${attorneys.map(a => `${a.name}(${a.jobGrade})`).join(', ')}`)

    for (const atty of attorneys) {
      const existing = await prisma.staffRoster.findFirst({
        where: { branchName: '울산지사', staffName: atty.name }
      })

      const startYear = atty.hireDate ? atty.hireDate.getFullYear() : 2020
      const startMonth = atty.hireDate ? atty.hireDate.getMonth() + 1 : 1

      if (existing) {
        await prisma.staffRoster.update({
          where: { id: existing.id },
          data: { staffType: 'ATTORNEY' }
        })
        results.push(`updated ${atty.name} → ATTORNEY (기존 staffType: ${existing.staffType})`)
      } else {
        await prisma.staffRoster.create({
          data: {
            branchName: '울산지사',
            staffName: atty.name,
            staffType: 'ATTORNEY',
            startYear,
            startMonth,
          }
        })
        results.push(`created ${atty.name} as ATTORNEY (${startYear}.${startMonth}~)`)
      }
    }

    // 전체 지사 대상으로도 처리
    const allBranches = await prisma.contact.findMany({
      where: {
        firmType: 'TBOSANG',
        jobGrade: { in: ['노무사', '등기노무사'] },
        leaveDate: null,
      },
      distinct: ['branch'],
      select: { branch: true },
    })

    for (const { branch } of allBranches) {
      if (branch === '울산지사') continue // 이미 처리

      const branchAttorneys = await prisma.contact.findMany({
        where: {
          firmType: 'TBOSANG',
          branch,
          jobGrade: { in: ['노무사', '등기노무사'] },
          leaveDate: null,
        },
      })

      for (const atty of branchAttorneys) {
        const existing = await prisma.staffRoster.findFirst({
          where: { branchName: branch, staffName: atty.name }
        })

        const startYear = atty.hireDate ? atty.hireDate.getFullYear() : 2020
        const startMonth = atty.hireDate ? atty.hireDate.getMonth() + 1 : 1

        if (existing) {
          await prisma.staffRoster.update({
            where: { id: existing.id },
            data: { staffType: 'ATTORNEY' }
          })
          results.push(`[${branch}] updated ${atty.name} → ATTORNEY`)
        } else {
          await prisma.staffRoster.create({
            data: {
              branchName: branch,
              staffName: atty.name,
              staffType: 'ATTORNEY',
              startYear,
              startMonth,
            }
          })
          results.push(`[${branch}] created ${atty.name} as ATTORNEY`)
        }
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
