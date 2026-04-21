import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * PATCH: Branch의 관할 TF 목록을 교체.
 * Body: { tfs: string[] }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const tfs: unknown = body.tfs
  if (!Array.isArray(tfs) || !tfs.every(t => typeof t === 'string')) {
    return NextResponse.json({ error: "tfs: string[] 필수" }, { status: 400 })
  }

  // 중복 제거, 트림, 빈 제거
  const normalized = [...new Set(
    (tfs as string[]).map(t => t.trim()).filter(Boolean)
  )]

  const updated = await prisma.branch.update({
    where: { id },
    data: { assignedTFs: normalized as unknown as object },
    select: { id: true, name: true, assignedTFs: true },
  })

  return NextResponse.json({ ok: true, branch: updated })
}
