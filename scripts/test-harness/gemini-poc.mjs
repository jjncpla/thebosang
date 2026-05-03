// Gemini 2.5 POC: PDF native processing without OCR
// Uses Google AI Studio API (@google/genai SDK)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PDFDocument } from "pdf-lib"
import { GoogleGenAI } from "@google/genai"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY 환경변수 또는 .env에 설정되지 않음")
  process.exit(1)
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

// ── prompts (mirror of route.ts) ──
function getPromptForDocType(docType) {
  const base = "[중요] 반드시 JSON만 응답하라. 설명 텍스트, 코드블록, 주석을 절대 포함하지 마라. 첫 글자 { 마지막 글자 }인 순수 JSON만 출력하라.\n\n"
  const noiseGuide = "noiseExposure 필드: 직종명·사업장명·작업내용에 소음 노출이 의심되는 경우(광업·채굴·착암·발파·광산·제철·제강·금속·기계·조선·자동차제조·섬유·목재·건설·용접·철근·콘크리트·토목·포장·운전·지게차·굴삭기·크레인·소음 포함 표기 등) true, 그 외는 false."

  if (docType === "건보")
    return base + `이 문서는 건강보험자격득실확인서이다. 가입자구분이 직장가입자인 항목만 추출하라. 지역가입자, 지역세대원, 지역세대주, 직장피부양자는 반드시 제외하라. 사업장명칭에서 사업장명을 추출하라. 자격취득일이 시작일, 자격상실일이 종료일. 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"건보":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`

  if (docType === "고용산재_전체")
    return base + `[고용보험 자격이력 + 일용근로 통합 추출 — 패턴 기반]\n\n## 자격이력내역서 (sources.고용산재):\n- 컬럼: 직종명(코드) | 사업장 명칭 | 취득일 | 상실일 | 비고\n- 날짜: yyyy-mm-dd 두 개 (취득/상실)\n- 비고: "근로자"\n- 임금/근로일수 컬럼 없음\n\n## 일용근로·노무제공내역서 (dailyEntries):\n- 컬럼: 근로년월 | 사업장명 | 직종명(코드) | 근로일자 | 근로일수 | 임금총액 | 보수총액 | 근로자구분\n- 날짜: yyyy/mm 한 개 (근로년월)\n- "X일", "N원" 패턴\n\n## 절대 규칙:\n1. "yyyy/mm 사업장명 ... X일 N원" 행 → dailyEntries\n2. "yyyy-mm-dd yyyy-mm-dd 근로자" 행 → sources.고용산재\n3. 근로일수/임금 데이터 있으면 무조건 dailyEntries\n4. sources.고용산재가 10건 초과면 일용근로를 잘못 분류한 것 — 다시 검토\n5. dailyEntries[].source는 라벨 "고용산재"만, sources 키와 무관\n\n${noiseGuide}\n\n반드시 이 JSON 형식:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2016,"startMonth":9,"endYear":2016,"endMonth":11,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`

  if (docType === "연금")
    return base + `[국민연금 가입증명/가입내역확인서 — 단계별]\n\n[Step 1] 자격유지기간 표만 추출. 변동사유 표는 무시.\n[Step 2] 가입자종별이 "사업장" 또는 "사업장가입자"인 행만. "지역" 행은 제외.\n[Step 3] 변동사유/처리일자를 별개 항목으로 만들지 말 것. 자격유지기간 단위로만.\n\n반드시 이 JSON:\n{"name":"성명","sources":{"연금":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"건보":[],"소득금액":[]},"dailyEntries":[]}`

  return base + "이 문서에서 직업력 이력을 추출하라."
}

// ── JSON 잘림 복구 ──
function repairTruncatedJson(s) {
  // 마지막 완성된 항목까지 자르고 닫기
  let stack = []
  let inStr = false, esc = false
  let lastCompleteIdx = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (esc) { esc = false; continue }
    if (c === "\\" && inStr) { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === "{" || c === "[") stack.push(c)
    else if (c === "}" || c === "]") {
      stack.pop()
      if (stack.length === 0) lastCompleteIdx = i + 1
    }
  }
  let result = s.slice(0, lastCompleteIdx)
  if (lastCompleteIdx === 0) {
    // 전혀 닫힌 게 없음 - 강제로 닫기 시도
    result = s
    // 마지막 미완성 항목 제거 (마지막 콤마 이후)
    const lastComma = Math.max(result.lastIndexOf(","), 0)
    result = result.slice(0, lastComma)
    while (stack.length > 0) {
      const open = stack.pop()
      result += open === "{" ? "}" : "]"
    }
  }
  return result
}

// ── PDF chunking (Gemini는 1M context라 큰 청크 가능) ──
async function splitPdfIntoChunks(pdfBuffer, pagesPerChunk) {
  const srcDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = srcDoc.getPageCount()
  const chunks = []
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages)
    const chunkDoc = await PDFDocument.create()
    const copied = await chunkDoc.copyPages(srcDoc, Array.from({ length: end - start }, (_, k) => start + k))
    copied.forEach((p) => chunkDoc.addPage(p))
    const bytes = await chunkDoc.save()
    chunks.push({ name: `p${start + 1}-${end}`, base64: Buffer.from(bytes).toString("base64") })
  }
  return chunks
}

// ── Gemini call ──
async function callGemini(modelName, pdfBase64, prompt, maxOutputTokens = 65536) {
  const t0 = Date.now()
  const result = await ai.models.generateContent({
    model: modelName,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: prompt },
      ],
    }],
    config: {
      temperature: 0,
      maxOutputTokens,
    },
  })
  const elapsedMs = Date.now() - t0
  const text = result.text ?? ""
  const usage = result.usageMetadata
  return { text, elapsedMs, usage }
}

// ── Process chunk ──
async function processChunk(chunk, docType, modelName) {
  const prompt = getPromptForDocType(docType)
  const { text, elapsedMs, usage } = await callGemini(modelName, chunk.base64, prompt)
  let sources = { 고용산재: [], 건보: [], 소득금액: [], 연금: [] }
  let dailyEntries = []
  let name = ""
  try {
    // 마크다운 코드블록 제거
    let cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim()
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) throw new Error("JSON not found")
    let jsonStr = m[0]
    // JSON 잘림 복구: 끝이 부분 객체/배열이면 닫기
    try {
      const parsed = JSON.parse(jsonStr)
      sources = parsed.sources ?? sources
      dailyEntries = parsed.dailyEntries ?? []
      name = parsed.name ?? ""
    } catch {
      // 잘림 복구 시도
      const repaired = repairTruncatedJson(jsonStr)
      const parsed = JSON.parse(repaired)
      sources = parsed.sources ?? sources
      dailyEntries = parsed.dailyEntries ?? []
      name = parsed.name ?? ""
    }
  } catch (e) {
    console.error(`  [${chunk.name}] Parse error: ${String(e).slice(0, 100)}, text:`, text.slice(0, 300))
  }
  return { chunkName: chunk.name, elapsedMs, sources, dailyEntries, name, usage }
}

// ── Main analyze ──
async function analyzeFile(pdfPath, docType, opts = {}) {
  const { modelName = "gemini-2.5-flash", chunkPages = 30, concurrency = 6 } = opts
  const startWall = Date.now()
  const pdfBuffer = fs.readFileSync(pdfPath)
  const fileName = path.basename(pdfPath)

  const chunks = await splitPdfIntoChunks(pdfBuffer, chunkPages)
  console.log(`[${fileName}] ${docType} | ${modelName} | ${chunks.length}청크`)

  const results = []
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map((chunk) => processChunk(chunk, docType, modelName)))
    results.push(...batchResults)
  }

  const merged = { name: "", sources: { 고용산재: [], 건보: [], 소득금액: [], 연금: [] }, dailyEntries: [] }
  for (const r of results) {
    if (r.name && !merged.name) merged.name = r.name
    for (const key of ["고용산재", "건보", "소득금액", "연금"]) {
      if (r.sources?.[key]?.length) merged.sources[key] = merged.sources[key].concat(r.sources[key])
    }
    if (r.dailyEntries?.length) merged.dailyEntries = merged.dailyEntries.concat(r.dailyEntries)
  }

  const totalMs = Date.now() - startWall
  return { fileName, docType, modelName, chunksCount: chunks.length, totalMs, merged, results }
}

const TESTS = [
  // 강한곤
  { name: "강한곤 자격득실", path: "C:\\Users\\jjakg\\Downloads\\강한곤 자격득실확인서.pdf", docType: "건보" },
  { name: "강한곤 국민연금", path: "C:\\Users\\jjakg\\Downloads\\강한곤 국민연금공단.pdf", docType: "연금" },
  { name: "강한곤 고용보험", path: "C:\\Users\\jjakg\\Downloads\\강한곤 고용보험.pdf", docType: "고용산재_전체" },
  // 김석광
  { name: "김석광 자격득실", path: "C:\\Users\\jjakg\\Downloads\\김석광 자격득실확인서.pdf", docType: "건보" },
  { name: "김석광 국민연금", path: "C:\\Users\\jjakg\\Downloads\\김석광 국민연금.pdf", docType: "연금" },
  { name: "김석광 고용보험", path: "C:\\Users\\jjakg\\Downloads\\김석광 고용보험.pdf", docType: "고용산재_전체" },
  // 김종식
  { name: "김종식 자격득실", path: "C:\\Users\\jjakg\\Downloads\\김종식 자격득실확인서.pdf", docType: "건보" },
  { name: "김종식 국민연금", path: "C:\\Users\\jjakg\\Downloads\\김종식 국민연금.pdf", docType: "연금" },
  { name: "김종식 고용보험", path: "C:\\Users\\jjakg\\Downloads\\김종식 고용보험.pdf", docType: "고용산재_전체" },
  // 이봉근
  { name: "이봉근 자격득실", path: "C:\\Users\\jjakg\\Downloads\\이봉근 자격득실확인서.pdf", docType: "건보" },
  { name: "이봉근 국민연금", path: "C:\\Users\\jjakg\\Downloads\\이봉근 국민연금.pdf", docType: "연금" },
  { name: "이봉근 고용보험", path: "C:\\Users\\jjakg\\Downloads\\이봉근 고용보험.pdf", docType: "고용산재_전체" },
  { name: "이봉근 경력증명서", path: "C:\\Users\\jjakg\\Downloads\\이봉근 건설근로자공제회 경력증명서.pdf", docType: "경력증명서" },
]

async function main() {
  const runs = Number(process.argv[2] ?? 3)
  const modelName = process.argv[3] ?? "gemini-2.5-flash"
  const chunkPages = Number(process.argv[4] ?? 30)

  console.log(`\n▶ Gemini POC: ${runs}회 반복, model=${modelName}, chunkPages=${chunkPages}\n`)

  for (const t of TESTS) {
    console.log(`=== [${t.name}] (${t.docType}) ===`)
    const times = []
    const results = []
    for (let r = 1; r <= runs; r++) {
      try {
        const res = await analyzeFile(t.path, t.docType, { modelName, chunkPages })
        const counts = {
          고용산재: res.merged.sources.고용산재?.length ?? 0,
          건보: res.merged.sources.건보?.length ?? 0,
          연금: res.merged.sources.연금?.length ?? 0,
          일용직: res.merged.dailyEntries?.length ?? 0,
        }
        const ok = t.expected ? Object.entries(t.expected).every(([k, v]) => counts[k] === v) : null
        const okMark = ok === null ? "" : (ok ? " | ✓" : " | ✗")
        console.log(`  Run ${r}: ${(res.totalMs / 1000).toFixed(1)}s | ${JSON.stringify(counts)}${okMark}`)
        times.push(res.totalMs)
        results.push(JSON.stringify(counts))
      } catch (err) {
        console.error(`  Run ${r}: ERROR`, String(err).slice(0, 250))
      }
    }
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length / 1000
      const min = Math.min(...times) / 1000
      const max = Math.max(...times) / 1000
      const consistent = new Set(results).size === 1
      console.log(`  ▶ 평균 ${avg.toFixed(1)}s (${min.toFixed(1)}-${max.toFixed(1)}s) | 일관성 ${consistent ? "✓" : "✗"}\n`)
    }
  }
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1) })
