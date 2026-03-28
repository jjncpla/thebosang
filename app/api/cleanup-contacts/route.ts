import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const deleted = await prisma.contact.deleteMany({
      where: {
        title: {
          in: ['사업자 등록번호', '팩스번호', '주소', '사업자등록번호', '팩스', '홈페이지', '']
        }
      }
    })
    // name이 '사업자 등록번호', '팩스번호', '주소'인 경우도 삭제
    const deleted2 = await prisma.contact.deleteMany({
      where: {
        name: {
          in: ['사업자 등록번호', '팩스번호', '주소', '사업자등록번호', '팩스']
        }
      }
    })
    const remaining = await prisma.contact.count()
    return NextResponse.json({ ok: true, deleted: deleted.count + deleted2.count, remaining })
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
