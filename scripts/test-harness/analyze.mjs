// Standalone work-history analysis test harness.
// Replicates production pipeline: Document AI OCR → Haiku parse → JSON.
// Usage:
//   node scripts/test-harness/analyze.mjs <pdf-path> <docType> [--chunk-pages=5]
// docType: 고용산재_전체 | 건보 | 연금 | 일용직 | 고용산재_상용

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PDFDocument } from "pdf-lib"
import { DocumentProcessorServiceClient } from "@google-cloud/documentai"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── env load (search worktree first, fallback to main repo) ──────
function findFirst(paths) {
  for (const p of paths) if (fs.existsSync(p)) return p
  return null
}
const envPath = findFirst([
  path.resolve(__dirname, "../../.env"),
  "C:\\Users\\jjakg\\thebosang\\.env",
])
if (!envPath) {
  console.error(".env not found")
  process.exit(1)
}
const envContent = fs.readFileSync(envPath, "utf-8")
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=")
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
const GOOGLE_DOCAI_PROCESSOR =
  env.GOOGLE_DOCAI_PROCESSOR ||
  "projects/708185796658/locations/us/processors/bf9e989935948e63"

if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not found in .env")
  process.exit(1)
}

// ── Document AI client ─────────────────────────────────────────────
const credPath = findFirst([
  path.resolve(__dirname, "../../tbss-494605-7be880b365d7.json"),
  "C:\\Users\\jjakg\\thebosang\\tbss-494605-7be880b365d7.json",
])
if (!credPath) {
  console.error("Service account JSON not found")
  process.exit(1)
}
const credentials = JSON.parse(fs.readFileSync(credPath, "utf-8"))
const docAIClient = new DocumentProcessorServiceClient({ credentials })

async function ocrPdf(pdfBase64) {
  const [result] = await docAIClient.processDocument({
    name: GOOGLE_DOCAI_PROCESSOR,
    rawDocument: { content: pdfBase64, mimeType: "application/pdf" },
  })
  return result.document?.text ?? ""
}

const GOOGLE_DOCAI_FORM_PROCESSOR = env.GOOGLE_DOCAI_FORM_PROCESSOR

async function ocrPdfWithFormParser(pdfBase64) {
  if (!GOOGLE_DOCAI_FORM_PROCESSOR) return ocrPdf(pdfBase64)
  const [result] = await docAIClient.processDocument({
    name: GOOGLE_DOCAI_FORM_PROCESSOR,
    rawDocument: { content: pdfBase64, mimeType: "application/pdf" },
  })
  const doc = result.document
  if (!doc) return ""
  const baseText = doc.text ?? ""
  const tableTexts = []
  for (const page of doc.pages ?? []) {
    for (const table of page.tables ?? []) {
      const headerRows = (table.headerRows ?? []).map((row) =>
        (row.cells ?? []).map((cell) => extractCellText(cell, baseText))
      )
      const bodyRows = (table.bodyRows ?? []).map((row) =>
        (row.cells ?? []).map((cell) => extractCellText(cell, baseText))
      )
      if (headerRows.length === 0 && bodyRows.length === 0) continue
      tableTexts.push("\n=== TABLE ===")
      for (const row of headerRows) tableTexts.push("| " + row.join(" | ") + " |")
      if (headerRows.length > 0 && bodyRows.length > 0) {
        tableTexts.push("|" + headerRows[0].map(() => "---").join("|") + "|")
      }
      for (const row of bodyRows) tableTexts.push("| " + row.join(" | ") + " |")
      tableTexts.push("=== END TABLE ===\n")
    }
  }
  return baseText + "\n\n" + tableTexts.join("\n")
}

function extractCellText(cell, baseText) {
  const segments = cell?.layout?.textAnchor?.textSegments ?? []
  const parts = []
  for (const seg of segments) {
    const start = Number(seg.startIndex ?? 0)
    const end = Number(seg.endIndex ?? 0)
    parts.push(baseText.slice(start, end))
  }
  return parts.join("").replace(/\s+/g, " ").trim()
}

async function performOcr(pdfBase64, docType) {
  const useFormParser = ["건보", "연금", "고용산재_상용", "경력증명서"].includes(docType)
  return useFormParser ? ocrPdfWithFormParser(pdfBase64) : ocrPdf(pdfBase64)
}

// ── Claude call ────────────────────────────────────────────────────
async function callClaude(body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 10000 * attempt))
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })
    if (res.status === 429) continue
    return res
  }
  throw new Error("rate limit retries exhausted")
}

// ── Prompts (mirror of route.ts) ───────────────────────────────────
function getPromptForDocType(docType) {
  const base =
    "[CRITICAL OUTPUT RULES]\n1. 응답은 반드시 순수 JSON 객체 하나로만 구성한다.\n2. 절대로 ```json, ``` 같은 마크다운 코드 블록을 사용하지 마라.\n3. JSON 앞뒤로 설명 텍스트, 주석을 절대 추가하지 마라.\n4. 첫 글자는 { 마지막 글자는 } 이어야 한다.\n5. 출력이 길어질 것 같으면 dailyEntries 항목들의 memo 필드를 빈 문자열로 두어 토큰을 절약하라.\n\n"
  const noiseGuide =
    "noiseExposure 필드: 직종명·사업장명·작업내용에 소음 노출이 의심되는 경우(광업·채굴·착암·발파·광산·제철·제강·금속·기계·조선·자동차제조·섬유·목재·건설·용접·철근·콘크리트·토목·포장·운전·지게차·굴삭기·크레인·소음 포함 표기 등) true, 그 외는 false."

  if (docType === "건보")
    return (
      base +
      `[건강보험자격득실확인서 추출 규칙]\n\n표의 모든 행(No 1~끝)을 순서대로 스캔하고, 가입자구분이 정확히 "직장가입자"인 항목만 sources.건보에 추출하라.\n\n[제외 대상 - 절대 추출 금지]\n- 직장피부양자 (본인 가입자 아님)\n- 지역세대주\n- 지역세대원\n- 지역가입자\n\n[추출 규칙]\n- 단 한 행도 누락 금지. 가입자구분이 "직장가입자"이면 무조건 추출.\n- 사업장명칭에 "(일용)" 또는 "/일용/" 표기가 있어도 직장가입자이면 추출.\n- 사업장명이 OCR에서 잘렸거나 누락된 경우 company는 OCR에서 보이는 만큼만 적되 빈 문자열은 피한다.\n- 자격취득일 → startYear/startMonth, 자격상실일 → endYear/endMonth (yyyy.mm.dd 형식). 상실일 없으면 2026-01.\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"건보":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
    )
  if (docType === "고용산재_전체")
    return (
      base +
      `[고용보험 자격이력 + 일용근로 통합 추출 — 패턴 기반 분류]\n\n## 핵심: 두 표를 행 패턴으로 구분\n\n### 자격이력내역서 행 (sources.고용산재로):\n- 컬럼: 직종명(코드) | 사업장 명칭 | 취득일 | 상실일 | 비고\n- 날짜 형식: yyyy-mm-dd 두 개 (취득일, 상실일)\n- 비고 컬럼: "근로자"\n- 임금/근로일수 컬럼 없음\n- 예: "1 식당 서비스 관련 종사자(132) 미소식당 2016-09-08 2016-11-11 근로자"\n\n### 일용근로·노무제공내역서 행 (dailyEntries로):\n- 컬럼: 근로년월 | 사업장명 | 직종명(코드) | 근로일자 | 근로일수 | 임금총액 | 보수총액 | 근로자구분\n- 날짜 형식: yyyy/mm 한 개 (근로년월)\n- "X일" 형태 근로일수 (예: "27일", "2일")\n- "N원" 형태 임금/보수\n- 예: "1 2018/02 푸드앤디자인협동조 제조관련 단순 종사자(229) 5,6,7,8 4일 90,000원 90,000원 근로자"\n\n## 절대 규칙\n1. "yyyy/mm 사업장명 ... X일 N원" 패턴 → **반드시 dailyEntries**, 절대 sources.고용산재 아님\n2. "yyyy-mm-dd yyyy-mm-dd 근로자" 패턴 → **반드시 sources.고용산재**\n3. "근로일수", "임금총액" 컬럼 데이터 있는 행은 무조건 dailyEntries\n4. 자격이력 표는 짧음 (3-10행). dailyEntries는 길음 (수십~수백행)\n5. sources.고용산재가 10건을 초과하면 일용근로를 잘못 분류한 것이다 — 다시 검토하라\n\n## 추출 필드\n자격이력 sources.고용산재:\n- jobType, company, startYear/startMonth (취득), endYear/endMonth (상실, 없으면 2026-01)\n\n일용근로 dailyEntries:\n- company ([업체명] 표기 시 []안 이름)\n- jobType (직종명+코드)\n- totalDays (X일에서 X)\n- startYear/startMonth (yyyy/mm)\n- convertedMonths = Math.ceil(totalDays/20)\n- source: "고용산재"\n- memo: 빈 문자열\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2016,"startMonth":9,"endYear":2016,"endMonth":11,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
    )
  if (docType === "고용산재_상용")
    return (
      base +
      `이 문서는 고용보험 자격이력내역서이다. 비고/구분이 "근로자"인 항목을 모두 추출하라. 직종명(코드), 사업장명, 취득일(시작), 상실일(종료). 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
    )
  if (docType === "일용직")
    return (
      base +
      `이 문서는 고용보험 일용근로·노무제공내역서이다.\n\n## 절대 규칙 (매우 중요)\n1. 모든 행을 dailyEntries 배열에만 추출하라.\n2. **sources.고용산재, sources.건보, sources.소득금액, sources.연금 모두 반드시 빈 배열 [] 이다.** 절대로 이 4개 sources 배열에 데이터를 넣지 마라.\n3. 일용근로 행은 자격이력이 아니다. dailyEntries로만 분류한다.\n4. dailyEntries 항목의 "source" 필드는 단순한 문자열 라벨일 뿐이다 (sources 배열 키와 무관).\n\n## 추출 규칙\n- 모든 행을 그대로 추출. 합산 금지.\n- 사업장명에 [업체명] 표기 시 []안 이름을 company로 사용.\n- totalDays = 근로일수 컬럼 (예: "27일" → 27)\n- startYear/startMonth = 근로년월 (예: "2018/02" → 2018, 2)\n- convertedMonths = Math.ceil(totalDays / 20)\n- jobType = 직종명(코드 포함)\n- source = "고용산재" (단순 라벨, 변경하지 말 것)\n- memo = 빈 문자열 (토큰 절약)\n\n반드시 이 JSON 형식으로만 응답하라 (sources의 모든 키는 빈 배열):\n{"name":"성명","sources":{"고용산재":[],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
    )
  if (docType === "연금")
    return (
      base +
      `[국민연금 가입증명/가입내역확인서 추출 — 단계별 추론]\n\n다음 순서로 사고하여 정확한 결과를 도출하라:\n\n[Step 1] OCR 텍스트에서 "가입이력" 또는 "자격유지기간" 표를 식별한다.\n  - 이 표만 추출 대상이다. (변동사유 표나 변경 내역 표는 무시)\n  - 자격유지기간이 명시된 행을 모두 나열한다 (예: "2002.11.01 ~ 2008.01.06")\n\n[Step 2] 각 자격유지기간의 가입자종별을 확인한다.\n  - 가입자종별 컬럼이 "사업장" 또는 "사업장가입자"이면 → 추출 대상\n  - 가입자종별 컬럼이 "지역" 또는 "지역가입자"이면 → 절대 제외\n  - 임의가입자, 임의계속가입자도 제외\n\n[Step 3] 가입자종별 매칭 시 사업장명도 체크한다.\n  - 사업장가입자면 사업장명이 함께 표시됨 (예: "경주캐터링서비스")\n  - 지역가입자면 사업장명 자리에 "지역" 또는 빈칸\n\n[Step 4] 변동사유/처리일자 표(상실/취득 메타데이터)는 절대로 별개 항목으로 만들지 않는다.\n  - 예: "상실 2008-01-07"은 위 자격유지기간 종료일의 처리 정보일 뿐이다.\n  - 예: "사업장 2002-11-01 2002-11-14"는 자격취득일 처리 정보일 뿐이다.\n\n[Step 5] 추출 결과 검증\n  - sources.연금의 모든 항목은 [Step 1]에서 식별한 자격유지기간 중 하나여야 한다.\n  - 가입자종별이 "지역"인 행을 추출하지 않았는지 마지막으로 확인하라.\n\n[추출 필드]\n- company: 사업장명 (변경 이력 있으면 최신 명칭)\n- startYear/startMonth: 자격취득일\n- endYear/endMonth: 자격상실일 (없으면 2026-01)\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"연금":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"건보":[],"소득금액":[]},"dailyEntries":[]}`
    )
  return (
    base +
    "이 문서에서 직업력 이력을 추출하라.\n반드시 이 JSON 형식으로만 응답하라:\n{\"name\":\"성명\",\"sources\":{\"고용산재\":[],\"건보\":[],\"소득금액\":[],\"연금\":[]},\"dailyEntries\":[]}"
  )
}

// ── Robust JSON parser ─────────────────────────────────────────────
// Handles: markdown code blocks, truncated JSON, leading/trailing noise
function robustParseJson(rawText) {
  if (!rawText) return null
  let txt = rawText.trim()
  // Strip markdown code fences
  txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")
  txt = txt.trim()

  // Try direct parse first
  try {
    return JSON.parse(txt)
  } catch {}

  // Find first { ... last }
  const first = txt.indexOf("{")
  if (first === -1) return null
  let candidate = txt.slice(first)
  // Remove trailing ``` if present
  candidate = candidate.replace(/```\s*$/i, "").trim()

  try {
    return JSON.parse(candidate)
  } catch {}

  // Truncated JSON repair: try to close open braces/brackets
  return repairTruncatedJson(candidate)
}

function repairTruncatedJson(s) {
  // Strategy: walk through string, track open braces/brackets, strip trailing
  // partial fields, then close.
  let inStr = false
  let escape = false
  let lastValidEnd = 0 // Last position where the JSON was structurally consistent
  const stack = []
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) { escape = false; continue }
    if (c === "\\" && inStr) { escape = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === "{" || c === "[") stack.push(c)
    else if (c === "}") {
      if (stack[stack.length - 1] === "{") stack.pop()
      lastValidEnd = i + 1
    } else if (c === "]") {
      if (stack[stack.length - 1] === "[") stack.pop()
      lastValidEnd = i + 1
    } else if (c === "," && stack.length > 0) {
      // Comma at top of array means last full object completed
      lastValidEnd = i
    }
  }

  // Try multiple repair attempts
  for (let cutoff = s.length; cutoff > 0; cutoff--) {
    let candidate = s.slice(0, cutoff).replace(/,\s*$/, "")
    // Find any unclosed string and trim there
    let str = false, esc = false
    for (let i = 0; i < candidate.length; i++) {
      if (esc) { esc = false; continue }
      if (candidate[i] === "\\" && str) { esc = true; continue }
      if (candidate[i] === '"') str = !str
    }
    if (str) continue // Skip if mid-string
    // Close brackets
    const localStack = []
    let s2 = false, e2 = false
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i]
      if (e2) { e2 = false; continue }
      if (c === "\\" && s2) { e2 = true; continue }
      if (c === '"') { s2 = !s2; continue }
      if (s2) continue
      if (c === "{" || c === "[") localStack.push(c)
      else if (c === "}" && localStack[localStack.length - 1] === "{") localStack.pop()
      else if (c === "]" && localStack[localStack.length - 1] === "[") localStack.pop()
    }
    while (localStack.length > 0) {
      candidate += localStack.pop() === "{" ? "}" : "]"
    }
    candidate = candidate.replace(/,(\s*[}\]])/g, "$1")
    try {
      return JSON.parse(candidate)
    } catch {}
    if (s.length - cutoff > 500) break // Don't trim too far
  }

  // Final fallback: cut at lastValidEnd (last completed object/array)
  if (lastValidEnd > 0) {
    let candidate = s.slice(0, lastValidEnd)
    // Close remaining stack
    const localStack = []
    let s3 = false, e3 = false
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i]
      if (e3) { e3 = false; continue }
      if (c === "\\" && s3) { e3 = true; continue }
      if (c === '"') { s3 = !s3; continue }
      if (s3) continue
      if (c === "{" || c === "[") localStack.push(c)
      else if (c === "}" && localStack[localStack.length - 1] === "{") localStack.pop()
      else if (c === "]" && localStack[localStack.length - 1] === "[") localStack.pop()
    }
    while (localStack.length > 0) {
      candidate += localStack.pop() === "{" ? "}" : "]"
    }
    candidate = candidate.replace(/,(\s*[}\]])/g, "$1")
    try {
      return JSON.parse(candidate)
    } catch {}
  }
  return null
}

// ── PDF chunking ───────────────────────────────────────────────────
async function splitPdfIntoChunks(pdfBuffer, pagesPerChunk) {
  const srcDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = srcDoc.getPageCount()
  const chunks = []
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages)
    const chunkDoc = await PDFDocument.create()
    const copied = await chunkDoc.copyPages(
      srcDoc,
      Array.from({ length: end - start }, (_, k) => start + k)
    )
    copied.forEach((p) => chunkDoc.addPage(p))
    const bytes = await chunkDoc.save()
    chunks.push({
      name: `p${start + 1}-${end}`,
      base64: Buffer.from(bytes).toString("base64"),
    })
  }
  return chunks
}

// ── Process single chunk ───────────────────────────────────────────
async function processChunk(chunk, docType, chunkIndex = 0) {
  const t0 = Date.now()
  const text = await performOcr(chunk.base64, docType)
  const ocrMs = Date.now() - t0

  if (!text || text.length < 10) {
    return {
      chunkName: chunk.name,
      ocrMs,
      haikuMs: 0,
      sources: { 고용산재: [], 건보: [], 소득금액: [], 연금: [] },
      dailyEntries: [],
      name: "",
      ocrTextLen: text.length,
    }
  }

  // 청크 분기 정책: 첫 청크가 아니고 자격이력 헤더 없으면 일용직 prompt
  let effectiveDocType = docType
  if (docType === "고용산재_전체") {
    const hasJaagyeokHeader = /자격이력내역서/.test(text)
    if (chunkIndex > 0 && !hasJaagyeokHeader) {
      effectiveDocType = "일용직"
    }
    console.log(`  [${chunk.name}] chunkIdx=${chunkIndex} hasHeader=${hasJaagyeokHeader} → ${effectiveDocType}`)
  }

  const t1 = Date.now()
  const fullPrompt = `${getPromptForDocType(effectiveDocType)}\n\n--- 문서 텍스트 ---\n${text}`
  const claudeRes = await callClaude({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    temperature: 0,
    messages: [{ role: "user", content: fullPrompt }],
  })
  const haikuMs = Date.now() - t1

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    throw new Error(`Claude API error: ${errText}`)
  }

  const data = await claudeRes.json()
  const rawText = data.content?.[0]?.text ?? ""

  let sources = { 고용산재: [], 건보: [], 소득금액: [], 연금: [] }
  let dailyEntries = []
  let name = ""

  const parsed = robustParseJson(rawText)
  if (parsed) {
    sources = parsed.sources ?? sources
    dailyEntries = parsed.dailyEntries ?? []
    name = parsed.name ?? ""
  } else {
    console.error(`  [${chunk.name}] JSON parse error (text len ${rawText.length}):`, rawText.slice(-200))
  }

    console.log(`  [RESULT ${chunk.name}] effective=${effectiveDocType} 고용:${sources.고용산재?.length ?? 0} 일용:${dailyEntries.length}`)
  return {
    chunkName: chunk.name,
    ocrMs,
    haikuMs,
    sources,
    dailyEntries,
    name,
    ocrTextLen: text.length,
  }
}

// ── Main analysis ──────────────────────────────────────────────────
export async function analyzeFile(pdfPath, docType, opts = {}) {
  const { chunkPages = 5, verbose = true } = opts
  const startWall = Date.now()
  const pdfBuffer = fs.readFileSync(pdfPath)
  const fileName = path.basename(pdfPath)

  if (verbose) console.log(`\n[${fileName}] ${docType} 분석 시작...`)

  const chunks = await splitPdfIntoChunks(pdfBuffer, chunkPages)
  if (verbose) console.log(`  청크 ${chunks.length}개 생성`)

  // Concurrent processing with cap (chunkIndex 전달)
  const CONCURRENCY = opts.concurrency ?? 5
  const results = []
  let chunkIdx = 0
  const indexedChunks = chunks.map((c) => ({ ...c, chunkIndex: chunkIdx++ }))
  for (let i = 0; i < indexedChunks.length; i += CONCURRENCY) {
    const batch = indexedChunks.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((chunk) => processChunk(chunk, docType, chunk.chunkIndex))
    )
    results.push(...batchResults)
  }

  // Aggregate
  const merged = {
    name: "",
    sources: { 고용산재: [], 건보: [], 소득금액: [], 연금: [] },
    dailyEntries: [],
  }
  for (const r of results) {
    if (r.name && !merged.name) merged.name = r.name
    for (const key of ["고용산재", "건보", "소득금액", "연금"]) {
      if (r.sources?.[key]?.length) {
        merged.sources[key] = merged.sources[key].concat(r.sources[key])
      }
    }
    if (r.dailyEntries?.length) {
      merged.dailyEntries = merged.dailyEntries.concat(r.dailyEntries)
    }
  }

  const totalMs = Date.now() - startWall

  return {
    fileName,
    docType,
    chunksCount: chunks.length,
    chunkDetails: results,
    totalMs,
    merged,
  }
}

// ── CLI entry ──────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [pdfPath, docType, ...rest] = process.argv.slice(2)
  if (!pdfPath || !docType) {
    console.error("Usage: node analyze.mjs <pdf-path> <docType>")
    process.exit(1)
  }
  const chunkPagesArg = rest.find((a) => a.startsWith("--chunk-pages="))
  const chunkPages = chunkPagesArg ? Number(chunkPagesArg.split("=")[1]) : 5
  const concArg = rest.find((a) => a.startsWith("--concurrency="))
  const concurrency = concArg ? Number(concArg.split("=")[1]) : 5

  analyzeFile(pdfPath, docType, { chunkPages, concurrency })
    .then((res) => {
      console.log("\n=== 결과 ===")
      console.log(`파일: ${res.fileName}`)
      console.log(`총 시간: ${(res.totalMs / 1000).toFixed(2)}초`)
      console.log(`성명: ${res.merged.name}`)
      console.log(
        `고용산재: ${res.merged.sources.고용산재.length}건, 건보: ${res.merged.sources.건보.length}건, 연금: ${res.merged.sources.연금.length}건, 일용직: ${res.merged.dailyEntries.length}건`
      )
      console.log("\n청크 타이밍:")
      res.chunkDetails.forEach((c) => {
        console.log(
          `  ${c.chunkName}: OCR ${c.ocrMs}ms + Haiku ${c.haikuMs}ms (텍스트 ${c.ocrTextLen}자)`
        )
      })
    })
    .catch((err) => {
      console.error("ERROR:", err)
      process.exit(1)
    })
}
