import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 5MB 제한 (BYTEA 저장 전제, Postgres 부담 최소화)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/law/attachments?lawId=산재법&type=별표
// 메타데이터만 반환 (fileData 제외) — 목록 조회용
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const lawId = sp.get("lawId") ?? "";
  const type = sp.get("type") ?? "";

  try {
    const items = await prisma.lawAttachment.findMany({
      where: {
        ...(lawId && { lawId }),
        ...(type && { attachmentType: type }),
      },
      select: {
        id: true,
        lawId: true,
        attachmentType: true,
        number: true,
        title: true,
        description: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ lawId: "asc" }, { attachmentType: "asc" }, { number: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error("[GET /api/law/attachments]", err);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST /api/law/attachments
// multipart: file, lawId, attachmentType, number?, title, description?
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    const lawId = (fd.get("lawId") as string)?.trim();
    const attachmentType = (fd.get("attachmentType") as string)?.trim() || "별표";
    const number = ((fd.get("number") as string) ?? "").trim() || null;
    const title = (fd.get("title") as string)?.trim();
    const description = ((fd.get("description") as string) ?? "").trim() || null;

    if (!file) return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });
    if (!lawId) return NextResponse.json({ error: "lawId 필수" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "제목 필수" }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다` }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "PDF, PNG, JPEG만 업로드 가능합니다" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    const userId = (session.user as { id?: string }).id ?? null;
    const created = await prisma.lawAttachment.create({
      data: {
        lawId,
        attachmentType,
        number,
        title,
        description,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        fileData: buf,
        uploadedBy: userId,
      },
      select: {
        id: true,
        lawId: true,
        attachmentType: true,
        number: true,
        title: true,
        description: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        createdAt: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/law/attachments]", err);
    return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
  }
}
