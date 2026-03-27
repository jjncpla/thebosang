import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  let headerRowIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (row.some(v => String(v ?? '').includes('입금일자'))) {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx < 0) return NextResponse.json({ error: '헤더를 찾을 수 없습니다' }, { status: 400 })

  const headers = (rows[headerRowIdx] as string[]).map(h => String(h ?? '').trim())
  const ci = (name: string) => headers.findIndex(h => h.includes(name))

  const colPayDate     = ci('입금일자')
  const colVictimName  = ci('이름')
  const colTF          = ci('TF')
  const colSalesStaff  = ci('영업담당자')
  const colSettleStaff = ci('정산담당자')
  const colAmount      = ci('입금액')
  const colCaseType    = ci('사건 종류')

  const parsed: {
    paymentDate: string
    year: number
    month: number
    victimName: string
    caseType: string | null
    tfName: string | null
    salesStaffName: string | null
    settlementStaffName: string | null
    grossAmount: number
  }[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const victimName = String(row[colVictimName] ?? '').trim()
    if (!victimName) continue

    let paymentDate = ''
    let year = new Date().getFullYear()
    let month = new Date().getMonth() + 1

    const rawDate = row[colPayDate]
    if (rawDate instanceof Date) {
      paymentDate = rawDate.toISOString().slice(0, 10)
      year  = rawDate.getFullYear()
      month = rawDate.getMonth() + 1
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      paymentDate = rawDate.trim().slice(0, 10)
      year  = parseInt(paymentDate.slice(0, 4))
      month = parseInt(paymentDate.slice(5, 7))
    } else if (typeof rawDate === 'number') {
      const d = XLSX.SSF.parse_date_code(rawDate)
      if (d) {
        paymentDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
        year  = d.y
        month = d.m
      }
    }

    if (!year || isNaN(year)) year = new Date().getFullYear()
    if (!month || isNaN(month) || month < 1 || month > 12) month = 1

    const grossAmount = parseInt(String(row[colAmount] ?? '0').replace(/[^0-9]/g, '')) || 0

    parsed.push({
      paymentDate,
      year,
      month,
      victimName,
      caseType:            String(row[colCaseType]    ?? '').trim() || null,
      tfName:              String(row[colTF]           ?? '').trim() || null,
      salesStaffName:      String(row[colSalesStaff]   ?? '').trim() || null,
      settlementStaffName: String(row[colSettleStaff]  ?? '').trim() || null,
      grossAmount,
    })
  }

  return NextResponse.json({ count: parsed.length, rows: parsed })
}
