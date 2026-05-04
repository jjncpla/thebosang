/**
 * 통합 캘린더 webhook 처리 통계
 *
 * GET /api/admin/calendar/webhook-stats?days=7
 *
 * 응답:
 *  - bySource: source별 처리 건수 / 미처리 / 실패 / cron_backup 비율
 *  - daily: 일별 (yyyy-mm-dd) 처리 건수 (최근 N일)
 *  - avgProcessingDelayMs: 1차 webhook 도착 ~ processedAt 평균 지연
 *  - missedByPrimary: cron_backup 으로 처리된 건수 (= 1차 webhook 누락 추정)
 *
 * 권한: ADMIN.
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const daysParam = parseInt(url.searchParams.get("days") ?? "7", 10)
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 7

  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  // 1) 전체 이벤트 fetch (days 범위 내)
  const events = await prisma.webhookEvent.findMany({
    where: { createdAt: { gte: since } },
    select: {
      source: true,
      processedAt: true,
      processedBy: true,
      errorMessage: true,
      retries: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // 2) source별 집계
  const bySourceMap: Record<
    string,
    {
      total: number
      processed: number
      pending: number
      failed: number
      processedByWebhook: number
      processedByCronBackup: number
    }
  > = {}

  for (const e of events) {
    if (!bySourceMap[e.source]) {
      bySourceMap[e.source] = {
        total: 0,
        processed: 0,
        pending: 0,
        failed: 0,
        processedByWebhook: 0,
        processedByCronBackup: 0,
      }
    }
    const bucket = bySourceMap[e.source]
    bucket.total++
    if (e.processedAt) {
      bucket.processed++
      if (e.processedBy === "webhook") bucket.processedByWebhook++
      else if (e.processedBy === "cron_backup") bucket.processedByCronBackup++
    } else {
      bucket.pending++
      if (e.errorMessage) bucket.failed++
    }
  }

  // 3) 일별 집계
  const dailyMap: Record<string, number> = {}
  for (const e of events) {
    const d = e.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    dailyMap[key] = (dailyMap[key] ?? 0) + 1
  }
  const daily = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 4) 평균 처리 지연 (createdAt → processedAt)
  let delaySum = 0
  let delayCount = 0
  let missedByPrimary = 0
  for (const e of events) {
    if (e.processedAt) {
      delaySum += e.processedAt.getTime() - e.createdAt.getTime()
      delayCount++
      if (e.processedBy === "cron_backup") missedByPrimary++
    }
  }
  const avgProcessingDelayMs = delayCount > 0 ? Math.round(delaySum / delayCount) : null

  return NextResponse.json({
    rangeDays: days,
    since: since.toISOString(),
    totalEvents: events.length,
    bySource: bySourceMap,
    daily,
    avgProcessingDelayMs,
    missedByPrimary,
  })
}
