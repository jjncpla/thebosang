import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * 'Legacy' TF를 '미확인TF'로 일괄 rename.
 *
 * 1) SpecialClinicSchedule.tfName = 'Legacy' → '미확인TF'
 * 2) TfMeta: Legacy 레코드의 메모를 미확인TF로 이관 (기존 미확인TF 레코드 없을 때만)
 * 3) Branch.assignedTFs JSON 배열에서도 'Legacy' → '미확인TF' 치환 (기타 지사)
 *
 * 멱등: 다시 호출해도 변동 없음.
 */
export async function GET() {
  const result: Record<string, unknown> = {}

  // 1. Schedule tfName rename
  const scheduleUpdate = await prisma.specialClinicSchedule.updateMany({
    where: { tfName: 'Legacy' },
    data: { tfName: '미확인TF' },
  })
  result.schedulesRenamed = scheduleUpdate.count

  // 2. TfMeta 이관
  const tfMeta = (prisma as unknown as {
    tfMeta: {
      findUnique: (args: { where: { tfName: string } }) => Promise<{ memo: string | null } | null>
      upsert: (args: {
        where: { tfName: string }
        update: { memo: string | null }
        create: { tfName: string; memo: string | null }
      }) => Promise<unknown>
      delete: (args: { where: { tfName: string } }) => Promise<unknown>
    }
  }).tfMeta

  const legacyMeta = await tfMeta.findUnique({ where: { tfName: 'Legacy' } })
  if (legacyMeta) {
    const newMeta = await tfMeta.findUnique({ where: { tfName: '미확인TF' } })
    if (!newMeta || !newMeta.memo) {
      await tfMeta.upsert({
        where: { tfName: '미확인TF' },
        update: { memo: legacyMeta.memo },
        create: { tfName: '미확인TF', memo: legacyMeta.memo },
      })
    }
    try {
      await tfMeta.delete({ where: { tfName: 'Legacy' } })
      result.legacyMetaDeleted = true
    } catch {
      result.legacyMetaDeleted = false
    }
  } else {
    result.legacyMetaDeleted = null
  }

  // 3. Branch.assignedTFs에서 Legacy → 미확인TF
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, assignedTFs: true },
  })
  let branchesTouched = 0
  for (const b of branches) {
    const tfs = Array.isArray(b.assignedTFs) ? (b.assignedTFs as string[]) : []
    if (!tfs.includes('Legacy')) continue
    const replaced = tfs.map(t => t === 'Legacy' ? '미확인TF' : t)
    // 중복 제거
    const deduped = [...new Set(replaced)]
    await prisma.branch.update({
      where: { id: b.id },
      data: { assignedTFs: deduped as unknown as object },
    })
    branchesTouched++
  }
  result.branchesTouched = branchesTouched

  return NextResponse.json({ ok: true, ...result })
}
