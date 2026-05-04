// 소음노출 산정 비교: 직업력 조사 표준문답서 vs 우리 시스템
// 1. 스캔본에서 "직업력 조사 표준문답서"의 소음노출 산정표 추출 (사람 ground truth)
// 2. 4대보험 자료에서 시스템 방식 추출 + 사업장 단위 합산
// 3. 사업장명 매칭 + 기간 비교 + 소음노출 판정 비교

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PDFDocument } from "pdf-lib"
import { GoogleGenAI } from "@google/genai"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
    if (attempt > 0) await new Promise(r => setTimeout(r, 8000 * Math.pow(2, attempt - 1)))
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
  let cleaned = text.trim().replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim()
  const start = cleaned.indexOf("{")
  if (start < 0) throw new Error("no JSON")
  cleaned = cleaned.slice(start)
  try { return JSON.parse(cleaned) } catch {}
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

// 1단계: 직업력 조사 표준문답서의 소음노출 산정표 추출
async function findNoiseHistoryTable(buf) {
  const chunks = await splitPdf(buf, 6)
  console.log(`  [Step 1] ${chunks.length}청크에서 표준문답서 검색...`)

  const allEntries = []
  for (const c of chunks) {
    const prompt = `이 PDF 페이지들 안에 "직업력 조사 표준문답서" 또는 사람이 작성한 "소음노출력 산정표"가 있는지 확인하라.

이 표는 보통 다음 컬럼을 가진다:
- 번호 / 사업장명 / 직종 / 작업기간(시작-종료) / 작업내용 / 소음노출(O/X 또는 dB)
- 또는 노무사가 정리한 "직업력 산정 표"

발견 시 모든 행을 추출 (단 한 행도 누락 금지):
{
  "found": true,
  "page_range": "p3-p4",
  "entries": [
    {
      "no": 1,
      "company": "사업장명",
      "department": "부서/현장",
      "jobType": "직종",
      "start": "yyyy-mm",
      "end": "yyyy-mm",
      "workContent": "작업내용",
      "noiseExposure": true,
      "noiseLevel": "85dB 또는 빈문자열",
      "totalDays": 0
    }
  ]
}

없으면: {"found": false}

JSON만 출력.`
    try {
      const text = await callGemini(c.base64, prompt)
      const parsed = parseJsonRobust(text)
      if (parsed.found && parsed.entries?.length) {
        console.log(`    [${c.name}] ✓ ${parsed.entries.length}건 발견`)
        allEntries.push(...parsed.entries.map(e => ({ ...e, _chunk: c.name })))
      }
    } catch (e) {
      console.error(`    [${c.name}] error: ${String(e).slice(0, 80)}`)
    }
  }
  return allEntries
}

// 2단계: 4대보험 자료에서 raw 추출
async function extractInsurance(buf) {
  const chunks = await splitPdf(buf, 5)
  console.log(`  [Step 2] ${chunks.length}청크에서 4대보험 추출...`)

  const merged = { 고용산재: [], 건보: [], 연금: [], dailyEntries: [] }
  for (const c of chunks) {
    const prompt = `이 페이지에 4대보험 자료가 있으면 추출.

자격이력내역서 (고용보험 상용직, "근로자" 표기): sources.고용산재
일용근로내역서: dailyEntries
건강보험 직장가입자: sources.건보
국민연금 사업장가입자: sources.연금

다른 페이지(직업력 산정표, 의무기록)는 무시.

JSON만:
{"sources":{"고용산재":[{"company":"","jobType":"","startYear":0,"startMonth":0,"endYear":0,"endMonth":0,"noiseExposure":false}],"건보":[{"company":"","startYear":0,"startMonth":0,"endYear":0,"endMonth":0}],"연금":[{"company":"","startYear":0,"startMonth":0,"endYear":0,"endMonth":0}]},"dailyEntries":[{"company":"","jobType":"","totalDays":0,"startYear":0,"startMonth":0}]}`
    try {
      const text = await callGemini(c.base64, prompt)
      const p = parseJsonRobust(text)
      if (p.sources?.고용산재?.length) merged.고용산재 = merged.고용산재.concat(p.sources.고용산재)
      if (p.sources?.건보?.length) merged.건보 = merged.건보.concat(p.sources.건보)
      if (p.sources?.연금?.length) merged.연금 = merged.연금.concat(p.sources.연금)
      if (p.dailyEntries?.length) merged.dailyEntries = merged.dailyEntries.concat(p.dailyEntries)
    } catch (e) {
      // skip
    }
  }
  return merged
}

// 3단계: 사업장 단위 통합 (mergeWorkHistory 로직 simplified)
function normalizeCompany(name) {
  if (!name) return ""
  return name.trim()
    .replace(/^\(주\)\s*|\s*\(주\)$/g, "")
    .replace(/^주식회사\s*|\s*주식회사$/g, "")
    .replace(/^\(유\)\s*|\s*\(유\)$/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
}

function mergeBySite(rawData) {
  const all = []
  for (const e of rawData.고용산재 ?? []) all.push({ ...e, source: "고용산재" })
  for (const e of rawData.건보 ?? []) all.push({ ...e, source: "건보" })
  for (const e of rawData.연금 ?? []) all.push({ ...e, source: "연금" })

  // 사업장 단위 통합
  const byCompany = {}
  for (const e of all) {
    const key = normalizeCompany(e.company)
    if (!key) continue
    if (!byCompany[key]) {
      byCompany[key] = {
        company: e.company,
        startYear: e.startYear, startMonth: e.startMonth,
        endYear: e.endYear, endMonth: e.endMonth,
        sources: new Set([e.source]),
        jobType: e.jobType ?? "",
      }
    } else {
      const c = byCompany[key]
      // 기간 union
      if (e.startYear * 12 + e.startMonth < c.startYear * 12 + c.startMonth) {
        c.startYear = e.startYear; c.startMonth = e.startMonth
      }
      if (e.endYear * 12 + e.endMonth > c.endYear * 12 + c.endMonth) {
        c.endYear = e.endYear; c.endMonth = e.endMonth
      }
      c.sources.add(e.source)
      if (!c.jobType && e.jobType) c.jobType = e.jobType
    }
  }
  return Object.values(byCompany).map(c => ({ ...c, sources: [...c.sources].join("/") }))
}

// 4단계: 비교
function compare(humanEntries, sysMerged) {
  const humanByKey = {}
  for (const h of humanEntries) {
    const k = normalizeCompany(h.company)
    if (k) humanByKey[k] = h
  }
  const sysByKey = {}
  for (const s of sysMerged) {
    const k = normalizeCompany(s.company)
    if (k) sysByKey[k] = s
  }

  const humanKeys = Object.keys(humanByKey)
  const sysKeys = Object.keys(sysByKey)
  const matched = []
  const onlyHuman = []
  const onlySys = []

  for (const k of humanKeys) {
    // exact 또는 substring 매칭
    const exact = sysByKey[k]
    if (exact) { matched.push({ key: k, human: humanByKey[k], sys: exact }); continue }
    const partial = sysKeys.find(s => k.includes(s) || s.includes(k))
    if (partial) { matched.push({ key: k, human: humanByKey[k], sys: sysByKey[partial], partial: true }); continue }
    onlyHuman.push(humanByKey[k])
  }
  for (const k of sysKeys) {
    if (!humanKeys.includes(k) && !humanKeys.some(h => h.includes(k) || k.includes(h))) {
      onlySys.push(sysByKey[k])
    }
  }

  return { matched, onlyHuman, onlySys, humanTotal: humanKeys.length, sysTotal: sysKeys.length }
}

async function main() {
  const TESTS = [
    "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\경인TF 우용욱 난청 접수 스캔본.pdf",
    "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\서울동부TF) 정신행 난청 스캔본.pdf",
  ]

  for (const pdfPath of TESTS) {
    const fileName = path.basename(pdfPath)
    console.log(`\n========================================`)
    console.log(`📄 ${fileName}`)
    console.log(`========================================`)
    const buf = fs.readFileSync(pdfPath)
    const pageCount = (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount()
    console.log(`페이지: ${pageCount}, 크기: ${Math.round(buf.length / 1024)}KB`)

    // Step 1: 사람 산정표 (소음노출 포함)
    const t0 = Date.now()
    const humanEntries = await findNoiseHistoryTable(buf)
    console.log(`  ⏱ ${Math.round((Date.now() - t0) / 1000)}s, 사람 산정 ${humanEntries.length}건`)

    // Step 2: 4대보험 raw 추출
    const t1 = Date.now()
    const insurance = await extractInsurance(buf)
    console.log(`  ⏱ ${Math.round((Date.now() - t1) / 1000)}s`)
    console.log(`  raw: 고용산재 ${insurance.고용산재.length}, 건보 ${insurance.건보.length}, 연금 ${insurance.연금.length}, 일용 ${insurance.dailyEntries.length}`)

    // Step 3: 사업장 단위 합산
    const sysMerged = mergeBySite(insurance)
    console.log(`  사업장 통합: ${sysMerged.length}개`)

    // Step 4: 비교
    const cmp = compare(humanEntries, sysMerged)
    console.log(`\n📊 비교 결과:`)
    console.log(`  사람: ${cmp.humanTotal}개 사업장`)
    console.log(`  시스템: ${cmp.sysTotal}개 사업장`)
    console.log(`  ✅ 매칭: ${cmp.matched.length}개 (${Math.round(cmp.matched.length / cmp.humanTotal * 100)}%)`)
    console.log(`  ❌ 사람만: ${cmp.onlyHuman.length}개`)
    console.log(`  ⚠️ 시스템만: ${cmp.onlySys.length}개`)

    if (cmp.onlyHuman.length > 0) {
      console.log(`\n  사람 산정에만 있음 (시스템 누락):`)
      cmp.onlyHuman.slice(0, 10).forEach(h => console.log(`    - ${h.company} (${h.start} ~ ${h.end}) ${h.noiseExposure ? "🔊" : ""}`))
    }
    if (cmp.onlySys.length > 0) {
      console.log(`\n  시스템에만 있음 (사람 누락):`)
      cmp.onlySys.slice(0, 10).forEach(s => console.log(`    - ${s.company} (${s.startYear}-${String(s.startMonth).padStart(2, "0")} ~ ${s.endYear}-${String(s.endMonth).padStart(2, "0")}) [${s.sources}]`))
    }

    // 소음노출 일치율
    const matchedWithNoise = cmp.matched.filter(m => m.human.noiseExposure !== undefined)
    if (matchedWithNoise.length > 0) {
      const noiseTrue = matchedWithNoise.filter(m => m.human.noiseExposure).length
      console.log(`\n  소음노출 (사람 산정): ${noiseTrue}/${matchedWithNoise.length}건 노출 인정`)
    }
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1) })
