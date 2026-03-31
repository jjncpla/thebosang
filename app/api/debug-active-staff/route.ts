import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const branchName = searchParams.get('branchName') || ''
  const year = parseInt(searchParams.get('year') || '2026')
  const month = parseInt(searchParams.get('month') || '6')

  const targetDate = new Date(year, month - 1, 1)
  const targetDateEnd = new Date(year, month, 0)

  // 1. 해당 지사 외근직 전체 (exact match)
  const exactMatch = await prisma.contact.findMany({
    where: {
      jobGrade: '외근직',
      ...(branchName ? { branch: branchName } : {}),
    },
    select: { name: true, branch: true, hireDate: true, leaveDate: true },
    take: 20,
  })

  // 2. 지사명에 contains로 검색 (불일치 진단용)
  const containsMatch = branchName ? await prisma.contact.findMany({
    where: {
      jobGrade: '외근직',
      branch: { contains: branchName.replace('노무법인 더보상 ', '') },
    },
    select: { name: true, branch: true, hireDate: true, leaveDate: true },
    take: 20,
  }) : []

  // 3. 전체 외근직 branch 값 목록 (유니크)
  const allBranches = await prisma.contact.findMany({
    where: { jobGrade: '외근직' },
    select: { branch: true },
    distinct: ['branch'],
    orderBy: { branch: 'asc' },
  })

  return NextResponse.json({
    params: { branchName, year, month },
    targetDate: targetDate.toISOString(),
    targetDateEnd: targetDateEnd.toISOString(),
    exactMatchCount: exactMatch.length,
    exactMatch,
    containsMatchCount: containsMatch.length,
    containsMatch,
    allBranches: allBranches.map(b => b.branch),
  })
}
