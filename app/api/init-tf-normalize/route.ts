import { prisma } from "@/lib/prisma"
import { canonicalizeTfName } from "@/lib/tf-normalize"
import { NextResponse } from "next/server"

/**
 * 기존 SpecialClinicSchedule 레코드의 tfName을 canonical 형태로 일괄 정규화.
 * GET 호출 1회 (멱등) — 다시 호출해도 이미 정규화된 건 변화 없음.
 *
 * 예시 변환:
 *   창원TF → 이산창원TF
 *   울산동부TF → 이산울산동부TF
 *   울동TF → 더보상울동TF
 *   '평택TF 강병훈 과장님' → 이산평택TF
 *
 * 처리 방식: distinct tfName 목록만 가져와서 alias별로 updateMany. 60K 레코드 전체 순회 안 함.
 * 기존 init-calendar-freeform 패턴과 동일하게 auth 없음 (1회성 마이그레이션 + 멱등).
 */
export async function GET() {
  // 1. distinct TF 목록 수집
  const distinctRows = await prisma.specialClinicSchedule.findMany({
    select: { tfName: true },
    distinct: ['tfName'],
  })
  const distinctTfs = [...new Set(distinctRows.map(r => r.tfName).filter(Boolean))]

  // 2. 변환 대상 선별
  const mappings: { before: string; after: string; affected?: number }[] = []
  for (const tf of distinctTfs) {
    const canonical = canonicalizeTfName(tf)
    if (canonical && canonical !== tf) {
      mappings.push({ before: tf, after: canonical })
    }
  }

  // 3. alias별 bulk UPDATE
  let totalAffected = 0
  for (const m of mappings) {
    const { count } = await prisma.specialClinicSchedule.updateMany({
      where: { tfName: m.before },
      data: { tfName: m.after },
    })
    m.affected = count
    totalAffected += count
  }

  return NextResponse.json({
    ok: true,
    distinctTfsBefore: distinctTfs.length,
    mappingsApplied: mappings.length,
    recordsUpdated: totalAffected,
    mappings,
  })
}
