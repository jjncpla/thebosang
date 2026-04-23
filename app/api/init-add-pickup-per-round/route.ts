import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * HearingLossDetail에 회차별 픽업 필드 추가 (멱등).
 * - specialExam1~5Pickup
 * - reSpecialExam1~3Pickup
 * - re2SpecialExam1~3Pickup
 *
 * 기존 specialClinicPickup / reSpecialClinicPickup / re2SpecialClinicPickup 값은
 * 해당 clinicType의 1차 회차로 자동 이관.
 */
export async function GET() {
  const steps: { step: string; ok: boolean; error?: string }[] = []

  async function run(label: string, sql: () => Promise<unknown>) {
    try {
      await sql()
      steps.push({ step: label, ok: true })
    } catch (e) {
      steps.push({ step: label, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const cols = [
    ...[1,2,3,4,5].map(n => `specialExam${n}Pickup`),
    ...[1,2,3].map(n => `reSpecialExam${n}Pickup`),
    ...[1,2,3].map(n => `re2SpecialExam${n}Pickup`),
  ]

  for (const col of cols) {
    await run(`ADD COLUMN ${col}`, () =>
      prisma.$executeRawUnsafe(
        `ALTER TABLE "hearing_loss_details" ADD COLUMN IF NOT EXISTS "${col}" BOOLEAN`
      )
    )
  }

  // 기존 단일 필드 → 1차로 값 이관 (null인 회차만)
  await run('migrate specialClinicPickup → specialExam1Pickup', () =>
    prisma.$executeRaw`
      UPDATE "hearing_loss_details"
      SET "specialExam1Pickup" = "specialClinicPickup"
      WHERE "specialExam1Pickup" IS NULL AND "specialClinicPickup" IS NOT NULL
    `
  )
  await run('migrate reSpecialClinicPickup → reSpecialExam1Pickup', () =>
    prisma.$executeRaw`
      UPDATE "hearing_loss_details"
      SET "reSpecialExam1Pickup" = "reSpecialClinicPickup"
      WHERE "reSpecialExam1Pickup" IS NULL AND "reSpecialClinicPickup" IS NOT NULL
    `
  )
  await run('migrate re2SpecialClinicPickup → re2SpecialExam1Pickup', () =>
    prisma.$executeRaw`
      UPDATE "hearing_loss_details"
      SET "re2SpecialExam1Pickup" = "re2SpecialClinicPickup"
      WHERE "re2SpecialExam1Pickup" IS NULL AND "re2SpecialClinicPickup" IS NOT NULL
    `
  )

  const allOk = steps.every(s => s.ok)
  return NextResponse.json({ ok: allOk, steps })
}
