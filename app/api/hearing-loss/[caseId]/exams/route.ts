import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: 특정 사건의 특진 회차 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { caseId } = await params

    const detail = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      select: { id: true }
    })

    if (!detail) {
      return NextResponse.json({ error: '소음성 난청 상세 정보가 없습니다.' }, { status: 404 })
    }

    const exams = await prisma.hearingLossExam.findMany({
      where: { hearingLossDetailId: detail.id },
      orderBy: [
        { examSet: 'asc' },
        { examRound: 'asc' }
      ]
    })

    return NextResponse.json(exams)
  } catch (error) {
    console.error('[HearingLossExam GET]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST: 특진 회차 데이터 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { caseId } = await params
    const body = await request.json()

    const detail = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      select: { id: true }
    })

    if (!detail) {
      return NextResponse.json({ error: '소음성 난청 상세 정보가 없습니다. 먼저 기본 정보를 생성하세요.' }, { status: 404 })
    }

    const exam = await prisma.hearingLossExam.create({
      data: {
        hearingLossDetailId: detail.id,
        examSet: body.examSet ?? 'INITIAL',
        examRound: body.examRound ?? 1,
        ...body
      }
    })

    return NextResponse.json(exam, { status: 201 })
  } catch (error) {
    console.error('[HearingLossExam POST]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
