import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 이산 소속 외근직 Contact 이름 목록 조회
    const isanContacts = await prisma.contact.findMany({
      where: { firm: '노무법인 이산', jobGrade: '외근직' },
      select: { name: true, branch: true }
    })
    const isanNames = isanContacts.map(c => c.name)

    // 해당 이름으로 생성된 @thebosang.kr 계정 조회
    const isanUsers = await prisma.user.findMany({
      where: {
        AND: [
          { email: { endsWith: '@thebosang.kr' } },
          { name: { in: isanNames } },
          { role: { not: 'ADMIN' } },
        ]
      },
      select: { id: true, email: true, name: true }
    })

    // StaffRoster 정리 (이산 소속)
    const isanBranches = [...new Set(isanContacts.map(c => c.branch))]
    const deletedRoster = await prisma.staffRoster.deleteMany({
      where: {
        staffName: { in: isanNames },
        branchName: { in: isanBranches }
      }
    })

    // User 삭제
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        id: { in: isanUsers.map(u => u.id) }
      }
    })

    return NextResponse.json({
      ok: true,
      deletedUsers: deletedUsers.count,
      deletedRoster: deletedRoster.count,
      names: isanUsers.map(u => ({ name: u.name, email: u.email }))
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
