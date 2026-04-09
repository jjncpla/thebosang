import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const all = await prisma.specialClinicSchedule.findMany({
    select: { id: true, tfName: true }
  })

  const toUpdate = all.filter(s =>
    s.tfName && !s.tfName.startsWith('더보상') && !s.tfName.startsWith('이산')
  )

  let updated = 0
  for (const s of toUpdate) {
    if (!s.tfName) continue
    await prisma.specialClinicSchedule.update({
      where: { id: s.id },
      data: { tfName: '이산' + s.tfName }
    })
    updated++
  }

  return NextResponse.json({ ok: true, updated, sample: toUpdate.slice(0, 5) })
}
