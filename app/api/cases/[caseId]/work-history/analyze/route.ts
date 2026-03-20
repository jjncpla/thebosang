import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { PDFDocument } from "pdf-lib"

export const maxDuration = 300

async function callClaudeWithRetry(body: object, apiKey: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = 30000 * attempt
      console.log("Rate limit hit, waiting", waitMs / 1000, "seconds before retry", attempt)
      await new Promise((r) => setTimeout(r, waitMs))
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
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
  const base = `[중요] 반드시 JSON만 응답하라. 설명 텍스트, 코드블록(\`\`\`), 주석을 절대 포함하지 마라. 첫 글자 { 마지막 글자 }인 순수 JSON만 출력하라.\n\n`

  if (docType === "건보") {
    return base + `이 문서는 건강보험자격득실확인서이다.
"가입자구분"이 "직장가입자"인 항목만 추출하라.
지역가입자, 지역세대원, 지역세대주, 직장피부양자는 반드시 제외하라.
사업장명은 "사업장명칭" 컬럼에서 추출하라.
자격취득일이 시작일, 자격상실일이 종료일이다. 상실일이 없으면 현재(2026-01)로 표기.

JSON 형식:
{
  "name": "성명",
  "sources": {
    "건보": [{ "company": "사업장명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "", "workDays": 0 }],
    "고용산재": [], "소득금액": [], "연금": []
  },
  "dailyEntries": []
}`
  }

  if (docType === "고용산재_상용") {
    return base + `이 문서는 고용보험 자격이력내역서이다.
비고가 "근로자"인 항목을 모두 추출하라.
직종명(코드), 사업장명, 취득일/전근일(시작), 상실일(종료)을 추출한다.
상실일이 없으면 현재(2026-01)로 표기.
직종 코드가 있으면 jobType에 포함하라.

JSON 형식:
{
  "name": "성명",
  "sources": {
    "고용산재": [{ "company": "사업장명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "직종명(코드)", "workDays": 0 }],
    "건보": [], "소득금액": [], "연금": []
  },
  "dailyEntries": []
}`
  }

  if (docType === "일용직") {
    return base + `이 문서는 고용보험 일용근로노무제공내역서이다.
문서에 나와있는 모든 행을 그대로 추출하라. 합산하거나 묶지 마라.
각 행의 사업장명, 직종명, 근무일수(비고란의 숫자들의 개수 또는 명시된 일수)를 그대로 추출한다.
사업장명에 [업체명] 형태가 있으면 [] 안의 업체명을 company로 사용하라.
근무일수는 비고란에 있는 날짜 숫자들의 개수를 세어라. 예: '1,2,3,4,5' → 5일.
startYear/startMonth는 해당 행의 연월.
convertedMonths = Math.ceil(totalDays / 20).

JSON 형식:
{
  "name": "성명",
  "sources": { "고용산재": [], "건보": [], "소득금액": [], "연금": [] },
  "dailyEntries": [
    { "company": "사업장명", "jobType": "직종명", "totalDays": 5, "startYear": 2013, "startMonth": 1, "convertedMonths": 1, "source": "고용산재", "memo": "" }
  ]
}`
  }

  if (docType === "연금") {
    return base + `이 문서는 국민연금 가입증명 또는 가입내역확인서이다.
사업장취득/사업장사용관계종결 이벤트에서 사업장명과 기간을 추출하라.
"사업장 명칭 변경 내역"이 있으면 최신 명칭으로 통일하라.
지역가입자 구간은 제외하라.
가입자격취득일이 시작일, 사업장사용관계종결일이 종료일이다.

JSON 형식:
{
  "name": "성명",
  "sources": {
    "연금": [{ "company": "사업장명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "", "workDays": 0 }],
    "고용산재": [], "건보": [], "소득금액": []
  },
  "dailyEntries": []
}`
  }

  if (docType === "건근공") {
    return base + `이 문서는 건설근로자공제회 내역서이다.
사업장별로 총 근무일수를 합산하라. 변환 기준: 20일=1개월.
convertedMonths = Math.ceil(totalDays / 20).

JSON 형식:
{
  "name": "성명",
  "sources": { "고용산재": [], "건보": [], "소득금액": [], "연금": [] },
  "dailyEntries": [
    { "company": "사업장명", "jobType": "건설일용직", "totalDays": 60, "startYear": 2013, "startMonth": 1, "convertedMonths": 3, "source": "건근공", "memo": "" }
  ]
}`
  }

  if (docType === "경력증명서") {
    return base + `이 문서는 경력증명서 또는 재직증명서이다.
회사명(사업장명), 재직기간(입사일~퇴사일), 직위/직종을 추출하라.
퇴사일이 없거나 재직중이면 현재(2026-01)로 표기.
입사일이 시작일, 퇴사일이 종료일이다.

JSON 형식:
{
  "name": "성명",
  "sources": {
    "고용산재": [{ "company": "사업장명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "직위/직종", "workDays": 0 }],
    "건보": [], "소득금액": [], "연금": []
  },
  "dailyEntries": []
}`
  }

  // fallback
  return base + `이 문서에서 직업력 이력을 추출하라.
JSON 형식:
{
  "name": "성명",
  "sources": {
    "고용산재": [], "건보": [], "소득금액": [], "연금": []
  },
  "dailyEntries": []
}`
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

    const SIZE_LIMIT = 3 * 1024 * 1024
    const CHUNK_PAGES = 5
    const pdfContents: { name: string; base64: string; docType: string }[] = []

    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx]
      const docType = docTypes[fileIdx] ?? ""
      const buffer = await file.arrayBuffer()
      if (buffer.byteLength <= SIZE_LIMIT) {
        pdfContents.push({ name: file.name, base64: Buffer.from(buffer).toString("base64"), docType })
      } else {
        const srcDoc = await PDFDocument.load(buffer)
        const totalPages = srcDoc.getPageCount()
        const STEP = CHUNK_PAGES - 1
        for (let start = 0; start < totalPages; start += STEP) {
          const end = Math.min(start + CHUNK_PAGES, totalPages)
          const chunkDoc = await PDFDocument.create()
          const pageIndices = Array.from({ length: end - start }, (_, i) => start + i)
          const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices)
          copiedPages.forEach((p) => chunkDoc.addPage(p))
          const chunkBytes = await chunkDoc.save()
          pdfContents.push({
            name: `${file.name} (p${start + 1}-${end})`,
            base64: Buffer.from(chunkBytes).toString("base64"),
            docType,
          })
        }
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 })

    const mergedSources: Record<string, unknown[]> = {
      고용산재: [],
      건보: [],
      소득금액: [],
      연금: [],
    }
    const allDailyEntries: unknown[] = []
    let extractedName = ""

    for (let pdfIdx = 0; pdfIdx < pdfContents.length; pdfIdx++) {
      const pdf = pdfContents[pdfIdx]
      const promptText = getPromptForDocType(pdf.docType)
      const userContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdf.base64,
          },
        },
        { type: "text", text: promptText },
      ]

      const claudeRes = await callClaudeWithRetry(
        {
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [{ role: "user", content: userContent }],
        },
        apiKey
      )

      if (!claudeRes.ok) {
        const err = await claudeRes.text()
        console.error(`Claude API error (${pdf.name}):`, err)
        continue // 에러 시 해당 파일 스킵하고 계속 진행
      }

      const claudeData = await claudeRes.json()
      const rawText = claudeData.content?.[0]?.text ?? ""

      let parsed: { name?: string; sources: Record<string, unknown[]>; dailyEntries?: unknown[] }
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error("JSON not found")
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        console.error(`JSON parse error (${pdf.name}):`, rawText)
        continue // 파싱 실패 시 스킵
      }

      if (parsed.name && !extractedName) extractedName = parsed.name

      for (const key of ["고용산재", "건보", "소득금액", "연금"] as const) {
        if (parsed.sources?.[key]?.length > 0) {
          mergedSources[key] = mergedSources[key].concat(parsed.sources[key])
        }
      }

      if (parsed.dailyEntries?.length) {
        allDailyEntries.push(...parsed.dailyEntries)
      }

      if (pdfIdx < pdfContents.length - 1) {
        await new Promise((r) => setTimeout(r, 15000))
      }
    }

    await prisma.case.update({
      where: { id: caseId },
      data: {
        workHistoryRaw: mergedSources as object,
      },
    })

    return NextResponse.json({
      success: true,
      sources: mergedSources,
      dailyEntries: allDailyEntries,
      name: extractedName,
    })
  } catch (err) {
    console.error("Unhandled error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
