import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { DocumentProcessorServiceClient } from "@google-cloud/documentai"

export const maxDuration = 300

let docAIClient: DocumentProcessorServiceClient | null = null
function getDocAIClient() {
  if (docAIClient) return docAIClient
  const b64 = process.env.GOOGLE_CREDENTIALS_B64
  if (!b64) throw new Error("GOOGLE_CREDENTIALS_B64 not set")
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))
  docAIClient = new DocumentProcessorServiceClient({ credentials })
  return docAIClient
}

async function ocrPdf(pdfBase64: string): Promise<string> {
  const client = getDocAIClient()
  const processorName = process.env.GOOGLE_DOCAI_PROCESSOR
  if (!processorName) throw new Error("GOOGLE_DOCAI_PROCESSOR not set")

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: { content: pdfBase64, mimeType: "application/pdf" },
  })
  return result.document?.text ?? ""
}

async function callClaude(body: object, apiKey: string, maxRetries = 5): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter: 8s, 16s, 32s, 64s
      const waitMs = 8000 * Math.pow(2, attempt - 1) + Math.random() * 2000
      console.log(`Rate limit, waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    })
    if (res.status === 429 || res.status === 529) { lastError = new Error("rate_limit"); continue }
    return res
  }
  throw lastError ?? new Error("Max retries exceeded")
}

// Robust JSON parser: handles markdown code blocks, truncated JSON, leading/trailing noise
function robustParseJson(rawText: string): { name?: string; sources?: Record<string, unknown[]>; dailyEntries?: unknown[] } | null {
  if (!rawText) return null
  let txt = rawText.trim()
  txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
  try { return JSON.parse(txt) } catch { /* try harder */ }
  const first = txt.indexOf("{")
  if (first === -1) return null
  let candidate = txt.slice(first).replace(/```\s*$/i, "").trim()
  try { return JSON.parse(candidate) } catch { /* repair */ }
  // Truncated JSON: trim trailing partial fields and close brackets
  for (let cutoff = candidate.length; cutoff > 200; cutoff--) {
    let s = candidate.slice(0, cutoff).replace(/,\s*$/, "")
    let inStr = false, esc = false
    for (let i = 0; i < s.length; i++) {
      if (esc) { esc = false; continue }
      if (s[i] === "\\" && inStr) { esc = true; continue }
      if (s[i] === '"') inStr = !inStr
    }
    if (inStr) continue
    const stack: string[] = []
    let s2 = false, e2 = false
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (e2) { e2 = false; continue }
      if (c === "\\" && s2) { e2 = true; continue }
      if (c === '"') { s2 = !s2; continue }
      if (s2) continue
      if (c === "{" || c === "[") stack.push(c)
      else if (c === "}" && stack[stack.length - 1] === "{") stack.pop()
      else if (c === "]" && stack[stack.length - 1] === "[") stack.pop()
    }
    while (stack.length > 0) s += stack.pop() === "{" ? "}" : "]"
    s = s.replace(/,(\s*[}\]])/g, "$1")
    try { return JSON.parse(s) } catch { /* keep trying */ }
    if (candidate.length - cutoff > 500) break
  }
  return null
}

function getPromptForDocType(docType: string): string {
  const base = "[CRITICAL OUTPUT RULES]\n1. 응답은 반드시 순수 JSON 객체 하나로만 구성한다.\n2. 절대로 ```json, ``` 같은 마크다운 코드 블록을 사용하지 마라.\n3. JSON 앞뒤로 설명 텍스트, 주석을 절대 추가하지 마라.\n4. 첫 글자는 { 마지막 글자는 } 이어야 한다.\n5. 출력이 길어질 것 같으면 dailyEntries 항목들의 memo 필드를 빈 문자열로 두어 토큰을 절약하라.\n\n"
  const noiseGuide = "noiseExposure 필드: 직종명·사업장명·작업내용에 소음 노출이 의심되는 경우(광업·채굴·착암·발파·광산·제철·제강·금속·기계·조선·자동차제조·섬유·목재·건설·용접·철근·콘크리트·토목·포장·운전·지게차·굴삭기·크레인·소음 포함 표기 등) true, 그 외는 false."

  if (docType === "건보") return base + `[건강보험자격득실확인서 추출 규칙]\n\n표의 모든 행(No 1~끝)을 순서대로 스캔하고, 가입자구분이 정확히 "직장가입자"인 항목만 sources.건보에 추출하라.\n\n[제외 대상 - 절대 추출 금지]\n- 직장피부양자 (본인 가입자 아님)\n- 지역세대주\n- 지역세대원\n- 지역가입자\n\n[추출 규칙]\n- 단 한 행도 누락 금지. 가입자구분이 "직장가입자"이면 무조건 추출.\n- 사업장명칭에 "(일용)" 또는 "/일용/" 표기가 있어도 직장가입자이면 추출.\n- 사업장명이 OCR에서 잘렸거나 누락된 경우 company는 OCR에서 보이는 만큼만 적되 빈 문자열은 피한다.\n- 자격취득일 → startYear/startMonth, 자격상실일 → endYear/endMonth (yyyy.mm.dd 형식). 상실일 없으면 2026-01.\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"건보":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`

  if (docType === "고용산재_전체") return base + `[고용보험 자격이력 + 일용근로 통합 추출 — 단계별 추론]\n\n[Step 0] OCR 텍스트에서 "조회기간 총 N개 이력 중" 표현을 찾아라.\n  - 자격이력내역서의 N → sources.고용산재의 정답 행 수\n  - 일용근로내역서의 N → dailyEntries의 정답 행 수\n  - 두 표 모두 있으면 양쪽 N 모두 활용\n\n=== [표 1: 자격이력내역서] - 상용직 ===\n- 헤더: "자격이력내역서 (근로자용/피보험자용)"\n- 컬럼: 일련번호 | 직종명(코드) | 사업장 명칭 | 취득일/전근일 | 상실일 | 비고\n- 비고 컬럼이 "근로자"인 모든 행을 sources.고용산재에 추출.\n- 단 한 행도 누락 금지. 같은 사업장 반복 취득·상실은 각각 별도 항목.\n- jobType: 직종명(코드 포함), company: 사업장 명칭, startYear/startMonth: 취득일, endYear/endMonth: 상실일.\n- 상실일 없으면 2026-01.\n\n=== [표 2: 일용근로·노무제공내역서] - 일용직 ===\n- 헤더: "일용근로·노무제공내역서 (근로자용/피보험자용)"\n- 컬럼: 일련번호 | 근로년월 | 사업장명 | 직종명(코드) | 근로일자 | 근로일수 | 임금총액 | 보수총액 | 근로자 구분\n- 모든 행을 dailyEntries에 추출. 합산 금지.\n- 사업장명에 [업체명] 표기 시 []안 이름을 company로 사용.\n- totalDays = 근로일수 컬럼 (예: "27일"이면 27)\n- startYear/startMonth = 근로년월 (예: "2018/02"이면 2018, 2)\n- convertedMonths = Math.ceil(totalDays / 20)\n- jobType = 직종명(코드 포함)\n- memo = 빈 문자열로 토큰 절약\n\n[Step Final] 추출 후 자체 검증:\n- sources.고용산재의 길이가 자격이력 N과 일치하는가?\n- dailyEntries의 길이가 일용근로 N과 일치하는가?\n- 일치하지 않으면 OCR 텍스트를 다시 한번 스캔하여 누락 행을 찾아라.\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2016,"startMonth":9,"endYear":2016,"endMonth":11,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`

  if (docType === "고용산재_상용") return base + `이 문서는 고용보험 자격이력내역서이다. 비고/구분이 "근로자"인 항목을 모두 추출하라. 직종명(코드), 사업장명, 취득일(시작), 상실일(종료). 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`

  if (docType === "일용직") return base + `이 문서는 고용보험 일용근로노무제공내역서이다. 모든 행을 그대로 추출. 합산 금지. [업체명] 표기 시 []안 이름을 company로. 근무일수는 비고 날짜 숫자 개수 또는 근무일수 컬럼. startYear/startMonth는 해당 행 연월. convertedMonths=Math.ceil(totalDays/20). memo는 빈 문자열로 두어 토큰 절약.\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`

  if (docType === "연금") return base + `[국민연금 가입증명/가입내역확인서 추출 — 단계별 추론]\n\n다음 순서로 사고하여 정확한 결과를 도출하라:\n\n[Step 1] OCR 텍스트에서 "가입이력" 또는 "자격유지기간" 표를 식별한다.\n  - 이 표만 추출 대상이다. (변동사유 표나 변경 내역 표는 무시)\n  - 자격유지기간이 명시된 행을 모두 나열한다 (예: "2002.11.01 ~ 2008.01.06")\n\n[Step 2] 각 자격유지기간의 가입자종별을 확인한다.\n  - 가입자종별 컬럼이 "사업장" 또는 "사업장가입자"이면 → 추출 대상\n  - 가입자종별 컬럼이 "지역" 또는 "지역가입자"이면 → 절대 제외\n  - 임의가입자, 임의계속가입자도 제외\n\n[Step 3] 가입자종별 매칭 시 사업장명도 체크한다.\n  - 사업장가입자면 사업장명이 함께 표시됨 (예: "경주캐터링서비스")\n  - 지역가입자면 사업장명 자리에 "지역" 또는 빈칸\n\n[Step 4] 변동사유/처리일자 표(상실/취득 메타데이터)는 절대로 별개 항목으로 만들지 않는다.\n  - 예: "상실 2008-01-07"은 위 자격유지기간 종료일의 처리 정보일 뿐이다.\n  - 예: "사업장 2002-11-01 2002-11-14"는 자격취득일 처리 정보일 뿐이다.\n\n[Step 5] 추출 결과 검증\n  - sources.연금의 모든 항목은 [Step 1]에서 식별한 자격유지기간 중 하나여야 한다.\n  - 가입자종별이 "지역"인 행을 추출하지 않았는지 마지막으로 확인하라.\n\n[추출 필드]\n- company: 사업장명 (변경 이력 있으면 최신 명칭)\n- startYear/startMonth: 자격취득일\n- endYear/endMonth: 자격상실일 (없으면 2026-01)\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"연금":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"건보":[],"소득금액":[]},"dailyEntries":[]}`

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

  if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 })

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
        console.log(`[${chunkName}] OCR 시작 (${Math.round(buf.byteLength / 1024)}KB)`)

        // 1단계: Document AI OCR
        const t1 = Date.now()
        const text = await ocrPdf(base64)
        const ocrMs = Date.now() - t1
        console.log(`[${chunkName}] OCR 완료: ${text.length}자 (${ocrMs}ms)`)

        if (!text || text.length < 10) {
          send({
            type: "result",
            sources: { 고용산재: [], 건보: [], 소득금액: [], 연금: [] },
            dailyEntries: [],
            name: "",
          })
          return
        }

        // 2단계: Haiku 텍스트 파싱
        // 청크 자동 감지: 고용산재_전체 청크 중 "자격이력내역서" 헤더가 없고 "일용근로"만 있으면
        // 일용직 prompt로 전환 → 일용직 행을 자격이력으로 오분류 방지 (헤비 케이스 핵심 수정)
        let effectiveDocType = docType
        if (docType === "고용산재_전체") {
          const hasJaagyeokIryeok = /자격이력내역서/.test(text)
          const hasIlyongKeullo = /일용근로|노무제공내역서/.test(text)
          if (!hasJaagyeokIryeok && hasIlyongKeullo) {
            effectiveDocType = "일용직"
            console.log(`[${chunkName}] 자격이력 헤더 없음 → 일용직 prompt로 자동 전환`)
          }
        }
        const fullPrompt = `${getPromptForDocType(effectiveDocType)}\n\n--- 문서 텍스트 ---\n${text}`
        const t2 = Date.now()
        const claudeRes = await callClaude(
          {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 8192,
            temperature: 0, // 결정적 출력으로 일관성 보장
            messages: [{ role: "user", content: fullPrompt }],
          },
          apiKey
        )
        const haikuMs = Date.now() - t2

        if (!claudeRes.ok) {
          const errText = await claudeRes.text()
          console.error(`[${chunkName}] Claude API 오류:`, errText)
          send({ type: "error", error: `Claude API 오류: ${errText}` })
          return
        }

        const data = await claudeRes.json()
        const rawText: string = data.content?.[0]?.text ?? ""

        let sources: Record<string, unknown[]> = { 고용산재: [], 건보: [], 소득금액: [], 연금: [] }
        let dailyEntries: unknown[] = []
        let name = ""

        const parsed = robustParseJson(rawText)
        if (parsed) {
          sources = parsed.sources ?? sources
          dailyEntries = parsed.dailyEntries ?? []
          name = parsed.name ?? ""
          console.log(`[${chunkName}] 추출 완료 (${haikuMs}ms) — 고용산재:${sources.고용산재?.length ?? 0} 건보:${sources.건보?.length ?? 0} 연금:${sources.연금?.length ?? 0} 일용직:${dailyEntries.length}`)
        } else {
          console.error(`[${chunkName}] JSON 파싱 오류 (text len ${rawText.length}):`, rawText.slice(-300))
        }

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
