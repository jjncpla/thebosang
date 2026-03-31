import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const contacts = await prisma.contact.findMany({
    where: { hireDate: { not: null } },
    select: { name: true, branch: true, hireDate: true, leaveDate: true },
  })
  return NextResponse.json({ contacts })
}
