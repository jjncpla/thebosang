import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseSpecialClinicMessage, type TfOrg } from "@/lib/parse-special-clinic-message"
import { parseTelegramHtml } from "@/lib/parse-telegram-html"
import { canonicalizeTfName } from "@/lib/tf-normalize"
import { NextRequest, NextResponse } from "next/server"

/**
 * Telegram Desktop Export HTML 파일을 업로드받아 과거 특진/재특진 일정을 일괄 등록.
 * 중복(patientName + tfName + clinicType + examRound 동일)은 스킵.
 * TF 정보가 없는 메시지(구식 포맷)는 DB 환자명 매칭으로 TF 추론 → 실패 시 'Legacy'.
 * 파일 1개 기준 요청 (프론트가 여러 파일을 순차 호출).
 */
export const maxDuration = 300
export const runtime = 'nodejs'

const LEGACY_TF = 'Legacy'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const file = formData.get('file')
  const tfOrgRaw = formData.get('tfOrg')
  const tfOrg: TfOrg = tfOrgRaw === '이산' ? '이산' : tfOrgRaw === '더보상' ? '더보상' : 'neutral'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필수 (multipart/form-data)" }, { status: 400 })
  }

  const html = await file.text()
  const messages = parseTelegramHtml(html)

  // 필터: 난청 + 특진/재특진 + 일정
  const filtered = messages
    .filter(m =>
      m.text.includes('난청') &&
      (m.text.includes('특진') || m.text.includes('재특진')) &&
      m.text.includes('일정')
    )
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))

  // 1차 pass: 파싱
  type ParsedWithMeta = {
    msg: typeof filtered[number]
    parsed: ReturnType<typeof parseSpecialClinicMessage>
  }
  const allParsed: ParsedWithMeta[] = []
  let parseFailures = 0

  for (const msg of filtered) {
    const msgDate = msg.date ?? new Date()
    const parsed = parseSpecialClinicMessage(msg.text, msg.senderName, msgDate, { tfOrg })
    const valid = parsed.filter(p => p.patientName) // 환자명만 있으면 일단 대상
    if (valid.length === 0) {
      parseFailures++
      continue
    }
    allParsed.push({ msg, parsed: valid })
  }

  // DB 환자명 매칭 준비: TF 없는 환자들만 모아서 한번에 조회
  const missingTfNames = new Set<string>()
  for (const { parsed } of allParsed) {
    for (const p of parsed) {
      if (!p.tfName) missingTfNames.add(p.patientName)
    }
  }

  const nameToTfMap = new Map<string, string>()
  if (missingTfNames.size > 0) {
    const patients = await prisma.patient.findMany({
      where: { name: { in: [...missingTfNames] } },
      include: {
        cases: {
          select: { tfName: true },
          where: { tfName: { not: null } },
        },
      },
    })
    // 동명이인 카운트: 같은 이름 환자 1명일 때만 TF 자동 매핑 신뢰
    const nameCount = new Map<string, number>()
    for (const p of patients) nameCount.set(p.name, (nameCount.get(p.name) ?? 0) + 1)
    for (const p of patients) {
      if (nameCount.get(p.name) !== 1) continue // 동명이인은 애매 → Legacy
      const tf = p.cases.find(c => c.tfName)?.tfName
      if (tf) nameToTfMap.set(p.name, tf)
    }
  }

  let savedNew = 0
  let skippedDuplicate = 0
  let legacyTagged = 0
  let dbMatched = 0

  for (const { msg, parsed } of allParsed) {
    const msgDate = msg.date ?? new Date()
    for (const p of parsed) {
      if (!p.patientName) { parseFailures++; continue }

      let tfName = p.tfName
      if (!tfName) {
        const dbTf = nameToTfMap.get(p.patientName)
        if (dbTf) {
          tfName = canonicalizeTfName(dbTf) || dbTf
          dbMatched++
        } else {
          tfName = LEGACY_TF
          legacyTagged++
        }
      } else {
        // 파서가 이미 canonical을 반환하지만, DB 매칭 TF도 동일 규칙 적용 위해 한 번 더 정규화
        tfName = canonicalizeTfName(tfName) || tfName
      }

      const existing = await prisma.specialClinicSchedule.findFirst({
        where: {
          patientName: p.patientName,
          tfName,
          clinicType: p.clinicType,
          examRound: p.examRound,
        },
        select: { id: true },
      })

      if (existing) {
        skippedDuplicate++
        continue
      }

      await prisma.specialClinicSchedule.create({
        data: {
          patientName: p.patientName,
          tfName,
          hospitalName: p.hospitalName,
          clinicType: p.clinicType,
          category: p.clinicType,
          examRound: p.examRound,
          scheduledDate: p.scheduledDate,
          isAllDay: p.isAllDay,
          scheduledHour: p.scheduledHour ?? null,
          scheduledMinute: p.scheduledMinute ?? 0,
          status: p.status,
          memo: p.memo || null,
          sender: msg.senderName,
          sourceDate: msgDate,
          rawMessage: msg.text,
        },
      })
      savedNew++
    }
  }

  return NextResponse.json({
    ok: true,
    file: file.name,
    stats: {
      totalMessages: messages.length,
      filtered: filtered.length,
      savedNew,
      skippedDuplicate,
      parseFailures,
      dbMatched,      // DB 환자명 매칭으로 TF 보완된 건수
      legacyTagged,   // TF 없어서 Legacy로 저장된 건수
    },
  })
}
