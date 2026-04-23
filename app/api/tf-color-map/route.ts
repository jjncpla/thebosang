import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * 지사별 baseColor 맵 조회 (읽기 전용, 인증 불필요).
 * 통합캘린더·TF 관리 페이지 등에서 색상 일관화에 사용.
 * 응답: { [branchName]: hex_color }
 */
export async function GET() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { name: true, colorBase: true },
  })
  const map: Record<string, string> = {}
  for (const b of branches) {
    if (b.colorBase) map[b.name] = b.colorBase
  }
  return NextResponse.json(map, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  })
}
