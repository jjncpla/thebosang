import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; attachmentId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { caseId, attachmentId } = await params
  const attachment = await (prisma as any).caseAttachment.findUnique({
    where: { id: attachmentId },
  })
  if (!attachment || attachment.caseId !== caseId) {
    return NextResponse.json({ error: '파일 없음' }, { status: 404 })
  }

  const encodedName = encodeURIComponent(attachment.fileName)
  return new Response(attachment.fileData, {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
    },
  })
}
