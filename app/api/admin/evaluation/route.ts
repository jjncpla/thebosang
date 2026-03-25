import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_ROLES = ['ADMIN', '조직관리자']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period')
  const promotionOnly = searchParams.get('promotionOnly') === 'true'

  const evaluations = await prisma.staffEvaluation.findMany({
    where: {
      ...(period ? { period } : {}),
      ...(promotionOnly ? { isPromotionTarget: true } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(evaluations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    userId, period, score,
    performanceScore, attendanceScore, attitudeScore,
    isPromotionTarget, promotionGrade, memo
  } = body

  // 승진 대상 여부 자동 판단 (점수 80점 이상 시 대상)
  const autoPromotion = (score ?? 0) >= 80

  const evaluation = await prisma.staffEvaluation.create({
    data: {
      userId,
      evaluatorId: session.user.id,
      period,
      score,
      performanceScore,
      attendanceScore,
      attitudeScore,
      isPromotionTarget: isPromotionTarget ?? autoPromotion,
      promotionGrade,
      memo,
    },
  })

  return NextResponse.json(evaluation)
}
