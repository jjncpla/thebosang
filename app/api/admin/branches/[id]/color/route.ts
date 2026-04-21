import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * PATCH: Branch.colorBase 업데이트.
 * Body: { colorBase: string | null }  — hex 문자열(#RRGGBB) 또는 null(지우기)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const raw: unknown = body.colorBase

  let colorBase: string | null = null
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s === '') {
      colorBase = null
    } else if (/^#[0-9A-Fa-f]{6}$/.test(s)) {
      colorBase = s.toUpperCase()
    } else {
      return NextResponse.json({ error: "colorBase 형식 오류 (예: #006838)" }, { status: 400 })
    }
  } else if (raw === null) {
    colorBase = null
  } else {
    return NextResponse.json({ error: "colorBase 필수 (string 또는 null)" }, { status: 400 })
  }

  const updated = await prisma.branch.update({
    where: { id },
    data: { colorBase },
    select: { id: true, name: true, colorBase: true },
  })

  return NextResponse.json({ ok: true, branch: updated })
}
