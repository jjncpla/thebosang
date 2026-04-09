import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const TF_MAP: Record<string, string> = {
  '거제':       '이산거제TF',
  '양산':       '이산양산TF',
  '울산남부':   '이산울산남부TF',
  '울산동부':   '이산울산동부TF',
  '울산동부TF': '이산울산동부TF',
  '울산북부':   '이산울산북부TF',
  '울동':       '더보상울산동부TF',
  '울산':       '더보상울산TF',
  '울산TF':     '더보상울산TF',
  '전하':       '더보상울산동부TF',
}

export async function GET() {
  let updated = 0
  const log: Array<{ from: string; to: string; count: number }> = []

  for (const [from, to] of Object.entries(TF_MAP)) {
    const result = await prisma.objectionCase.updateMany({
      where: { tfName: from },
      data: { tfName: to },
    })
    if (result.count > 0) {
      log.push({ from, to, count: result.count })
      updated += result.count
    }
  }

  return NextResponse.json({ ok: true, updated, log })
}
