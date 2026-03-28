import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const titles = await prisma.contact.groupBy({
      by: ['title'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 50,
    })

    const grades = await prisma.contact.groupBy({
      by: ['jobGrade'],
      _count: { id: true },
    })

    const samples = await prisma.contact.findMany({
      take: 5,
      select: { name: true, title: true, jobGrade: true }
    })

    return NextResponse.json({ titles, grades, samples })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
