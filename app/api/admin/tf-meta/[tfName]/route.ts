import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * PATCH: TF 메모 업데이트 (upsert).
 * DELETE: 메모 삭제 (TF 자체는 그대로, 설명만 제거).
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tfName: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { tfName } = await params
  const decoded = decodeURIComponent(tfName)
  const body = await req.json()
  const memo: string | null = typeof body.memo === 'string' ? body.memo : null

  const tfMeta = (prisma as unknown as {
    tfMeta: {
      upsert: (args: {
        where: { tfName: string }
        update: { memo: string | null }
        create: { tfName: string; memo: string | null }
      }) => Promise<{ tfName: string; memo: string | null; updatedAt: Date }>
    }
  }).tfMeta

  const result = await tfMeta.upsert({
    where: { tfName: decoded },
    update: { memo },
    create: { tfName: decoded, memo },
  })

  return NextResponse.json({ ok: true, tfName: result.tfName, memo: result.memo, updatedAt: result.updatedAt })
}
