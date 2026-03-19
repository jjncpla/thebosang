import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { caseId } = await params

  const formData = await req.formData()
  const files = formData.getAll("files") as File[]

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
  }

  const pdfContents: { name: string; base64: string }[] = []
  for (const file of files) {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    pdfContents.push({ name: file.name, base64 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 })

  const userContent: unknown[] = []

  for (const pdf of pdfContents) {
    userContent.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdf.base64,
      },
    })
  }

  userContent.push({
    type: "text",
    text: `첨부된 PDF 문서들을 분석하여 직업력 정보를 추출해주세요.
각 문서는 고용산재보험 가입내역 / 건강보험 직장가입 내역 / 소득금액증명원 / 연금 가입내역 등입니다. 문서 종류를 자동으로 판별하고, 각 문서에서 근무 이력을 최대한 완전하게 추출하세요.

재해자의 이름도 함께 추출해 주세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 일절 하지 마세요.

{
  "name": "재해자이름",
  "sources": {
    "고용산재": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "" }
    ],
    "건보": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "" }
    ],
    "소득금액": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "" }
    ],
    "연금": [
      { "company": "회사명", "startYear": 2000, "startMonth": 1, "endYear": 2005, "endMonth": 12, "department": "", "jobType": "" }
    ]
  }
}

규칙:
1. 문서 종류에 따라 해당 sources 키에만 넣으세요
2. 문서에 없는 종류는 빈 배열 []로 두세요
3. 재직 중인 경우 endYear/endMonth는 현재 날짜(2026년 1월) 기준으로 입력하세요
4. startYear/endYear는 4자리 숫자, startMonth/endMonth는 1~12 정수
5. 이름을 찾을 수 없으면 name을 빈 문자열로 두세요`,
  })

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: userContent }],
    }),
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.text()
    console.error("Claude API error:", err)
    return NextResponse.json({ error: "AI 분석 오류" }, { status: 500 })
  }

  const claudeData = await claudeRes.json()
  const rawText = claudeData.content?.[0]?.text ?? ""

  let parsed: {
    name?: string
    sources: Record<string, unknown[]>
  }
  try {
    const cleaned = rawText.replace(/```json|```/g, "").trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error("JSON parse error:", rawText)
    return NextResponse.json({ error: "응답 파싱 오류", raw: rawText }, { status: 500 })
  }

  const caseWithDetail = await prisma.case.findUnique({
    where: { id: caseId },
    include: { hearingLoss: true },
  })

  if (!caseWithDetail?.hearingLoss) {
    return NextResponse.json({ error: "사건 정보를 찾을 수 없습니다" }, { status: 404 })
  }

  await prisma.hearingLossDetail.update({
    where: { caseId },
    data: {
      workHistoryRaw: parsed.sources as object,
    },
  })

  return NextResponse.json({
    success: true,
    sources: parsed.sources,
    name: parsed.name,
  })
}
