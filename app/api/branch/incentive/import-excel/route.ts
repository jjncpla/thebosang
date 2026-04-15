import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const STAFF_COLS: Record<string, [number, number]> = {
  '이정준': [11, 12], '이환주': [13, 14], '김경록': [15, 16],
  '허흔': [17, 18],   '조홍래': [19, 20], '김지수': [21, 22],
  '김슬기': [23, 24], '안수진': [25, 26], '문유빈': [27, 28],
  '김수진': [29, 30], '김영은': [31, 32],
}

const INTERNAL_STAFF = new Set(['이정준', '이환주', '김수진', '문유빈', '김영은'])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const branchName = (formData.get('branchName') as string) || '울산지사'
    const year = parseInt(formData.get('year') as string) || 2026
    const quarter = parseInt(formData.get('quarter') as string) || 1
    const dryRun = formData.get('dryRun') === 'true'

    if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })

    const sheetName = quarter + '분기'
    const ws = wb.Sheets[sheetName]
    if (!ws) return NextResponse.json({
      error: sheetName + ' 시트 없음. 있는 시트: ' + wb.SheetNames.join(', ')
    }, { status: 400 })

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

    // 헤더 행 찾기 (col1 === '연번')
    let headerIdx = -1
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][1] === '연번') { headerIdx = i; break }
    }
    if (headerIdx === -1) return NextResponse.json({ error: '헤더행 못찾음' }, { status: 400 })

    // 데이터 파싱
    const parsed: any[] = []
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      if (!r || typeof r[1] !== 'number') continue
      const monthStr = String(r[2] || '').replace('월', '').trim()
      const month = parseInt(monthStr) || 0
      const victimName = String(r[3] || '').trim()
      const caseType = String(r[4] || '').trim()
      const staffName = String(r[5] || '').trim()
      const grossWithVAT = Number(r[6]) || 0
      if (!victimName || !month) continue

      const allocations: any[] = []
      for (const [name, [rCol, aCol]] of Object.entries(STAFF_COLS)) {
        const ratio = Number(r[rCol]) || 0
        if (ratio > 0) allocations.push({ staffName: name, ratio, amount: Number(r[aCol]) || 0 })
      }

      parsed.push({ rowNum: r[1], month, victimName, caseType, staffName, grossWithVAT, allocations })
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        parsedCount: parsed.length,
        preview: parsed.slice(0, 5),
        allStaff: [...new Set(parsed.flatMap((p: any) => p.allocations.map((a: any) => a.staffName)))],
      })
    }

    // DB 업데이트
    let created = 0, updated = 0
    const errors: string[] = []

    for (const row of parsed) {
      try {
        let rec = await prisma.settlementRecord.findFirst({
          where: { branchName, year, month: row.month, victimName: row.victimName }
        })
        if (!rec) {
          rec = await prisma.settlementRecord.create({
            data: {
              branchName, year, month: row.month,
              paymentDate: new Date(year + '-' + String(row.month).padStart(2, '0') + '-01'),
              victimName: row.victimName, caseType: row.caseType,
              tfName: row.staffName.includes('더보상') ? row.staffName : '더보상울산',
              salesStaffName: row.staffName,
              settlementStaffName: row.staffName,
              grossAmount: row.grossWithVAT,
              deduction: 0,
            }
          })
          created++
        } else { updated++ }

        // 기존 allocation 삭제 후 재생성
        await prisma.settlementAllocation.deleteMany({ where: { settlementRecordId: rec.id } })
        for (const a of row.allocations) {
          await prisma.settlementAllocation.create({
            data: {
              settlementRecordId: rec.id,
              staffName: a.staffName,
              ratio: a.ratio,
              isExternal: !INTERNAL_STAFF.has(a.staffName),
            }
          })
        }
      } catch (e: any) {
        errors.push('행' + row.rowNum + '(' + row.victimName + '): ' + e.message)
      }
    }

    return NextResponse.json({ ok: true, parsedCount: parsed.length, created, updated, errors: errors.slice(0, 10) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
