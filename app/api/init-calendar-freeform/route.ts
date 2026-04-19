import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * 통합 캘린더 자유형 카테고리(영업·자료보완·교육·회의·질판위·상담·약정) 도입.
 * 1) title / content 컬럼 추가
 * 2) 특진/재특진 전용이던 컬럼(patientName, hospitalName, clinicType, examRound)을 nullable로 변경
 * 3) tfName NOT NULL을 유지하되 기본값 '' 부여 (자유형에서 TF 선택 생략 가능)
 *
 * 배포 후 최초 1회만 호출하면 됨 — IF EXISTS / IF NOT EXISTS 사용으로 재실행 안전.
 */
export async function GET() {
  const steps: { step: string; ok: boolean; error?: string }[] = []

  async function run(label: string, sql: () => Promise<unknown>) {
    try {
      await sql()
      steps.push({ step: label, ok: true })
    } catch (e: unknown) {
      steps.push({ step: label, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  await run(
    'ADD COLUMN title',
    () => prisma.$executeRaw`ALTER TABLE "SpecialClinicSchedule" ADD COLUMN IF NOT EXISTS "title" TEXT`
  )
  await run(
    'ADD COLUMN content',
    () => prisma.$executeRaw`ALTER TABLE "SpecialClinicSchedule" ADD COLUMN IF NOT EXISTS "content" TEXT`
  )
  await run(
    'DROP NOT NULL patientName',
    () => prisma.$executeRaw`ALTER TABLE "SpecialClinicSchedule" ALTER COLUMN "patientName" DROP NOT NULL`
  )
  await run(
    'DROP NOT NULL hospitalName',
    () => prisma.$executeRaw`ALTER TABLE "SpecialClinicSchedule" ALTER COLUMN "hospitalName" DROP NOT NULL`
  )
  await run(
    'DROP NOT NULL clinicType',
    () => prisma.$executeRaw`ALTER TABLE "SpecialClinicSchedule" ALTER COLUMN "clinicType" DROP NOT NULL`
  )
  await run(
    'DROP NOT NULL examRound',
    () => prisma.$executeRaw`ALTER TABLE "SpecialClinicSchedule" ALTER COLUMN "examRound" DROP NOT NULL`
  )
  await run(
    'SET DEFAULT tfName',
    () => prisma.$executeRaw`ALTER TABLE "SpecialClinicSchedule" ALTER COLUMN "tfName" SET DEFAULT ''`
  )

  const allOk = steps.every(s => s.ok)
  return NextResponse.json({ ok: allOk, steps })
}
