import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET: 특정 사건의 소음성 난청 상세 정보 조회
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
      include: {
        exams: {
          orderBy: [
            { examSet: 'asc' },
            { examRound: 'asc' }
          ]
        }
      }
    })

    if (!detail) {
      return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('[HearingLossDetail GET]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST: 소음성 난청 상세 정보 최초 생성
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

    const detail = await prisma.hearingLossDetail.create({
      data: {
        caseId,
        ...body
      }
    })

    return NextResponse.json(detail, { status: 201 })
  } catch (error) {
    console.error('[HearingLossDetail POST]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH: 소음성 난청 상세 정보 수정
export async function PATCH(
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

    const detail = await prisma.hearingLossDetail.update({
      where: { caseId },
      data: body
    })

    return NextResponse.json(detail)
  } catch (error) {
    console.error('[HearingLossDetail PATCH]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
