import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/hwp', 'application/x-hwp',
])
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function GET(
  request: Request,
  { params }: { params: { caseId: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const where: any = { caseId: params.caseId }
  if (category) where.category = category

  const attachments = await (prisma as any).caseAttachment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, fileName: true, fileSize: true, mimeType: true,
      category: true, description: true, createdAt: true,
      uploadedById: true,
    },
  })

  return NextResponse.json({ attachments })
}

export async function POST(
  request: Request,
  { params }: { params: { caseId: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하만 허용됩니다' }, { status: 400 })
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json({ error: `허용되지 않는 파일 형식: ${file.type}` }, { status: 400 })
    }

    const category = (formData.get('category') as string) || null
    const description = (formData.get('description') as string) || null
    const fileData = Buffer.from(await file.arrayBuffer())

    const attachment = await (prisma as any).caseAttachment.create({
      data: {
        caseId: params.caseId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileData,
        category,
        description,
        uploadedById: (session.user as any).id ?? null,
      },
      select: {
        id: true, fileName: true, fileSize: true, mimeType: true,
        category: true, description: true, createdAt: true,
      },
    })

    return NextResponse.json(attachment)
  } catch (e: any) {
    console.error('Attachment upload error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
