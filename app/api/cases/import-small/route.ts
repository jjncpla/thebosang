import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

type Row = {
  rowNum: number
  name: string
  ssn: string
  phone: string | null
  referrer: string | null
  memo: string | null
  bigWorkplace: string | null
}

type ImportError = { row: number; name: string; message: string }

function normalizeSsn(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).replace(/\s/g, '').trim()
  if (!s) return null
  if (/^\d{6}-\d{7}$/.test(s)) return s
  const digits = s.replace(/\D/g, '')
  if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`
  return null
}

function strVal(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

// 헤더 행 자동 탐지: 첫 10행 내 "성명"+"주민번호" 포함 행을 헤더로 사용
function detectHeader(matrix: unknown[][]): { headerIdx: number; cols: Record<string, number> } | null {
  const max = Math.min(matrix.length, 10)
  for (let i = 0; i < max; i++) {
    const row = (matrix[i] || []).map((c) => String(c ?? '').trim())
    const hasName = row.some((c) => c === '성명')
    const hasSsn = row.some((c) => c === '주민번호' || c === '주민등록번호')
    if (hasName && hasSsn) {
      const find = (...needles: string[]) =>
        row.findIndex((c) => needles.some((n) => c === n || c.includes(n)))
      return {
        headerIdx: i,
        cols: {
          seq: find('연번', '번호'),
          name: row.indexOf('성명'),
          ssn: row.findIndex((c) => c === '주민번호' || c === '주민등록번호'),
          phone: find('연락처', '전화'),
          referrer: find('소개자', '영업담당자'),
          memo: find('비고'),
          bigWorkplace: find('대형사업장', '대형 사업장'),
        },
      }
    }
  }
  return null
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const tfName = (formData.get('tfName') as string | null)?.trim() || ''
  const branch = (formData.get('branch') as string | null)?.trim() || ''
  const dryRun = formData.get('dryRun') === 'true'
  const skipDuplicates = formData.get('skipDuplicates') !== 'false'

  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  if (!tfName) return NextResponse.json({ error: 'TF를 선택해주세요.' }, { status: 400 })
  if (!branch) return NextResponse.json({ error: '지사 정보가 없습니다.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  // 파싱: 첫 번째 데이터 시트(행 수가 가장 많은 시트) 사용
  let bestSheet: string | null = null
  let bestRows: unknown[][] = []
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false })
    if (rows.length > bestRows.length) {
      bestSheet = name
      bestRows = rows
    }
  }

  if (!bestSheet) {
    return NextResponse.json({ error: '유효한 시트를 찾을 수 없습니다.' }, { status: 400 })
  }

  const detected = detectHeader(bestRows)
  if (!detected) {
    return NextResponse.json(
      { error: "헤더 행을 찾을 수 없습니다. '성명', '주민번호' 컬럼이 포함된 행이 필요합니다." },
      { status: 400 }
    )
  }

  const { headerIdx, cols } = detected

  const parsed: Row[] = []
  const parseErrors: ImportError[] = []

  for (let i = headerIdx + 1; i < bestRows.length; i++) {
    const r = bestRows[i] || []
    const name = strVal(r[cols.name])
    if (!name) continue // 성명 없는 행은 조용히 스킵 (빈 줄)

    const rowNum = i + 1
    const ssn = normalizeSsn(r[cols.ssn])
    if (!ssn) {
      parseErrors.push({ row: rowNum, name, message: `주민번호 형식 오류: ${r[cols.ssn] ?? '(비어있음)'}` })
      continue
    }

    parsed.push({
      rowNum,
      name,
      ssn,
      phone: cols.phone >= 0 ? strVal(r[cols.phone]) : null,
      referrer: cols.referrer >= 0 ? strVal(r[cols.referrer]) : null,
      memo: cols.memo >= 0 ? strVal(r[cols.memo]) : null,
      bigWorkplace: cols.bigWorkplace >= 0 ? strVal(r[cols.bigWorkplace]) : null,
    })
  }

  const result = {
    sheet: bestSheet,
    total: parsed.length,
    success: 0,
    skipped: 0,
    errors: [...parseErrors] as ImportError[],
    dryRun,
    preview: parsed.slice(0, 10).map((r) => ({
      name: r.name,
      ssn: r.ssn,
      phone: r.phone,
      referrer: r.referrer,
      bigWorkplace: r.bigWorkplace,
      memo: r.memo,
    })),
  }

  for (const row of parsed) {
    try {
      let patient = await prisma.patient.findUnique({ where: { ssn: row.ssn } })

      if (patient && skipDuplicates) {
        const existingCase = await prisma.case.findFirst({
          where: { patientId: patient.id, caseType: 'HEARING_LOSS' },
        })
        if (existingCase) {
          result.skipped++
          continue
        }
      }

      if (dryRun) {
        result.success++
        continue
      }

      if (!patient) {
        patient = await prisma.patient.create({
          data: { name: row.name, ssn: row.ssn, phone: row.phone },
        })
      } else if (row.phone && !patient.phone) {
        patient = await prisma.patient.update({
          where: { id: patient.id },
          data: { phone: row.phone },
        })
      }

      const memoParts: string[] = []
      if (row.bigWorkplace) memoParts.push(`대형사업장: ${row.bigWorkplace}`)
      if (row.memo) memoParts.push(row.memo)
      const combinedMemo = memoParts.join(' | ') || null

      await prisma.case.create({
        data: {
          patientId: patient.id,
          caseType: 'HEARING_LOSS',
          status: 'CONSULTING', // = 접수 대기
          branch,
          tfName,
          salesRoute: row.referrer,
          memo: combinedMemo,
          hearingLoss: { create: {} },
        },
      })

      result.success++
    } catch (e) {
      result.errors.push({
        row: row.rowNum,
        name: row.name,
        message: String(e instanceof Error ? e.message : e).slice(0, 160),
      })
    }
  }

  return NextResponse.json(result)
}
