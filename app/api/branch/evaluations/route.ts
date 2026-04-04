import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: 내근직 평가 조회
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const branchName = sp.get('branchName')
  const period = sp.get('period')
  const evalType = sp.get('evalType')

  if (!branchName || !period || !evalType) {
    return NextResponse.json({ error: 'branchName, period, evalType required' }, { status: 400 })
  }

  const evaluations = await prisma.staffEvaluation.findMany({
    where: { branchName, period, evalType },
    include: { user: { select: { id: true, name: true, branchName: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(evaluations)
}

// POST: 내근직 평가 저장 (upsert)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, period, evalType, grade, gradeReason, branchName } = body

  if (!userId || !period || !evalType || !branchName) {
    return NextResponse.json({ error: 'userId, period, evalType, branchName required' }, { status: 400 })
  }

  const result = await prisma.staffEvaluation.upsert({
    where: {
      userId_period_evalType: { userId, period, evalType },
    },
    update: { grade, gradeReason, branchName },
    create: { userId, period, evalType, grade, gradeReason, branchName },
  })

  return NextResponse.json(result)
}
