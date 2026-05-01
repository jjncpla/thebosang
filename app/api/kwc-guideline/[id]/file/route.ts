import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const KWC_LAW_ID = "kwc-guideline";

export const dynamic = "force-dynamic";

// GET /api/kwc-guideline/[id]/file?inline=1
// PDF 바이너리 직접 반환 — InlinePdfViewer fileUrl 로 사용
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  try {
    const att = await prisma.lawAttachment.findUnique({
      where: { id },
      select: { lawId: true, fileName: true, contentType: true, fileData: true },
    });
    if (!att || att.lawId !== KWC_LAW_ID) {
      return NextResponse.json({ error: "찾을 수 없음" }, { status: 404 });
    }

    const disposition = inline
      ? `inline; filename*=UTF-8''${encodeURIComponent(att.fileName)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`;

    const src = att.fileData instanceof Uint8Array ? att.fileData : Buffer.from(att.fileData);
    const ab = new ArrayBuffer(src.byteLength);
    new Uint8Array(ab).set(src);
    return new NextResponse(ab, {
      headers: {
        "Content-Type": att.contentType || "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(src.byteLength),
      },
    });
  } catch (err) {
    console.error("[GET /api/kwc-guideline/[id]/file]", err);
    return NextResponse.json({ error: "다운로드 실패" }, { status: 500 });
  }
}
