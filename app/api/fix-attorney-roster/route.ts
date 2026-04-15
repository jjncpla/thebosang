import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Contact.branch → StaffRoster.branchName 매핑
const BRANCH_MAP: Record<string, string> = {
  '노무법인 더보상 울산지사': '울산지사',
  '노무법인 더보상 울산동부지사': '울산동부지사',
  '노무법인 더보상 부산경남지사': '부산경남지사',
  '노무법인 더보상 경기안산지사': '경기안산지사',
  '노무법인 더보상 전북익산지사': '전북익산지사',
  '노무법인 더보상 경북구미지사': '경북구미지사',
  '노무법인 더보상 경기의정부지사': '경기의정부지사',
  '노무법인 더보상 강원동해지사': '강원동해지사',
  '노무법인 더보상 전남여수지사': '전남여수지사',
  '노무법인 더보상 대구지사': '대구지사',
  '노무법인 더보상 부산중부지사': '부산중부지사',
  '노무법인 더보상 경기수원지사': '경기수원지사',
  '노무법인 더보상 대전지사': '대전지사',
  '노무법인 더보상 경인지사': '경인지사',
  '노무법인 더보상 경북포항지사': '경북포항지사',
  '노무법인 더보상 경남창원지사': '경남창원지사',
  '노무법인 더보상 전남순천지사': '전남순천지사',
  '노무법인 더보상 서울구로지사': '서울구로지사',
}

export async function GET() {
  try {
    const results: string[] = []

    // 1. 잘못된 branchName으로 생성된 ATTORNEY 레코드 삭제
    const wrongRecords = await prisma.staffRoster.findMany({
      where: { staffType: 'ATTORNEY', branchName: { startsWith: '노무법인' } }
    })
    for (const rec of wrongRecords) {
      await prisma.staffRoster.delete({ where: { id: rec.id } })
      results.push(`deleted wrong: ${rec.branchName} / ${rec.staffName}`)
    }

    // 기타 잘못된 branchName (법무법인, 더보상 직업병 등)
    const otherWrong = await prisma.staffRoster.findMany({
      where: {
        staffType: 'ATTORNEY',
        branchName: { not: { in: ['울산지사', '부산경남지사', '서울북부지사', '경기안산지사', '전북익산지사', '경북구미지사', '경기의정부지사', '강원동해지사', '전남여수지사', '대구지사', '부산중부지사', '경기수원지사', '울산동부지사', '대전지사', '경인지사', '경북포항지사', '경남창원지사', '전남순천지사', '서울구로지사'] } }
      }
    })
    for (const rec of otherWrong) {
      await prisma.staffRoster.delete({ where: { id: rec.id } })
      results.push(`deleted wrong: ${rec.branchName} / ${rec.staffName}`)
    }

    // 2. Contact 기반으로 올바른 branchName으로 재등록
    const attorneys = await prisma.contact.findMany({
      where: {
        firmType: 'TBOSANG',
        jobGrade: { in: ['노무사', '등기노무사'] },
        leaveDate: null,
      },
    })

    for (const atty of attorneys) {
      const shortBranch = BRANCH_MAP[atty.branch]
      if (!shortBranch) {
        results.push(`skip: ${atty.name} (${atty.branch}) — 매핑 없음`)
        continue
      }

      const existing = await prisma.staffRoster.findFirst({
        where: { branchName: shortBranch, staffName: atty.name }
      })

      const startYear = atty.hireDate ? atty.hireDate.getFullYear() : 2020
      const startMonth = atty.hireDate ? atty.hireDate.getMonth() + 1 : 1

      if (existing) {
        await prisma.staffRoster.update({
          where: { id: existing.id },
          data: { staffType: 'ATTORNEY' }
        })
        results.push(`updated: ${shortBranch} / ${atty.name} → ATTORNEY (was ${existing.staffType})`)
      } else {
        await prisma.staffRoster.create({
          data: { branchName: shortBranch, staffName: atty.name, staffType: 'ATTORNEY', startYear, startMonth }
        })
        results.push(`created: ${shortBranch} / ${atty.name} as ATTORNEY`)
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
