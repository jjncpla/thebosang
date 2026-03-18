import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// PATCH: 특진 회차 데이터 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; examId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { examId } = await params
    const body = await request.json()

    const exam = await prisma.hearingLossExam.update({
      where: { id: examId },
      data: body
    })

    return NextResponse.json(exam)
  } catch (error) {
    console.error('[HearingLossExam PATCH]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// DELETE: 특진 회차 데이터 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; examId: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { examId } = await params

    await prisma.hearingLossExam.delete({
      where: { id: examId }
    })

    return NextResponse.json({ message: '삭제되었습니다.' })
  } catch (error) {
    console.error('[HearingLossExam DELETE]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
