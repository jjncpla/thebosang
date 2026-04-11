import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

const CASE_TYPE_MAP: Record<string, string> = {
  '소음성난청': 'HEARING_LOSS',
  '소음': 'HEARING_LOSS',
  '난청': 'HEARING_LOSS',
  'COPD': 'COPD',
  'copd': 'COPD',
  '진폐': 'PNEUMOCONIOSIS',
  '진폐최초': 'PNEUMOCONIOSIS',
  '근골격계': 'MUSCULOSKELETAL',
  '근골': 'MUSCULOSKELETAL',
  '폐암': 'OCCUPATIONAL_CANCER',
  '안구재해': 'OCCUPATIONAL_ACCIDENT',
  '기타': 'OCCUPATIONAL_ACCIDENT',
}

const SHEET_TO_CASE_TYPE: Record<string, string> = {
  '소음성난청': 'HEARING_LOSS',
  '진폐최초': 'PNEUMOCONIOSIS',
  'COPD': 'COPD',
  '근골격계': 'MUSCULOSKELETAL',
  '기타': 'OCCUPATIONAL_ACCIDENT',
  '폐암': 'OCCUPATIONAL_CANCER',
  '안구재해': 'OCCUPATIONAL_ACCIDENT',
}

const STATUS_MAP: Record<string, string> = {
  '상담': 'CONSULTING',
  '상담중': 'CONSULTING',
  '약정': 'CONTRACTED',
  '약정완료': 'CONTRACTED',
  '자료수집': 'DOC_COLLECTING',
  '자료': 'DOC_COLLECTING',
  '접수': 'SUBMITTED',
  '접수완료': 'SUBMITTED',
  '접수대기': 'SUBMITTED',
  '특진요구서': 'EXAM_REQUESTED',
  '특진요구': 'EXAM_REQUESTED',
  '특진': 'IN_EXAM',
  '특진완료': 'EXAM_DONE',
  '전문조사': 'EXPERT_REQUESTED',
  '전문': 'EXPERT_REQUESTED',
  '결정': 'DECISION_RECEIVED',
  '결정수령': 'DECISION_RECEIVED',
  '승인': 'CLOSED',
  '불승인': 'CLOSED',
  '이의제기': 'OBJECTION',
  '종결': 'CLOSED',
  '파기': 'CLOSED',
  '취하': 'CLOSED',
  '취소': 'CLOSED',
  '포기': 'CLOSED',
  '사망': 'CLOSED',
  '소천': 'CLOSED',
  '보류': 'CONSULTING',
  '수치미달': 'CLOSED',
  '반려': 'CLOSED',
}

const BRANCH = '더보상 울산동부지사'

const parseDate = (val: any): Date | null => {
  if (!val) return null
  try {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  } catch { return null }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || !['ADMIN', 'SENIOR_MANAGER'].includes(session.user?.role || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  const sheetsRaw = formData.get('sheets') as string
  const targetSheets: string[] = JSON.parse(sheetsRaw || '[]')
  const dryRun = formData.get('dryRun') === 'true'
  const skipDuplicates = formData.get('skipDuplicates') !== 'false'

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const results = {
    total: 0,
    success: 0,
    skipped: 0,
    errors: [] as { row: number; name: string; message: string }[],
    dryRun,
  }

  for (const sheetName of targetSheets) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    // range: 1 → 1행(병합셀 타이틀) 스킵, 2행을 헤더로 사용
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false,
      range: 1,
    }) as Record<string, any>[]

    // 성명 없는 빈 행 제거
    const validRows = rows.filter(r => r['성명']?.toString().trim())
    results.total += validRows.length

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const rowNum = i + 3
      const name = row['성명']?.toString().trim()
      const ssnRaw = row['주민번호']?.toString().replace(/\s/g, '') || ''
      const ssn = ssnRaw.replace('-', '')

      try {
        if (!name) {
          results.errors.push({ row: rowNum, name: '(없음)', message: '성명 누락' })
          continue
        }
        if (!ssn || ssn.length < 7) {
          results.errors.push({ row: rowNum, name, message: `주민번호 오류: ${ssnRaw}` })
          continue
        }

        // 중복 확인
        if (skipDuplicates) {
          const existing = await prisma.patient.findFirst({
            where: { ssn: { startsWith: ssn.slice(0, 6) }, name }
          })
          if (existing) {
            results.skipped++
            continue
          }
        }

        if (!dryRun) {
          const caseTypeRaw = row['사건종류']?.toString().trim() || sheetName
          const caseType = CASE_TYPE_MAP[caseTypeRaw] || SHEET_TO_CASE_TYPE[sheetName] || 'HEARING_LOSS'
          const statusRaw = row['진행경과']?.toString().trim() || row['진행상황']?.toString().trim() || ''
          const status = STATUS_MAP[statusRaw] || 'CONSULTING'

          const patient = await prisma.patient.upsert({
            where: { ssn },
            create: {
              name,
              ssn,
              phone: row['연락처']?.toString() || null,
              address: row['주소']?.toString() || null,
            },
            update: {},
          })

          await prisma.case.create({
            data: {
              patientId: patient.id,
              caseType: caseType as any,
              status: status as any,
              branch: BRANCH,
              tfName: null,
              salesRoute: (row['영업 담당자(소개자)'] || row['영업 담당자'] || row['소개자(영업자)'])?.toString() || null,
              memo: [row['비고'], row['영업경로'] && row['영업경로'] !== '0' ? `영업경로: ${row['영업경로']}` : null]
                .filter(Boolean).join(' | ') || null,
              contractDate: parseDate(row['약정일자']),
              ...(caseType === 'HEARING_LOSS' ? {
                hearingLoss: { create: {} }
              } : {}),
            }
          })
        }

        results.success++
      } catch (e) {
        results.errors.push({ row: rowNum, name: name || '?', message: String(e).slice(0, 120) })
      }
    }
  }

  return NextResponse.json(results)
}
