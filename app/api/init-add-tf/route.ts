import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * 지정한 지사의 assignedTFs에 단일 TF를 append (멱등).
 * 기존 TF는 그대로 유지. 이미 포함된 TF면 no-op.
 *
 * 사용: GET /api/init-add-tf?branch=<encoded>&tf=<encoded>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branch = searchParams.get('branch')
  const tf = searchParams.get('tf')
  if (!branch || !tf) {
    return NextResponse.json({ error: "branch, tf 쿼리 파라미터 필수" }, { status: 400 })
  }

  const b = await prisma.branch.findUnique({
    where: { name: branch },
    select: { id: true, assignedTFs: true },
  })
  if (!b) return NextResponse.json({ error: `branch '${branch}' not found` }, { status: 404 })

  const current = Array.isArray(b.assignedTFs) ? (b.assignedTFs as string[]) : []
  if (current.includes(tf)) {
    return NextResponse.json({ ok: true, branch, tf, changed: false, current })
  }

  const next = [...current, tf]
  await prisma.branch.update({
    where: { id: b.id },
    data: { assignedTFs: next as unknown as object },
  })

  return NextResponse.json({ ok: true, branch, tf, changed: true, before: current, after: next })
}
