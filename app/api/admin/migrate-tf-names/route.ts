import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const RENAMES: [string, string][] = [
  ['부산TF', '이산부산TF'],
  ['울산TF', '이산울산TF'],
  ['대구TF', '이산대구TF'],
]

const TABLES = [
  'patient',
  'case',
  'consultation',
  'tfMessage',
  'objectionReview',
  'objectionCase',
  'wageReviewData',
  'settlementRecord',
  'specialClinicSchedule',
  'telegramMessage',
] as const

export async function POST() {
  const results: Record<string, number | string> = {}

  for (const [from, to] of RENAMES) {
    for (const table of TABLES) {
      try {
        const r = await (prisma as any)[table].updateMany({
          where: { tfName: from },
          data: { tfName: to },
        })
        results[`${table}.${from}`] = r.count
      } catch (e: any) {
        results[`${table}.${from}`] = `ERR: ${e?.message ?? e}`
      }
    }
  }

  return NextResponse.json({ ok: true, results })
}
