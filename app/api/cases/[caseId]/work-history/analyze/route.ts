import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { GoogleGenAI } from "@google/genai"

export const maxDuration = 300

let aiClient: GoogleGenAI | null = null
function getAIClient() {
  if (aiClient) return aiClient
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")
  aiClient = new GoogleGenAI({ apiKey })
  return aiClient
}

// JSON 파서 (마크다운 블록 + 잘림 복구)
function repairTruncatedJson(s: string): string {
  const stack: string[] = []
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
    result = s
    const lastComma = Math.max(result.lastIndexOf(","), 0)
    result = result.slice(0, lastComma)
    while (stack.length > 0) {
      const open = stack.pop()
      result += open === "{" ? "}" : "]"
    }
  }
  return result
}

function parseJson(text: string): { sources: Record<string, unknown[]>; dailyEntries: unknown[]; name: string; success: boolean } {
  const fallback = {
    sources: { 고용산재: [], 건보: [], 소득금액: [], 연금: [] } as Record<string, unknown[]>,
    dailyEntries: [] as unknown[],
    name: "",
    success: false,
  }
  try {
    // 마크다운 코드블록 다양한 변형 제거
    let cleaned = text.trim()
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "")
    cleaned = cleaned.replace(/\n?```\s*$/, "")
    cleaned = cleaned.trim()

    // 첫 { 부터 시작하는 JSON
    const startIdx = cleaned.indexOf("{")
    if (startIdx < 0) throw new Error("JSON not found")
    cleaned = cleaned.slice(startIdx)

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // 잘림 복구 시도
      const repaired = repairTruncatedJson(cleaned)
      parsed = JSON.parse(repaired)
    }
    return {
      sources: parsed.sources ?? fallback.sources,
      dailyEntries: parsed.dailyEntries ?? [],
      name: parsed.name ?? "",
      success: true,
    }
  } catch {
    return fallback
  }
}

async function callGemini(pdfBase64: string, prompt: string, maxRetries = 3): Promise<string> {
  const ai = getAIClient()
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = 5000 * Math.pow(2, attempt - 1)
      console.log(`Gemini retry ${attempt} after ${waitMs}ms`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            { text: prompt },
          ],
        }],
        config: {
          temperature: 0,
          maxOutputTokens: 65536,
        },
      })
      return result.text ?? ""
    } catch (err) {
      lastError = err as Error
      const msg = String(err)
      if (msg.includes("429") || msg.includes("rate") || msg.includes("RESOURCE_EXHAUSTED")) continue
      throw err
    }
  }
  throw lastError ?? new Error("Gemini retries exhausted")
}

function getPromptForDocType(docType: string): string {
  const base = "[중요] 반드시 JSON만 응답하라. 설명 텍스트, 코드블록, 주석을 절대 포함하지 마라. 첫 글자 { 마지막 글자 }인 순수 JSON만 출력하라.\n\n"
  const noiseGuide = "noiseExposure 필드: 직종명·사업장명·작업내용에 소음 노출이 의심되는 경우(광업·채굴·착암·발파·광산·제철·제강·금속·기계·조선·자동차제조·섬유·목재·건설·용접·철근·콘크리트·토목·포장·운전·지게차·굴삭기·크레인·소음 포함 표기 등) true, 그 외는 false."
  if (docType === "건보") return base + `이 문서는 건강보험자격득실확인서이다. 가입자구분이 직장가입자인 항목만 추출하라.\n\n[필수 제외]\n- 지역가입자, 지역세대원, 지역세대주, 직장피부양자\n- 사업장명이 "지역", "기타", "국민건강보험공단" 등 발급기관/메타 정보로 보이는 행\n\n사업장명칭에서 사업장명을 추출하라. 자격취득일이 시작일, 자격상실일이 종료일. 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"건보":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  if (docType === "고용산재_전체") return base + `[고용보험 자격이력 + 일용근로 통합 추출 — 패턴 기반 분류]\n\n## 핵심: 두 표를 행 패턴으로 구분\n\n### 자격이력내역서 행 (sources.고용산재로):\n- 컬럼: 직종명(코드) | 사업장 명칭 | 취득일 | 상실일 | 비고\n- 날짜 형식: yyyy-mm-dd 두 개 (취득일, 상실일)\n- 비고 컬럼: "근로자"\n- 임금/근로일수 컬럼 없음\n\n### 일용근로·노무제공내역서 행 (dailyEntries로):\n- 컬럼: 근로년월 | 사업장명 | 직종명(코드) | 근로일자 | 근로일수 | 임금총액 | 보수총액 | 근로자구분\n- 날짜 형식: yyyy/mm 한 개 (근로년월)\n- "X일" 형태 근로일수\n- "N원" 형태 임금/보수\n\n## 절대 규칙\n1. "yyyy/mm 사업장명 ... X일 N원" 패턴 → **반드시 dailyEntries**\n2. "yyyy-mm-dd yyyy-mm-dd 근로자" 패턴 → **반드시 sources.고용산재**\n3. "근로일수", "임금총액" 컬럼 데이터 있는 행은 무조건 dailyEntries\n4. 자격이력 표는 짧음 (3-10행). dailyEntries는 길음 (수십~수백행)\n5. sources.고용산재가 10건을 초과하면 일용근로를 잘못 분류한 것이다 — 다시 검토하라\n6. dailyEntries[].source는 단순 라벨 "고용산재"만 (sources 키와 무관)\n\n## 추출 필드\n자격이력 sources.고용산재:\n- jobType, company, startYear/startMonth (취득), endYear/endMonth (상실, 없으면 2026-01)\n\n일용근로 dailyEntries:\n- company ([업체명] 표기 시 []안 이름)\n- jobType (직종명+코드)\n- totalDays (X일에서 X)\n- startYear/startMonth (yyyy/mm)\n- convertedMonths = Math.ceil(totalDays/20)\n- source: "고용산재"\n- memo: 빈 문자열\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2016,"startMonth":9,"endYear":2016,"endMonth":11,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
  if (docType === "고용산재_상용") return base + `이 문서는 고용보험 자격이력내역서이다. 비고/구분이 "근로자"인 항목을 모두 추출하라. 직종명(코드), 사업장명, 취득일(시작), 상실일(종료). 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  if (docType === "일용직") return base + `이 문서는 고용보험 일용근로·노무제공내역서이다.\n\n## 절대 규칙 (매우 중요)\n1. 모든 행을 dailyEntries 배열에만 추출하라.\n2. **sources.고용산재, sources.건보, sources.소득금액, sources.연금 모두 반드시 빈 배열 [] 이다.** 절대로 이 4개 sources 배열에 데이터를 넣지 마라.\n3. 일용근로 행은 자격이력이 아니다. dailyEntries로만 분류한다.\n4. dailyEntries 항목의 "source" 필드는 단순한 문자열 라벨일 뿐이다 (sources 배열 키와 무관).\n\n## 추출 규칙\n- 모든 행을 그대로 추출. 합산 금지.\n- 사업장명에 [업체명] 표기 시 []안 이름을 company로 사용.\n- totalDays = 근로일수 컬럼 (예: "27일" → 27)\n- startYear/startMonth = 근로년월 (예: "2018/02" → 2018, 2)\n- convertedMonths = Math.ceil(totalDays / 20)\n- jobType = 직종명(코드 포함)\n- source = "고용산재" (단순 라벨, 변경하지 말 것)\n- memo = 빈 문자열 (토큰 절약)\n\n반드시 이 JSON 형식으로만 응답하라 (sources의 모든 키는 빈 배열):\n{"name":"성명","sources":{"고용산재":[],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
  if (docType === "연금") return base + `[국민연금 가입증명/가입내역확인서 — 단계별 추론]\n\n다음 순서로 사고하여 정확한 결과를 도출하라:\n\n[Step 1] 자격유지기간 표만 추출. 변동사유 표는 무시.\n[Step 2] 가입자종별이 "사업장" 또는 "사업장가입자"인 행만. "지역" 행은 절대 제외.\n[Step 3] 변동사유/처리일자를 별개 항목으로 만들지 말 것. 자격유지기간 단위로만 추출.\n\n[Step 4 — 필수 제외 사업장명] 다음 단어가 사업장명으로 출력되면 무조건 제외:\n- "지역", "지역가입자", "이 지역"\n- "임의계속", "임의계속가입자", "임의가입자"\n- "국민연금공단", "공단", "관리공단" (이는 발급기관이지 사업장 아님)\n- "기타", "미상", "납부예외" 등\n위와 같은 행은 sources.연금에 절대 포함하지 마라. 진짜 사업장명만 추출하라.\n\n[추출 필드]\n- company: 사업장명 (변경 이력 있으면 최신 명칭)\n- startYear/startMonth: 자격취득일\n- endYear/endMonth: 자격상실일 (없으면 2026-01)\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"연금":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"건보":[],"소득금액":[]},"dailyEntries":[]}`
  if (docType === "건근공") return base + `이 문서는 건설근로자공제회 내역서이다. 사업장별 총 근무일수 합산. convertedMonths=Math.ceil(totalDays/20).\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"건설일용직","totalDays":60,"startYear":2013,"startMonth":1,"convertedMonths":3,"source":"건근공","memo":""}]}`
  if (docType === "경력증명서") return base + `이 문서는 경력증명서 또는 재직증명서이다. 회사명, 재직기간, 직위/직종을 추출하라. 퇴사일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"직위/직종","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  return base + "이 문서에서 직업력 이력을 추출하라.\n반드시 이 JSON 형식으로만 응답하라:\n{\"name\":\"성명\",\"sources\":{\"고용산재\":[],\"건보\":[],\"소득금액\":[],\"연금\":[]},\"dailyEntries\":[]}"
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await params

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const docType = (formData.get("docType") as string) ?? ""
  const chunkName = (formData.get("chunkName") as string) ?? "(unnamed)"
  const chunkIndex = Number(formData.get("chunkIndex") ?? 0)

  if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 })

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
      const keepalive = setInterval(
        () => controller.enqueue(enc.encode(": keepalive\n\n")),
        15000
      )

      try {
        const buf = await file.arrayBuffer()
        const base64 = Buffer.from(buf).toString("base64")
        console.log(`[${chunkName}] Gemini 분석 시작 (${Math.round(buf.byteLength / 1024)}KB)`)

        // 청크 분기 정책: 첫 청크가 아닌 고용산재_전체는 일용직 prompt
        let effectiveDocType = docType
        if (docType === "고용산재_전체" && chunkIndex > 0) {
          effectiveDocType = "일용직"
          console.log(`[${chunkName}] chunkIndex>0 → 일용직 prompt`)
        }

        const t0 = Date.now()
        let text = await callGemini(base64, getPromptForDocType(effectiveDocType))
        let parsed = parseJson(text)
        // JSON 파싱 실패 시 1회 자동 재시도 (Gemini 출력 변동 대응)
        if (!parsed.success) {
          console.warn(`[${chunkName}] JSON parse failed, retrying once...`)
          text = await callGemini(base64, getPromptForDocType(effectiveDocType))
          parsed = parseJson(text)
          if (!parsed.success) {
            console.error(`[${chunkName}] JSON parse failed after retry. Text:`, text.slice(0, 300))
          }
        }
        const elapsedMs = Date.now() - t0
        const { sources, dailyEntries, name } = parsed
        console.log(`[${chunkName}] 추출 완료 (${elapsedMs}ms) — 고용산재:${sources.고용산재?.length ?? 0} 건보:${sources.건보?.length ?? 0} 연금:${sources.연금?.length ?? 0} 일용직:${dailyEntries.length}`)

        send({ type: "result", sources, dailyEntries, name })
      } catch (err) {
        console.error("처리 오류:", err)
        send({ type: "error", error: String(err) })
      } finally {
        clearInterval(keepalive)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  })
}
