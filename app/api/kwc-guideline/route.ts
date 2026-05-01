import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 근로복지공단 지침 PDF — LawAttachment 모델을 lawId="kwc-guideline" 로 재활용
// attachmentType: cat1 (예: "산재일반", "상병별")
// number       : cat2 (예: "요양", "소음성난청")
// title        : 지침 제목
// description  : 지침 요약

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 지침 PDF는 본문보다 큰 경우 많아 10MB
const ALLOWED_TYPES = new Set(["application/pdf"]);
const KWC_LAW_ID = "kwc-guideline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/kwc-guideline?cat1=상병별&cat2=소음성난청
// 메타데이터만 반환 (fileData 제외)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const cat1 = sp.get("cat1") ?? "";
  const cat2 = sp.get("cat2") ?? "";

  try {
    const items = await prisma.lawAttachment.findMany({
      where: {
        lawId: KWC_LAW_ID,
        ...(cat1 && { attachmentType: cat1 }),
        ...(cat2 && { number: cat2 }),
      },
      select: {
        id: true,
        attachmentType: true, // cat1
        number: true,         // cat2
        title: true,
        description: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ attachmentType: "asc" }, { number: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error("[GET /api/kwc-guideline]", err);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST /api/kwc-guideline (ADMIN 전용)
// multipart: file, cat1, cat2?, title, description?
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ADMIN 전용
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    const cat1 = (fd.get("cat1") as string)?.trim();
    const cat2 = ((fd.get("cat2") as string) ?? "").trim() || null;
    const title = (fd.get("title") as string)?.trim();
    const description = ((fd.get("description") as string) ?? "").trim() || null;

    if (!file) return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });
    if (!cat1) return NextResponse.json({ error: "분류(cat1) 필수" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "제목 필수" }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다` }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "PDF만 업로드 가능합니다" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const userId = (session.user as { id?: string }).id ?? null;

    const created = await prisma.lawAttachment.create({
      data: {
        lawId: KWC_LAW_ID,
        attachmentType: cat1,
        number: cat2,
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
    console.error("[POST /api/kwc-guideline]", err);
    return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
  }
}
