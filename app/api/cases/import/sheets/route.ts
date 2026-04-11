import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const SKIP_SHEETS = ['전체TF', 'MBO 현황', '~21.12.15. 기획사건 외(울산)']

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets = workbook.SheetNames.filter(s => !SKIP_SHEETS.includes(s))
    return NextResponse.json({ sheets })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
