import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'
import { auth } from '@/auth'
import { FORM_FIELDS, FORM_PDF_MAP } from '@/lib/formFields'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

async function getFormFields(formKey: string) {
  const config = await prisma.systemConfig.findUnique({
    where: { key: `form_coords_${formKey}` },
  })
  if (config) return JSON.parse(config.value)
  return FORM_FIELDS[formKey] ?? []
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { formKey, fields, mode } = body as {
      formKey: string
      fields: Record<string, string>
      mode?: 'inline' | 'attachment'
    }

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

    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.otf')
    const fontBytes = fs.readFileSync(fontPath)
    const font = await pdfDoc.embedFont(fontBytes)

    const formFields = await getFormFields(formKey)
    const page = pdfDoc.getPages()[0]

    for (const field of formFields) {
      const value = fields[field.key]
      if (!value) continue
      if (!field.x || !field.y) continue
      page.drawText(String(value), {
        x: field.x,
        y: field.y,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      })
    }

    const pdfOut = await pdfDoc.save()
    const disposition = mode === 'inline' ? 'inline' : 'attachment'
    return new NextResponse(Buffer.from(pdfOut), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${formKey}.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('실무용 PDF 생성 오류:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
