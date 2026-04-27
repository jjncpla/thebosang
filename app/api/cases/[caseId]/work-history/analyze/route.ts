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

async function callClaude(body: object, apiKey: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = 10000 * attempt
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
      signal: AbortSignal.timeout(60000),
    })
    if (res.status === 429) { lastError = new Error("rate_limit"); continue }
    return res
  }
  throw lastError ?? new Error("Max retries exceeded")
}

function getPromptForDocType(docType: string): string {
  const base = "[중요] 반드시 JSON만 응답하라. 설명 텍스트, 코드블록, 주석을 절대 포함하지 마라. 첫 글자 { 마지막 글자 }인 순수 JSON만 출력하라.\n\n"
  const noiseGuide = "noiseExposure 필드: 직종명·사업장명·작업내용에 소음 노출이 의심되는 경우(광업·채굴·착암·발파·광산·제철·제강·금속·기계·조선·자동차제조·섬유·목재·건설·용접·철근·콘크리트·토목·포장·운전·지게차·굴삭기·크레인·소음 포함 표기 등) true, 그 외는 false."
  if (docType === "건보") return base + `이 문서는 건강보험자격득실확인서이다. 가입자구분이 직장가입자인 항목만 추출하라. 지역가입자, 지역세대원, 지역세대주, 직장피부양자는 반드시 제외하라. 사업장명칭에서 사업장명을 추출하라. 자격취득일이 시작일, 자격상실일이 종료일. 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"건보":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  if (docType === "고용산재_전체") return base + `이 문서는 고용보험 자료이며 두 종류의 표가 섞여 있을 수 있다.\n\n=== [표 1: 자격이력내역서] - 상용직 ===\n컬럼: 직종명(코드) | 사업장명 | 취득일 | 상실일 | 비고\n비고/구분이 "근로자"인 모든 행을 sources.고용산재에 추출하라. 단 한 행도 누락 금지. 직종명(코드), 사업장명, 취득일(시작), 상실일(종료). 상실일 없으면 2026-01. 같은 사업장 반복 취득·상실은 각각 별도 항목.\n\n=== [표 2: 일용근로노무제공내역서] - 일용직 ===\n모든 행을 dailyEntries에 추출. 합산 금지. [업체명] 표기 시 []안 이름을 company로. 근무일수는 비고 날짜 숫자 개수 또는 근무일수 컬럼. startYear/startMonth는 해당 행 연월. convertedMonths=Math.ceil(totalDays/20).\n\n${noiseGuide}\n\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2016,"startMonth":9,"endYear":2016,"endMonth":11,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
  if (docType === "고용산재_상용") return base + `이 문서는 고용보험 자격이력내역서이다. 비고/구분이 "근로자"인 항목을 모두 추출하라. 직종명(코드), 사업장명, 취득일(시작), 상실일(종료). 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  if (docType === "일용직") return base + `이 문서는 고용보험 일용근로노무제공내역서이다. 모든 행을 그대로 추출. 합산 금지. [업체명] 표기 시 []안 이름을 company로. 근무일수는 비고 날짜 숫자 개수 또는 근무일수 컬럼. startYear/startMonth는 해당 행 연월. convertedMonths=Math.ceil(totalDays/20).\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
  if (docType === "연금") return base + `이 문서는 국민연금 가입증명 또는 가입내역확인서이다. 사업장가입자 취득·상실 이력을 추출하라. 명칭 변경 시 최신 명칭으로 통일. 지역가입자 제외. 취득일이 시작일, 상실일이 종료일.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"연금":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"건보":[],"소득금액":[]},"dailyEntries":[]}`
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
        const fullPrompt = `${getPromptForDocType(docType)}\n\n--- 문서 텍스트 ---\n${text}`
        const t2 = Date.now()
        const claudeRes = await callClaude(
          {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 8192,
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

        try {
          const m = rawText.match(/\{[\s\S]*\}/)
          if (!m) throw new Error("JSON not found")
          const parsed = JSON.parse(m[0])
          sources = parsed.sources ?? sources
          dailyEntries = parsed.dailyEntries ?? []
          name = parsed.name ?? ""
          console.log(`[${chunkName}] 추출 완료 (${haikuMs}ms) — 고용산재:${sources.고용산재?.length ?? 0} 건보:${sources.건보?.length ?? 0} 연금:${sources.연금?.length ?? 0} 일용직:${dailyEntries.length}`)
        } catch {
          console.error(`[${chunkName}] JSON 파싱 오류:`, rawText.slice(0, 300))
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
