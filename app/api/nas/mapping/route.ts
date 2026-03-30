import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: 매핑된 CaseFile 목록 조회
export async function GET() {
  try {
    const files = await prisma.caseFile.findMany({
      where: { fileType: "NAS" },
      include: {
        case: {
          include: {
            patient: { select: { name: true } },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const result = files.map((f) => ({
      id: f.id,
      caseId: f.caseId,
      fileName: f.fileName,
      nasPath: f.nasPath,
      uploadedAt: f.uploadedAt.toISOString(),
      patient: { name: f.case.patient.name },
      caseType: f.case.caseType,
      branch: f.case.branch || "",
    }));

    return NextResponse.json({ files: result });
  } catch (err) {
    console.error("[GET /api/nas/mapping]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

// POST: 매핑 확정 (CaseFile 레코드 생성)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string })?.id;

    const { mappings } = await req.json();
    if (!mappings?.length) {
      return NextResponse.json({ error: "매핑 데이터가 필요합니다." }, { status: 400 });
    }

    const created = await prisma.$transaction(
      mappings.map((m: { caseId: string; folderName: string; nasPath: string }) =>
        prisma.caseFile.create({
          data: {
            caseId: m.caseId,
            fileType: "NAS",
            fileName: m.folderName,
            nasPath: m.nasPath,
            uploadedBy: userId || null,
          },
        })
      )
    );

    return NextResponse.json({ success: true, createdCount: created.length });
  } catch (err) {
    console.error("[POST /api/nas/mapping]", err);
    return NextResponse.json({ error: "매핑 생성 오류" }, { status: 500 });
  }
}
