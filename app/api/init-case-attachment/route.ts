import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CaseAttachment" (
        "id"           TEXT NOT NULL PRIMARY KEY,
        "caseId"       TEXT NOT NULL,
        "fileName"     TEXT NOT NULL,
        "fileSize"     INTEGER NOT NULL,
        "mimeType"     TEXT NOT NULL,
        "fileData"     BYTEA NOT NULL,
        "category"     TEXT,
        "description"  TEXT,
        "uploadedById" TEXT,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CaseAttachment_caseId_fkey"
          FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE
      );
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseAttachment_caseId_idx" ON "CaseAttachment"("caseId");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CaseAttachment_caseId_category_idx" ON "CaseAttachment"("caseId", "category");
    `)
    return NextResponse.json({ ok: true, message: 'CaseAttachment 테이블 생성 완료' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
