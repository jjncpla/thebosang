import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'
import { auth } from '@/auth'
import { FORM_FIELDS, FORM_PDF_MAP } from '@/lib/formFields'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { formKey, fields } = body as { formKey: string; fields: Record<string, string> }

    const pdfFile = FORM_PDF_MAP[formKey]
    if (!pdfFile) {
      return NextResponse.json({ error: `알 수 없는 서식: ${formKey}` }, { status: 400 })
    }

    const pdfPath = path.join(process.cwd(), 'public', 'forms', pdfFile)
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: `PDF 파일 없음: ${pdfFile}` }, { status: 404 })
    }

    const pdfBytes = fs.readFileSync(pdfPath)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    pdfDoc.registerFontkit(fontkit)

    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.ttf')
    const fontBytes = fs.readFileSync(fontPath)
    const font = await pdfDoc.embedFont(fontBytes)

    const formFields = FORM_FIELDS[formKey] ?? []
    const page = pdfDoc.getPages()[0]

    for (const field of formFields) {
      const value = fields[field.key]
      if (!value) continue
      page.drawText(String(value), {
        x: field.x,
        y: field.y,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      })
    }

    const pdfOut = await pdfDoc.save()
    return new NextResponse(Buffer.from(pdfOut), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="test_${formKey}.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('테스트 PDF 생성 오류:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
