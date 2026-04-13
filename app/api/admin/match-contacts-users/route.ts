import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authPrisma } from '@/lib/auth-db'
import { auth } from '@/auth'

export async function POST() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const users = await authPrisma.user.findMany({
      select: { id: true, name: true, email: true },
    })

    const contacts = await prisma.contact.findMany({
      where: { userId: null },
      select: { id: true, name: true, email: true },
    })

    const usersArr = users as any[]
    let matched = 0
    for (const contact of contacts as any[]) {
      const matchedUser =
        usersArr.find(
          (u: any) =>
            u.name === contact.name &&
            contact.email &&
            u.email?.includes(contact.email.split('@')[0])
        ) || usersArr.find((u: any) => u.name === contact.name)

      if (matchedUser) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { userId: matchedUser.id },
        })
        matched++
      }
    }

    return NextResponse.json({
      ok: true,
      matched,
      totalContacts: contacts.length,
      totalUsers: users.length,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
