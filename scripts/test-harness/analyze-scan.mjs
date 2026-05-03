// 스캔본 PDF 분석:
// 1) 사람이 만든 직업력 산정표 찾기 (ground truth 추출)
// 2) 4대보험 자료 부분에서 우리 시스템 방식으로 추출
// 3) 비교
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

async function getPdfInfo(pdfPath) {
  const buf = fs.readFileSync(pdfPath)
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
  return { pageCount: doc.getPageCount(), sizeKB: Math.round(buf.length / 1024) }
}

async function callGemini(pdfBase64, prompt, maxOutputTokens = 65536) {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: prompt },
      ],
    }],
    config: { temperature: 0, maxOutputTokens },
  })
  return result.text ?? ""
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

// 사람이 만든 직업력 산정표 찾기 (스캔본 전체 스캔)
async function findHumanWorkHistory(pdfPath) {
  const buf = fs.readFileSync(pdfPath)
  const totalPages = (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount()
  console.log(`총 ${totalPages}p, 청크 분할 (10p씩)...`)

  const chunks = await splitPdf(buf, 10)
  const promises = chunks.map(async (c) => {
    const prompt = `이 PDF 청크를 검토하여, 사람이 작성하거나 정리한 "직업력 산정표"가 있는 페이지를 찾아라.
이는 4대보험 원본 자료가 아니라, 노무사/직원이 정리한 최종 직업력 표여야 한다.
보통 다음 같은 형식이다:
- 사업장명, 작업기간, 직종, 종사기간 등이 정리된 표
- 또는 "직업력 조사 표준문답서" 같은 양식

만약 그런 페이지가 있다면, 그 직업력 표를 다음 JSON으로 추출:
{
  "found": true,
  "pages": "p3-p4",
  "regular_employment": [
    {"company": "사업장명", "start": "yyyy-mm", "end": "yyyy-mm", "jobType": "직종", "noiseExposure": true/false}
  ],
  "daily_employment": [
    {"company": "사업장명", "totalDays": 10, "period": "yyyy-mm ~ yyyy-mm"}
  ],
  "summary_text": "사람이 작성한 요약문이 있다면 여기 추출"
}

만약 없으면: {"found": false}

설명 없이 JSON만 출력.`
    try {
      const text = await callGemini(c.base64, prompt, 16384)
      const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim()
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (!m) return { chunk: c.name, parsed: null }
      const parsed = JSON.parse(m[0])
      return { chunk: c.name, parsed }
    } catch (e) {
      return { chunk: c.name, parsed: null, error: String(e).slice(0, 100) }
    }
  })

  const results = []
  // 동시성 3개씩
  for (let i = 0; i < promises.length; i += 3) {
    const batch = promises.slice(i, i + 3)
    results.push(...await Promise.all(batch))
  }

  return results
}

// 4대보험 자료에서 우리 시스템 방식으로 추출 (전체 PDF 통합)
async function extractFromInsurance(pdfPath) {
  const buf = fs.readFileSync(pdfPath)
  const totalPages = (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount()
  const chunks = await splitPdf(buf, 5)

  const prompt = `이 PDF 청크에서 4대보험 자료(고용보험 자격이력내역서, 고용보험 일용근로내역서, 건강보험 자격득실확인서, 국민연금 가입증명서)가 보이면 추출하라.

추출 결과:
- 자격이력내역서 행 → sources.고용산재 (yyyy-mm-dd 형식 두 개)
- 일용근로내역서 행 → dailyEntries (yyyy/mm + X일)
- 건강보험 직장가입자 → sources.건보
- 국민연금 사업장가입자 → sources.연금

다른 페이지(직업력 산정표, 의무기록 등)는 무시.

JSON만 출력:
{"sources":{"고용산재":[{"company":"","startYear":0,"startMonth":0,"endYear":0,"endMonth":0,"jobType":""}],"건보":[],"연금":[]},"dailyEntries":[{"company":"","jobType":"","totalDays":0,"startYear":0,"startMonth":0}]}`

  const promises = chunks.map(async (c) => {
    try {
      const text = await callGemini(c.base64, prompt, 32768)
      const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim()
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (!m) return null
      return JSON.parse(m[0])
    } catch (e) {
      return null
    }
  })

  const results = []
  for (let i = 0; i < promises.length; i += 3) {
    const batch = promises.slice(i, i + 3)
    results.push(...await Promise.all(batch))
  }

  // Aggregate
  const merged = { sources: { 고용산재: [], 건보: [], 연금: [] }, dailyEntries: [] }
  for (const r of results) {
    if (!r) continue
    for (const key of ["고용산재", "건보", "연금"]) {
      if (r.sources?.[key]?.length) merged.sources[key] = merged.sources[key].concat(r.sources[key])
    }
    if (r.dailyEntries?.length) merged.dailyEntries = merged.dailyEntries.concat(r.dailyEntries)
  }
  return { totalPages, merged }
}

async function main() {
  const TESTS = [
    "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\경인TF 우용욱 난청 접수 스캔본.pdf",
    "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\서울동부TF) 정신행 난청 스캔본.pdf",
    "C:\\Users\\jjakg\\Downloads\\Telegram Desktop\\울산TF) 이준철 난청 스캔본.pdf",
  ]

  for (const pdfPath of TESTS) {
    const fileName = path.basename(pdfPath)
    console.log(`\n========== ${fileName} ==========`)
    const info = await getPdfInfo(pdfPath)
    console.log(`페이지: ${info.pageCount}, 크기: ${info.sizeKB}KB`)

    if (info.sizeKB > 30 * 1024) {
      console.log(`⚠️ 파일 너무 큼 (${info.sizeKB}KB > 30MB), 스킵`)
      continue
    }

    // Step 1: 사람이 만든 직업력 산정표 찾기
    console.log(`\n[1] 사람이 만든 직업력 산정표 검색...`)
    const t0 = Date.now()
    const humanResults = await findHumanWorkHistory(pdfPath)
    console.log(`(${Math.round((Date.now() - t0) / 1000)}s)`)
    const found = humanResults.filter((r) => r.parsed?.found)
    if (found.length === 0) {
      console.log(`  사람 작성 직업력 산정표 없음`)
    } else {
      for (const f of found) {
        console.log(`  [${f.chunk}] 발견:`)
        console.log(`    상용 ${f.parsed.regular_employment?.length ?? 0}건`)
        console.log(`    일용 ${f.parsed.daily_employment?.length ?? 0}건`)
        if (f.parsed.summary_text) console.log(`    요약: ${f.parsed.summary_text.slice(0, 200)}`)
      }
    }

    // Step 2: 4대보험 자료에서 우리 시스템 방식으로 추출
    console.log(`\n[2] 4대보험 자료 직접 추출...`)
    const t1 = Date.now()
    const sysResults = await extractFromInsurance(pdfPath)
    console.log(`(${Math.round((Date.now() - t1) / 1000)}s)`)
    console.log(`  고용산재: ${sysResults.merged.sources.고용산재?.length ?? 0}`)
    console.log(`  건보: ${sysResults.merged.sources.건보?.length ?? 0}`)
    console.log(`  연금: ${sysResults.merged.sources.연금?.length ?? 0}`)
    console.log(`  일용직: ${sysResults.merged.dailyEntries?.length ?? 0}`)

    // Step 3: 비교
    console.log(`\n[3] 비교:`)
    if (found.length > 0) {
      const human = found[0].parsed
      console.log(`  사람: 상용 ${human.regular_employment?.length ?? 0}건 + 일용 ${human.daily_employment?.length ?? 0}건`)
      console.log(`  시스템: 상용 ${sysResults.merged.sources.고용산재?.length ?? 0}건 + 일용 ${sysResults.merged.dailyEntries?.length ?? 0}건`)
    } else {
      console.log(`  사람 산정표 없어서 비교 불가`)
    }
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1) })
