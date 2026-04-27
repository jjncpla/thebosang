// Run analyzeFile multiple times and collect statistics.
import { analyzeFile } from "./analyze.mjs"
import fs from "node:fs"
import path from "node:path"

const TEST_CASES = [
  { pdf: "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\김옥자 자격득실확인서.pdf", docType: "건보", label: "김옥자 자격득실" },
  { pdf: "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\김옥자 국민연금.pdf", docType: "연금", label: "김옥자 국민연금" },
  { pdf: "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\김옥자 고용보험.pdf", docType: "고용산재_전체", label: "김옥자 고용보험" },
  { pdf: "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\안세윤 자격득실확인서.pdf", docType: "건보", label: "안세윤 자격득실" },
  { pdf: "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\안세윤 국민연금.pdf", docType: "연금", label: "안세윤 국민연금" },
  { pdf: "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\안세윤 고용보험.pdf", docType: "고용산재_전체", label: "안세윤 고용보험 (헤비)" },
]

const RUNS = Number(process.argv[2] ?? 3)
const CHUNK_PAGES = Number(process.argv[3] ?? 5)
const CONCURRENCY = Number(process.argv[4] ?? 5)

console.log(`▶ 벤치 시작: ${RUNS}회 반복, 청크 ${CHUNK_PAGES}페이지, 동시성 ${CONCURRENCY}`)

const summary = []
for (const tc of TEST_CASES) {
  if (!fs.existsSync(tc.pdf)) {
    console.log(`\n[${tc.label}] 파일 없음, 스킵`)
    continue
  }
  console.log(`\n=== [${tc.label}] (${tc.docType}) ===`)
  const runs = []
  for (let i = 0; i < RUNS; i++) {
    try {
      const res = await analyzeFile(tc.pdf, tc.docType, {
        chunkPages: CHUNK_PAGES,
        concurrency: CONCURRENCY,
        verbose: false,
      })
      const counts = {
        고용산재: res.merged.sources.고용산재.length,
        건보: res.merged.sources.건보.length,
        연금: res.merged.sources.연금.length,
        일용직: res.merged.dailyEntries.length,
      }
      runs.push({ ms: res.totalMs, counts, name: res.merged.name, chunks: res.chunksCount })
      console.log(
        `  Run ${i + 1}: ${(res.totalMs / 1000).toFixed(1)}s | name="${res.merged.name}" | 고용:${counts.고용산재} 건보:${counts.건보} 연금:${counts.연금} 일용:${counts.일용직} | 청크 ${res.chunksCount}`
      )
    } catch (e) {
      console.log(`  Run ${i + 1}: ERROR ${e.message}`)
      runs.push({ error: e.message })
    }
  }

  // Stats
  const ok = runs.filter((r) => !r.error)
  if (ok.length > 0) {
    const avg = ok.reduce((s, r) => s + r.ms, 0) / ok.length / 1000
    const min = Math.min(...ok.map((r) => r.ms)) / 1000
    const max = Math.max(...ok.map((r) => r.ms)) / 1000

    // Consistency: do counts match across runs?
    const firstCounts = JSON.stringify(ok[0].counts)
    const consistent = ok.every((r) => JSON.stringify(r.counts) === firstCounts)

    console.log(
      `  ▶ 평균 ${avg.toFixed(1)}s (${min.toFixed(1)}-${max.toFixed(1)}s) | 일관성: ${consistent ? "✓" : "✗"}`
    )
    summary.push({ label: tc.label, runs: ok.length, avg, min, max, consistent, sampleCounts: ok[0].counts })
  } else {
    summary.push({ label: tc.label, runs: 0, error: "all failed" })
  }
}

console.log("\n\n========== 종합 ==========")
console.log("케이스 | 평균 | 범위 | 일관성 | 샘플 결과")
for (const s of summary) {
  if (s.error) {
    console.log(`${s.label} | FAIL`)
  } else {
    console.log(
      `${s.label} | ${s.avg.toFixed(1)}s | ${s.min.toFixed(1)}-${s.max.toFixed(1)}s | ${s.consistent ? "OK" : "변동"} | ${JSON.stringify(s.sampleCounts)}`
    )
  }
}

const fastEnough = summary.filter((s) => !s.error && s.avg <= 10).length
const consistent = summary.filter((s) => !s.error && s.consistent).length
const total = summary.filter((s) => !s.error).length
console.log(`\n10초 이내: ${fastEnough}/${total}, 일관성: ${consistent}/${total}`)

// Save report
const reportPath = path.resolve(
  "C:\\Users\\jjakg\\thebosang\\.claude\\worktrees\\reverent-kalam-786964\\scripts\\test-harness\\last-bench.json"
)
fs.writeFileSync(reportPath, JSON.stringify({ runs: RUNS, chunkPages: CHUNK_PAGES, concurrency: CONCURRENCY, summary, ts: new Date().toISOString() }, null, 2))
console.log(`\n리포트 저장: ${reportPath}`)
