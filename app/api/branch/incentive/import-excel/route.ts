import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// 월말보고 엑셀(FILE2) 임포트
//  - {분기}분기 시트: 재해자별 담당자·배분비율
//     · 재해자+month로 SettlementRecord(이미 FILE1 임포트로 존재)에 매칭
//     · reportAssignee(담당자) / isBranchOwned(담당자가 '더보상'으로 시작) / allocations 만 갱신
//     · grossAmount·salesStaff·settlementStaff 는 건드리지 않음
//  - 합계 시트: 직원별 개인/지사/자차보조금/평가, 전년도 이월금 → BranchIncentiveSummary upsert

const INTERNAL_STAFF = new Set(['이정준', '이환주', '김수진', '문유빈', '김영은'])

type QuarterParsed = {
  rowNum: number | null
  month: number
  victimName: string
  caseType: string
  assignee: string
  grossWithVAT: number
  allocations: { staffName: string; ratio: number; amount: number }[]
  memo: string | null
}

function cellStr(v: unknown) {
  return String(v ?? '').trim()
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i]
    if (!r) continue
    // '연번'이 어느 칸에든 있으면 헤더 행
    if (r.some(v => cellStr(v) === '연번')) return i
  }
  return -1
}

// 헤더 행에서 직원명 컬럼 위치를 동적으로 감지 (ratio 컬럼 인덱스만 저장)
function buildStaffCols(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {}
  const skip = new Set(['연번', '정산월', '재해자', '사건', '담당자', '정산액', '공제', '합계', '비율', '비고'])
  headerRow.forEach((v, idx) => {
    const s = cellStr(v)
    if (!s) return
    // 스킵 키워드가 포함된 컬럼은 헤더 메타 컬럼
    if ([...skip].some(k => s.includes(k))) return
    // 한글 이름 패턴만 (2~5자)
    if (/^[가-힣]{2,5}$/.test(s)) map[s] = idx
  })
  return map
}

function parseQuarterSheet(ws: XLSX.WorkSheet): {
  rows: QuarterParsed[]
  staffCols: Record<string, number>
} | { error: string } {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  const headerIdx = findHeaderRow(rows)
  if (headerIdx < 0) return { error: '헤더행(연번)을 찾을 수 없습니다' }
  const header = rows[headerIdx] as unknown[]
  const colSeq   = header.findIndex(v => cellStr(v) === '연번')
  const colMonth = header.findIndex(v => cellStr(v) === '정산월')
  const colVictim= header.findIndex(v => cellStr(v) === '재해자')
  const colCase  = header.findIndex(v => cellStr(v) === '사건')
  const colAssign= header.findIndex(v => cellStr(v) === '담당자')
  const colGross = header.findIndex(v => cellStr(v).includes('정산액') && cellStr(v).includes('포함'))
  const colMemo  = header.findIndex(v => cellStr(v) === '비고')
  const staffCols = buildStaffCols(header)

  if (colMonth < 0 || colVictim < 0 || colGross < 0) {
    return { error: `필수 컬럼 누락 (정산월=${colMonth}, 재해자=${colVictim}, 정산액=${colGross})` }
  }

  const parsed: QuarterParsed[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const victimName = cellStr(r[colVictim])
    if (!victimName) continue
    const monthStr = cellStr(r[colMonth]).replace('월', '')
    const month = parseInt(monthStr)
    if (!month || month < 1 || month > 12) continue
    const grossWithVAT = Number(r[colGross]) || 0

    const allocations: QuarterParsed['allocations'] = []
    for (const [staffName, rCol] of Object.entries(staffCols)) {
      const ratio = Number(r[rCol]) || 0
      if (ratio > 0 && ratio <= 100) {
        const amt = Number(r[rCol + 1]) || 0
        allocations.push({ staffName, ratio, amount: amt })
      }
    }
    // 비율 합계가 100 초과면 잘못 파싱된 행 — 금액 컬럼을 ratio로 오독한 경우
    const ratioSum = allocations.reduce((s, a) => s + a.ratio, 0)
    if (ratioSum > 100) continue

    parsed.push({
      rowNum: colSeq >= 0 ? (Number(r[colSeq]) || null) : null,
      month,
      victimName,
      caseType: cellStr(r[colCase]),
      assignee: cellStr(r[colAssign]),
      grossWithVAT,
      allocations,
      memo: colMemo >= 0 ? (cellStr(r[colMemo]) || null) : null,
    })
  }
  return { rows: parsed, staffCols }
}

type SummaryRow = {
  staffName: string
  personalIncentive: number
  branchIncentive: number
  carAllowance: number
  totalIncentive: number
  roundedIncentive: number
  quarterlyGrade: string | null
  semiAnnualGrade: string | null
}

function parseSummarySheet(ws: XLSX.WorkSheet | undefined): {
  carryOver: number
  staffRows: SummaryRow[]
} {
  if (!ws) return { carryOver: 0, staffRows: [] }
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  // 전년도 이월금 — '이월' 포함된 셀의 숫자 추출
  let carryOver = 0
  for (const r of rows) {
    if (!r) continue
    for (const v of r) {
      const s = cellStr(v)
      if (!s.includes('이월')) continue
      const m = s.match(/([\d,]+)/g)
      if (m && m.length > 0) {
        carryOver = parseInt(m[m.length - 1].replace(/,/g, '')) || 0
      }
    }
  }

  // 헤더 행 찾기 — '개인','지사','자차보조금','합계' 키워드가 있는 행
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const joined = r.map(cellStr).join('|')
    if (joined.includes('개인') && joined.includes('지사') && joined.includes('자차')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) return { carryOver, staffRows: [] }
  const header = rows[headerIdx] as unknown[]
  const colPersonal = header.findIndex(v => cellStr(v) === '개인')
  const colBranch   = header.findIndex(v => cellStr(v) === '지사')
  const colCar      = header.findIndex(v => cellStr(v).includes('자차'))
  const colTotal    = header.findIndex(v => cellStr(v) === '합계')
  const colRound    = header.findIndex(v => cellStr(v) === '절사')
  const colQuarter  = header.findIndex(v => cellStr(v).includes('분기평가'))
  const colSemi     = header.findIndex(v => cellStr(v).includes('반기평가'))

  const staffRows: SummaryRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    // 이름은 헤더의 '개인' 바로 왼쪽 칸
    const nameCol = Math.max(0, colPersonal - 1)
    const staffName = cellStr(r[nameCol])
    if (!staffName || staffName.length > 5 || !/^[가-힣]{2,5}$/.test(staffName)) continue
    staffRows.push({
      staffName,
      personalIncentive: Math.round(Number(r[colPersonal]) || 0),
      branchIncentive:   Math.round(Number(r[colBranch])   || 0),
      carAllowance:      Math.round(Number(r[colCar])      || 0),
      totalIncentive:    Math.round(Number(r[colTotal])    || 0),
      roundedIncentive:  Math.round(Number(r[colRound])    || 0),
      quarterlyGrade:    colQuarter >= 0 ? (cellStr(r[colQuarter]) || null) : null,
      semiAnnualGrade:   colSemi    >= 0 ? (cellStr(r[colSemi])    || null) : null,
    })
  }
  return { carryOver, staffRows }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const branchName = (formData.get('branchName') as string) || '울산지사'
    const year = parseInt((formData.get('year') as string) || '2026')
    const quarter = parseInt((formData.get('quarter') as string) || '1')
    const dryRun = formData.get('dryRun') === 'true'

    if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })

    const sheetName = `${quarter}분기`
    const ws = wb.Sheets[sheetName]
    if (!ws) return NextResponse.json({
      error: `${sheetName} 시트 없음. 있는 시트: ${wb.SheetNames.join(', ')}`
    }, { status: 400 })

    const parsedResult = parseQuarterSheet(ws)
    if ('error' in parsedResult) return NextResponse.json({ error: parsedResult.error }, { status: 400 })
    const { rows: parsed, staffCols } = parsedResult

    const summary = parseSummarySheet(wb.Sheets['합계'])

    if (dryRun) {
      // 미리보기: 매칭 여부 확인
      const expectedMonths = [(quarter - 1) * 3 + 1, (quarter - 1) * 3 + 2, (quarter - 1) * 3 + 3]
      const existing = await prisma.settlementRecord.findMany({
        where: { branchName, year, month: { in: expectedMonths } },
        select: { id: true, month: true, victimName: true, grossAmount: true },
      })
      const matched: typeof parsed = []
      const unmatched: typeof parsed = []
      for (const p of parsed) {
        const hit = existing.find(e => e.month === p.month && e.victimName === p.victimName)
        if (hit) matched.push(p); else unmatched.push(p)
      }
      return NextResponse.json({
        dryRun: true,
        parsedCount: parsed.length,
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        unmatched: unmatched.slice(0, 20),
        detectedStaff: Object.keys(staffCols),
        summary,
      })
    }

    // 실제 DB 반영
    let recordsUpdated = 0
    let allocationsCreated = 0
    let unmatchedCount = 0
    const errors: string[] = []
    const unmatched: { month: number; victimName: string }[] = []

    for (const row of parsed) {
      try {
        // victim + month로 매칭 (grossAmount는 동일 재해자 복수건 대비 후순위 보조 기준)
        const candidates = await prisma.settlementRecord.findMany({
          where: { branchName, year, month: row.month, victimName: row.victimName },
          include: { allocations: true },
        })
        let rec = null
        if (candidates.length === 1) {
          rec = candidates[0]
        } else if (candidates.length > 1) {
          // grossAmount까지 일치하는 것 우선
          rec = candidates.find(c => c.grossAmount === row.grossWithVAT) ?? null
          // 아직도 결정 못 하면, 이미 allocation 있는 건 제외 후 첫 건
          if (!rec) rec = candidates.find(c => c.allocations.length === 0) ?? candidates[0]
        }
        if (!rec) {
          unmatched.push({ month: row.month, victimName: row.victimName })
          unmatchedCount++
          continue
        }

        // SettlementRecord에 reportAssignee / isBranchOwned / memo 만 갱신
        await prisma.settlementRecord.update({
          where: { id: rec.id },
          data: {
            reportAssignee: row.assignee || null,
            isBranchOwned: row.assignee.startsWith('더보상'),
            memo: row.memo || rec.memo,
          },
        })

        // 배분 내역 교체 (기존 삭제 후 재생성)
        await prisma.settlementAllocation.deleteMany({ where: { settlementRecordId: rec.id } })
        for (const a of row.allocations) {
          await prisma.settlementAllocation.create({
            data: {
              settlementRecordId: rec.id,
              staffName: a.staffName,
              ratio: a.ratio,
              isExternal: !INTERNAL_STAFF.has(a.staffName),
            },
          })
          allocationsCreated++
        }
        recordsUpdated++
      } catch (e) {
        errors.push(`${row.month}월 ${row.victimName}: ${(e as Error).message}`)
      }
    }

    // 합계 시트 → BranchIncentiveSummary upsert
    let summarySaved = false
    if (summary.staffRows.length > 0 || summary.carryOver > 0) {
      const existingSummary = await prisma.branchIncentiveSummary.findUnique({
        where: { branchName_year_quarter: { branchName, year, quarter } },
      })
      const summaryRec = existingSummary
        ? await prisma.branchIncentiveSummary.update({
            where: { id: existingSummary.id },
            data: { carryOverAmount: summary.carryOver },
          })
        : await prisma.branchIncentiveSummary.create({
            data: { branchName, year, quarter, carryOverAmount: summary.carryOver },
          })
      for (const s of summary.staffRows) {
        await prisma.branchIncentiveStaffSummary.upsert({
          where: { summaryId_staffName: { summaryId: summaryRec.id, staffName: s.staffName } },
          create: { summaryId: summaryRec.id, ...s },
          update: s,
        })
      }
      summarySaved = true
    }

    return NextResponse.json({
      ok: true,
      parsedCount: parsed.length,
      recordsUpdated,
      allocationsCreated,
      unmatchedCount,
      unmatched,
      summarySaved,
      detectedStaff: Object.keys(staffCols),
      errors: errors.slice(0, 10),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
