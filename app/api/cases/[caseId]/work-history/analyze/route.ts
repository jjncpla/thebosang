import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { PDFDocument } from "pdf-lib"

export const maxDuration = 300

async function callClaudeWithRetry(body: object, apiKey: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = 30000 * attempt // 30초, 60초, 90초
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

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
    }

    // 파일을 청크 단위 base64 배열로 변환 (3MB 초과 시 5페이지씩 분할)
    const SIZE_LIMIT = 3 * 1024 * 1024
    const CHUNK_PAGES = 5
    const pdfContents: { name: string; base64: string }[] = []

    for (const file of files) {
      const buffer = await file.arrayBuffer()
      if (buffer.byteLength <= SIZE_LIMIT) {
        pdfContents.push({ name: file.name, base64: Buffer.from(buffer).toString("base64") })
      } else {
        // pdf-lib로 5페이지씩 분할
        const srcDoc = await PDFDocument.load(buffer)
        const totalPages = srcDoc.getPageCount()
        for (let start = 0; start < totalPages; start += CHUNK_PAGES) {
          const end = Math.min(start + CHUNK_PAGES, totalPages)
          const chunkDoc = await PDFDocument.create()
          const pageIndices = Array.from({ length: end - start }, (_, i) => start + i)
          const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices)
          copiedPages.forEach((p) => chunkDoc.addPage(p))
          const chunkBytes = await chunkDoc.save()
          pdfContents.push({
            name: `${file.name} (p${start + 1}-${end})`,
            base64: Buffer.from(chunkBytes).toString("base64"),
          })
        }
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 })

    const PROMPT_TEXT = `[중요] 반드시 JSON만 응답하라. 코드블록(\`\`\`), 설명 텍스트, 주석, 부연 설명을 절대 포함하지 마라. 첫 글자가 { 이고 마지막 글자가 } 인 순수 JSON만 출력하라.

첨부된 PDF 문서를 분석하여 직업력 정보를 추출해주세요.
각 문서는 고용산재보험 가입내역 / 건강보험 직장가입 내역 / 소득금액증명원 / 연금 가입내역 등입니다. 문서 종류를 자동으로 판별하고, 각 문서에서 근무 이력을 최대한 완전하게 추출하세요.

재해자의 이름도 함께 추출해 주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 일절 하지 마세요.

{
  "name": "재해자이름",
  "sources": {
    "고용산재": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "", "workDays": 0 }
    ],
    "건보": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "", "workDays": 0 }
    ],
    "소득금액": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "", "workDays": 0 }
    ],
    "연금": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "", "workDays": 0 }
    ]
  }
}

규칙:
1. 문서 종류에 따라 해당 sources 키에만 넣으세요
2. 문서에 없는 종류는 빈 배열 []로 두세요
3. 재직 중인 경우 endYear/endMonth는 현재 날짜(2026년 1월) 기준으로 입력하세요
4. startYear/endYear는 4자리 숫자, startMonth/endMonth는 1~12 정수
5. 이름을 찾을 수 없으면 name을 빈 문자열로 두세요
6. 일용근로자(일용직)의 경우 동일 사업장별로 총 근무일수(workDays)를 합산해서 별도 필드로 포함한다.
   변환 공식: 20일 = 1개월, 220일 = 1년 (나머지 일수는 올림해서 개월로 변환)
   예: A사업장 총 45일 → 45/20 = 2.25개월 → 3개월로 올림
   일용직 항목은 startYear/startMonth는 최초 근무월, endYear/endMonth는 최후 근무월로 표기하되,
   workDays 필드에 실제 총 근무일수를 숫자로 기입한다.
   일용직이 아닌 경우 workDays는 0으로 기입.
7. 지역가입자, 지역세대원, 직장피부양자, 지역세대주는 직접 취업이력이 아니므로 반드시 제외한다.
8. 국민연금공단, 건강보험공단, 근로복지공단 등 공공기관 자체를 사업장으로 기재하지 않는다. 해당 기관에서 발급한 자료에서 실제 사업장명을 추출해야 한다.
9. 일용직의 경우 동일 연도 내 여러 사업장에서 근무한 경우 연도별로 대표 사업장명(가장 많이 근무한 곳)과 총 근무일수를 합산하여 한 줄로 표기한다.`

    // 각 PDF를 순차적으로 별도 요청
    const mergedSources: Record<string, unknown[]> = {
      고용산재: [], 건보: [], 소득금액: [], 연금: [],
    }
    let extractedName = ""

    for (let pdfIdx = 0; pdfIdx < pdfContents.length; pdfIdx++) {
      const pdf = pdfContents[pdfIdx]
      const userContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdf.base64,
          },
        },
        { type: "text", text: PROMPT_TEXT },
      ]

      const claudeRes = await callClaudeWithRetry({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: userContent }],
      }, apiKey)

      if (!claudeRes.ok) {
        const err = await claudeRes.text()
        console.error(`Claude API error (${pdf.name}):`, err)
        return NextResponse.json({ error: `AI 분석 오류 (${pdf.name})` }, { status: 500 })
      }

      const claudeData = await claudeRes.json()
      const rawText = claudeData.content?.[0]?.text ?? ""

      let parsed: { name?: string; sources: Record<string, unknown[]> }
      try {
        const jsonMatch = rawText.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/)
        if (!jsonMatch) {
          const start = rawText.indexOf("{")
          const end = rawText.lastIndexOf("}")
          if (start === -1 || end === -1) throw new Error("JSON not found")
          parsed = JSON.parse(rawText.slice(start, end + 1))
        } else {
          parsed = JSON.parse(jsonMatch[0])
        }
      } catch {
        console.error(`JSON parse error (${pdf.name}):`, rawText)
        return NextResponse.json({ error: `응답 파싱 실패 (${pdf.name})`, raw: rawText }, { status: 500 })
      }

      if (parsed.name && !extractedName) extractedName = parsed.name
      for (const key of ["고용산재", "건보", "소득금액", "연금"] as const) {
        if (parsed.sources?.[key]?.length > 0) {
          mergedSources[key] = mergedSources[key].concat(parsed.sources[key])
        }
      }

      if (pdfIdx < pdfContents.length - 1) {
        await new Promise((r) => setTimeout(r, 15000))
      }
    }

    const parsed = { name: extractedName, sources: mergedSources }

    // 일용직 근무기간 변환: workDays > 0인 경우 endYear/endMonth를 실제 일수 기준으로 재계산
    for (const sourceKey of Object.keys(parsed.sources)) {
      const entries = parsed.sources[sourceKey] as any[]
      parsed.sources[sourceKey] = entries.map((entry: any) => {
        const days = Number(entry.workDays ?? 0)
        if (days > 0) {
          const totalMonths = Math.ceil(days / 20)
          const startTotal = entry.startYear * 12 + (entry.startMonth - 1)
          const endTotal = startTotal + totalMonths - 1
          const endYear = Math.floor(endTotal / 12)
          const endMonth = (endTotal % 12) + 1
          return {
            ...entry,
            endYear,
            endMonth,
            jobType: entry.jobType ? `[일용직 ${days}일] ${entry.jobType}` : `[일용직 ${days}일]`,
          }
        }
        return entry
      })
    }

    await prisma.case.update({
      where: { id: caseId },
      data: {
        workHistoryRaw: parsed.sources as object,
      },
    })

    return NextResponse.json({
      success: true,
      sources: parsed.sources,
      name: parsed.name,
    })
  } catch (err) {
    console.error("Unhandled error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
