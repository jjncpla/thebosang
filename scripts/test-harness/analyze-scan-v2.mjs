// v2: rate limit 안전, 더 자세한 추출, 정확한 비교
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PDFDocument } from "pdf-lib"
import { GoogleGenAI } from "@google/genai"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// .env에서 키 로드
const envPath = "C:\\Users\\jjakg\\thebosang\\.env"
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : ""
const env = Object.fromEntries(
  envContent.split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY
if (!GEMINI_API_KEY) { console.error("GEMINI_API_KEY missing"); process.exit(1) }
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

async function callGemini(pdfBase64, prompt, maxRetries = 4) {
  let lastError = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const wait = 8000 * Math.pow(2, attempt - 1)
      console.log(`  retry ${attempt} after ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          { text: prompt }
        ]}],
        config: { temperature: 0, maxOutputTokens: 65536 },
      })
      return result.text ?? ""
    } catch (e) {
      lastError = e
      const msg = String(e)
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) continue
      throw e
    }
  }
  throw lastError
}

async function splitPdf(buf, pagesPerChunk) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true })
  const total = src.getPageCount()
  const chunks = []
  for (let s = 0; s < total; s += pagesPerChunk) {
    const e = Math.min(s + pagesPerChunk, total)
    const dst = await PDFDocument.create()
    const pages = await dst.copyPages(src, Array.from({ length: e - s }, (_, k) => s + k))
    pages.forEach(p => dst.addPage(p))
    const bytes = await dst.save()
    chunks.push({ name: `p${s + 1}-${e}`, base64: Buffer.from(bytes).toString("base64") })
  }
  return chunks
}

function parseJsonRobust(text) {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "")
  cleaned = cleaned.replace(/\n?```\s*$/, "")
  cleaned = cleaned.trim()
  const start = cleaned.indexOf("{")
  if (start < 0) throw new Error("no JSON")
  cleaned = cleaned.slice(start)
  try {
    return JSON.parse(cleaned)
  } catch {
    // 잘림 복구
    const stack = []
    let lastComplete = 0, inStr = false, esc = false
    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i]
      if (esc) { esc = false; continue }
      if (c === "\\" && inStr) { esc = true; continue }
      if (c === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (c === "{" || c === "[") stack.push(c)
      else if (c === "}" || c === "]") { stack.pop(); if (stack.length === 0) lastComplete = i + 1 }
    }
    return JSON.parse(cleaned.slice(0, lastComplete))
  }
}

// 1단계: 사람 작성 직업력 산정표 검색 (sequential, rate limit 안전)
async function findHumanWorkHistory(buf) {
  const chunks = await splitPdf(buf, 8) // 8p 청크
  console.log(`  ${chunks.length} 청크`)

  const results = []
  for (const c of chunks) {
    const prompt = `이 PDF 페이지들 안에 사람(노무사/직원)이 작성한 "직업력 산정표"가 있는지 확인하라.

직업력 산정표는 다음 특징을 가진다:
- 4대보험 원본이 아닌, 사람이 정리한 표
- 사업장명, 작업기간, 직종 등이 정리된 행 단위 표
- 또는 "직업력 조사 표준문답서", "직업력 산정 내역" 등의 제목

찾으면 모든 행을 추출 (단 한 행도 누락 금지):
{
  "found": true,
  "regular_employment": [
    {"company": "사업장명", "start": "yyyy-mm", "end": "yyyy-mm", "jobType": "직종"}
  ],
  "daily_employment": [
    {"company": "사업장명", "totalDays": 10, "period": "yyyy-mm"}
  ],
  "summary_text": "총 근무기간 등 요약문이 있다면"
}

없으면: {"found": false}

JSON만 출력.`
    try {
      const text = await callGemini(c.base64, prompt)
      const parsed = parseJsonRobust(text)
      results.push({ chunk: c.name, parsed })
      if (parsed.found) {
        console.log(`  [${c.name}] ✓ 발견 — 상용 ${parsed.regular_employment?.length ?? 0}건, 일용 ${parsed.daily_employment?.length ?? 0}건`)
      }
    } catch (e) {
      console.error(`  [${c.name}] error: ${String(e).slice(0, 80)}`)
      results.push({ chunk: c.name, parsed: null, error: String(e).slice(0, 100) })
    }
  }
  return results
}

// 2단계: 4대보험 자료 sequential 추출
async function extractInsurance(buf) {
  const chunks = await splitPdf(buf, 5)
  console.log(`  ${chunks.length} 청크`)

  const merged = { sources: { 고용산재: [], 건보: [], 연금: [] }, dailyEntries: [] }
  for (const c of chunks) {
    const prompt = `이 페이지들에 4대보험 자료(고용보험 자격이력내역서, 일용근로내역서, 건강보험 자격득실확인서, 국민연금 가입증명서)가 있으면 추출하라.

자격이력내역서 (yyyy-mm-dd ~ yyyy-mm-dd 행) → sources.고용산재
일용근로내역서 (yyyy/mm + X일 + N원 행) → dailyEntries
건강보험 (직장가입자만) → sources.건보
국민연금 (사업장가입자만) → sources.연금

다른 페이지(직업력 산정표, 의무기록, 위임장 등)는 무시.

JSON만 출력 (없으면 빈 배열):
{"sources":{"고용산재":[{"company":"","startYear":0,"startMonth":0,"endYear":0,"endMonth":0,"jobType":""}],"건보":[],"연금":[]},"dailyEntries":[{"company":"","jobType":"","totalDays":0,"startYear":0,"startMonth":0}]}`
    try {
      const text = await callGemini(c.base64, prompt)
      const parsed = parseJsonRobust(text)
      for (const key of ["고용산재", "건보", "연금"]) {
        if (parsed.sources?.[key]?.length) merged.sources[key] = merged.sources[key].concat(parsed.sources[key])
      }
      if (parsed.dailyEntries?.length) merged.dailyEntries = merged.dailyEntries.concat(parsed.dailyEntries)
      console.log(`  [${c.name}] 고용:${parsed.sources?.고용산재?.length ?? 0} 건보:${parsed.sources?.건보?.length ?? 0} 연금:${parsed.sources?.연금?.length ?? 0} 일용:${parsed.dailyEntries?.length ?? 0}`)
    } catch (e) {
      console.error(`  [${c.name}] error: ${String(e).slice(0, 80)}`)
    }
  }
  return merged
}

async function main() {
  const TESTS = [
    "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\경인TF 우용욱 난청 접수 스캔본.pdf",
    "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\서울동부TF) 정신행 난청 스캔본.pdf",
  ]

  for (const pdfPath of TESTS) {
    const fileName = path.basename(pdfPath)
    console.log(`\n========== ${fileName} ==========`)
    const buf = fs.readFileSync(pdfPath)
    const totalPages = (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount()
    console.log(`페이지: ${totalPages}, 크기: ${Math.round(buf.length / 1024)}KB\n`)

    console.log(`[1] 사람 작성 산정표 검색...`)
    const t0 = Date.now()
    const human = await findHumanWorkHistory(buf)
    console.log(`(${Math.round((Date.now() - t0) / 1000)}s)`)
    const found = human.filter(r => r.parsed?.found)

    console.log(`\n[2] 4대보험 자료 추출...`)
    const t1 = Date.now()
    const sys = await extractInsurance(buf)
    console.log(`(${Math.round((Date.now() - t1) / 1000)}s)`)

    console.log(`\n[3] 비교:`)
    if (found.length === 0) {
      console.log(`  사람 산정표 없음`)
    } else {
      // 모든 found 청크의 데이터 통합
      const humanRegular = found.flatMap(f => f.parsed.regular_employment ?? [])
      const humanDaily = found.flatMap(f => f.parsed.daily_employment ?? [])
      const humanSummary = found.map(f => f.parsed.summary_text).filter(Boolean).join(" / ")
      console.log(`  사람: 상용 ${humanRegular.length}건 + 일용 ${humanDaily.length}건`)
      if (humanSummary) console.log(`  요약: ${humanSummary.slice(0, 200)}`)
      console.log(`  시스템: 상용 ${sys.sources.고용산재.length}건 + 일용 ${sys.dailyEntries.length}건 (건보 ${sys.sources.건보.length} + 연금 ${sys.sources.연금.length})`)

      // 사람의 상용 사업장과 시스템 추출의 사업장 비교
      if (humanRegular.length > 0 && sys.sources.고용산재.length > 0) {
        const humanCompanies = new Set(humanRegular.map(r => r.company?.replace(/\s+/g, "")))
        const sysCompanies = new Set(sys.sources.고용산재.map(r => r.company?.replace(/\s+/g, "")))
        const matched = [...humanCompanies].filter(c => [...sysCompanies].some(s => s.includes(c) || c.includes(s)))
        console.log(`  사업장 매칭: ${matched.length}/${humanCompanies.size} (${Math.round(matched.length / humanCompanies.size * 100)}%)`)
      }
    }
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1) })
