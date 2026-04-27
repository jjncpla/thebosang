import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

/**
 * 통합캘린더 필터 프리셋 — 로그인 사용자별로 저장.
 * 각 프리셋: { id, name, filters: { selectedBranch, selectedTFs, categoryFilters, hospitalFilters, statusFilters, staffFilters }, createdAt }
 */

export interface CalendarPresetFilters {
  selectedBranch?: string
  selectedTFs?: string[]
  categoryFilters?: string[]
  hospitalFilters?: string[]
  statusFilters?: string[]
  staffFilters?: string[]
}
export interface CalendarPreset {
  id: string
  name: string
  filters: CalendarPresetFilters
  createdAt: string
}

async function getUserPresets(userId: string): Promise<CalendarPreset[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarPresets: true },
  })
  const raw = u?.calendarPresets
  if (Array.isArray(raw)) return raw as unknown as CalendarPreset[]
  return []
}

async function setUserPresets(userId: string, presets: CalendarPreset[]) {
  await prisma.user.update({
    where: { id: userId },
    data: { calendarPresets: presets as unknown as object },
  })
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const presets = await getUserPresets(session.user.id as string)
  return NextResponse.json({ presets })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id as string

  const body = await req.json()
  const name = String(body.name || '').trim()
  const filters = body.filters as CalendarPresetFilters | undefined
  if (!name) return NextResponse.json({ error: '이름 필수' }, { status: 400 })
  if (!filters || typeof filters !== 'object') return NextResponse.json({ error: 'filters 필수' }, { status: 400 })

  const presets = await getUserPresets(userId)
  // 중복 이름 방지: 같은 이름이 있으면 덮어쓰기
  const idx = presets.findIndex(p => p.name === name)
  const newPreset: CalendarPreset = {
    id: idx >= 0 ? presets[idx].id : 'p_' + Math.random().toString(36).slice(2, 10),
    name,
    filters: {
      selectedBranch: filters.selectedBranch ?? undefined,
      selectedTFs: filters.selectedTFs ?? [],
      categoryFilters: filters.categoryFilters ?? [],
      hospitalFilters: filters.hospitalFilters ?? [],
      statusFilters: filters.statusFilters ?? [],
      staffFilters: filters.staffFilters ?? [],
    },
    createdAt: idx >= 0 ? presets[idx].createdAt : new Date().toISOString(),
  }
  if (idx >= 0) presets[idx] = newPreset
  else presets.push(newPreset)

  // 최대 30개 제한
  if (presets.length > 30) presets.shift()

  await setUserPresets(userId, presets)
  return NextResponse.json({ ok: true, preset: newPreset, total: presets.length })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id as string

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const presets = await getUserPresets(userId)
  const next = presets.filter(p => p.id !== id)
  await setUserPresets(userId, next)
  return NextResponse.json({ ok: true, total: next.length })
}
