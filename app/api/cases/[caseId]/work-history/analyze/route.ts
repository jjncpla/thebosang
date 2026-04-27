import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DocumentProcessorServiceClient } from "@google-cloud/documentai"

export const maxDuration = 300

// Google Document AI 클라이언트 초기화
function getDocAIClient() {
  const b64 = process.env.GOOGLE_CREDENTIALS_B64
  if (!b64) throw new Error("GOOGLE_CREDENTIALS_B64 not set")
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))
  return new DocumentProcessorServiceClient({ credentials })
}

async function ocrPdfWithDocAI(pdfBase64: string): Promise<string> {
  const client = getDocAIClient()
  const processorName = process.env.GOOGLE_DOCAI_PROCESSOR
  if (!processorName) throw new Error("GOOGLE_DOCAI_PROCESSOR not set")

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: pdfBase64,
      mimeType: "application/pdf",
    },
  })

  const text = result.document?.text ?? ""
  return text
}

async function callClaudeWithRetry(body: object, apiKey: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = 20000 * attempt
      console.log("Rate limit hit, waiting", waitMs / 1000, "seconds before retry", attempt)
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
    if (res.status === 429) {
      lastError = new Error("rate_limit")
      continue
    }
    return res
  }
  throw lastError ?? new Error("Max retries exceeded")
}

function getPromptForDocType(docType: string): string {
  const base = "[중요] 반드시 JSON만 응답하라. 설명 텍스트, 코드블록, 주석을 절대 포함하지 마라. 첫 글자 { 마지막 글자 }인 순수 JSON만 출력하라.\n\n"
  const noiseGuide = "noiseExposure 필드: 직종명·사업장명·작업내용에 소음 노출이 의심되는 경우(광업·채굴·착암·발파·광산·제철·제강·금속·기계·조선·자동차제조·섬유·목재·건설·용접·철근·콘크리트·토목·포장·운전·지게차·굴삭기·크레인·소음 포함 표기 등) true, 그 외는 false."

  if (docType === "건보") {
    return base + `이 문서는 건강보험자격득실확인서이다. 가입자구분이 직장가입자인 항목만 추출하라. 지역가입자, 지역세대원, 지역세대주, 직장피부양자는 반드시 제외하라. 사업장명칭에서 사업장명을 추출하라. 자격취득일이 시작일, 자격상실일이 종료일. 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"건보":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  }
  if (docType === "고용산재_전체") {
    return base + `이 문서는 고용보험 자료이다.\n\n[상용직] 자격이력내역서에서 비고/구분이 "근로자"인 항목을 sources.고용산재에 추출. 직종명(코드), 사업장명, 취득일(시작), 상실일(종료). 상실일 없으면 2026-01. 반복 취득·상실은 각각 별도 항목.\n\n[일용직] 일용근로노무제공내역서의 모든 행을 dailyEntries에 추출. 합산 금지. [업체명] 표기 시 []안 이름을 company로. 근무일수는 비고 날짜 숫자 개수 또는 근무일수 컬럼. startYear/startMonth는 해당 행 연월. convertedMonths=Math.ceil(totalDays/20).\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2016,"startMonth":9,"endYear":2016,"endMonth":11,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
  }
  if (docType === "고용산재_상용") {
    return base + `이 문서는 고용보험 자격이력내역서이다. 비고/구분이 "근로자"인 항목을 모두 추출하라. 직종명(코드), 사업장명, 취득일(시작), 상실일(종료). 상실일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"직종명(코드)","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  }
  if (docType === "일용직") {
    return base + `이 문서는 고용보험 일용근로노무제공내역서이다. 모든 행을 그대로 추출. 합산 금지. [업체명] 표기 시 []안 이름을 company로. 근무일수는 비고 날짜 숫자 개수 또는 근무일수 컬럼. startYear/startMonth는 해당 행 연월. convertedMonths=Math.ceil(totalDays/20).\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"직종명","totalDays":5,"startYear":2013,"startMonth":1,"convertedMonths":1,"source":"고용산재","memo":""}]}`
  }
  if (docType === "연금") {
    return base + `이 문서는 국민연금 가입증명 또는 가입내역확인서이다. 사업장가입자 취득·상실 이력을 추출하라. 명칭 변경 시 최신 명칭으로 통일. 지역가입자 제외. 취득일이 시작일, 상실일이 종료일.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"연금":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"","workDays":0,"noiseExposure":false}],"고용산재":[],"건보":[],"소득금액":[]},"dailyEntries":[]}`
  }
  if (docType === "건근공") {
    return base + `이 문서는 건설근로자공제회 내역서이다. 사업장별 총 근무일수 합산. convertedMonths=Math.ceil(totalDays/20).\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[{"company":"사업장명","jobType":"건설일용직","totalDays":60,"startYear":2013,"startMonth":1,"convertedMonths":3,"source":"건근공","memo":""}]}`
  }
  if (docType === "경력증명서") {
    return base + `이 문서는 경력증명서 또는 재직증명서이다. 회사명, 재직기간, 직위/직종을 추출하라. 퇴사일 없으면 2026-01.\n${noiseGuide}\n반드시 이 JSON 형식으로만 응답하라:\n{"name":"성명","sources":{"고용산재":[{"company":"사업장명","startYear":2000,"startMonth":1,"endYear":2005,"endMonth":12,"department":"","jobType":"직위/직종","workDays":0,"noiseExposure":false}],"건보":[],"소득금액":[],"연금":[]},"dailyEntries":[]}`
  }
  return base + "이 문서에서 직업력 이력을 추출하라.\n반드시 이 JSON 형식으로만 응답하라:\n{\"name\":\"성명\",\"sources\":{\"고용산재\":[],\"건보\":[],\"소득금액\":[],\"연금\":[]},\"dailyEntries\":[]}"
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { caseId } = await params

  try {
    const formData = await req.formData()
    const files = formData.getAll("files") as File[]
    const docTypes = formData.getAll("docTypes") as string[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 })

    const mergedSources: Record<string, unknown[]> = { 고용산재: [], 건보: [], 소득금액: [], 연금: [] }
    const allDailyEntries: unknown[] = []
    let extractedName = ""

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const docType = docTypes[i] ?? ""
      const buffer = await file.arrayBuffer()
      const pdfBase64 = Buffer.from(buffer).toString("base64")

      console.log(`[${file.name}] Document AI OCR 시작...`)
      let ocrText = ""
      try {
        ocrText = await ocrPdfWithDocAI(pdfBase64)
        console.log(`[${file.name}] OCR 완료 — ${ocrText.length}자`)
      } catch (ocrErr) {
        console.error(`[${file.name}] OCR 오류:`, ocrErr)
        return NextResponse.json({ error: `OCR 실패: ${String(ocrErr)}` }, { status: 500 })
      }

      if (!ocrText || ocrText.trim().length < 10) {
        console.warn(`[${file.name}] OCR 결과 없음`)
        continue
      }

      const promptText = getPromptForDocType(docType)
      const fullPrompt = `${promptText}\n\n--- 문서 텍스트 ---\n${ocrText}`

      console.log(`[${file.name}] Claude 분석 시작...`)
      const claudeRes = await callClaudeWithRetry(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8192,
          messages: [{
            role: "user",
            content: fullPrompt,
          }],
        },
        apiKey
      )

      if (!claudeRes.ok) {
        console.error(`[${file.name}] Claude API 오류:`, await claudeRes.text())
        continue
      }

      const data = await claudeRes.json()
      const rawText: string = data.content?.[0]?.text ?? ""

      try {
        const m = rawText.match(/\{[\s\S]*\}/)
        if (!m) throw new Error("JSON not found")
        const parsed = JSON.parse(m[0]) as {
          name?: string
          sources: Record<string, unknown[]>
          dailyEntries?: unknown[]
        }
        console.log(`[${file.name}] 추출 완료 — 고용산재:${parsed.sources?.고용산재?.length ?? 0} 일용직:${parsed.dailyEntries?.length ?? 0}`)

        if (parsed.name && !extractedName) extractedName = parsed.name
        for (const key of ["고용산재", "건보", "소득금액", "연금"] as const) {
          if (parsed.sources?.[key]?.length > 0) {
            mergedSources[key] = mergedSources[key].concat(parsed.sources[key])
          }
        }
        if (parsed.dailyEntries?.length) allDailyEntries.push(...parsed.dailyEntries)
      } catch {
        console.error(`[${file.name}] JSON 파싱 오류:`, rawText.slice(0, 300))
      }
    }

    await prisma.case.update({
      where: { id: caseId },
      data: { workHistoryRaw: mergedSources as object },
    })

    return NextResponse.json({ success: true, sources: mergedSources, dailyEntries: allDailyEntries, name: extractedName })
  } catch (err) {
    console.error("Unhandled error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
