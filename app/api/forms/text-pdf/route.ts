import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildTextFormPdf } from "@/lib/text-form-pdf";
import { buildSpecByTemplate, type TextFormTemplate } from "@/lib/text-form-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 신규 자동생성 양식 (배경 PDF 없는 자유 양식) PDF 생성.
 *
 * Body: { template: TextFormTemplate, data: Record<string, unknown> }
 *
 * 지원 template:
 *  - EXAM_CLAIM (심사청구서)
 *  - REEXAM_CLAIM (재심사청구서)
 *  - ADDITIONAL_INJURY_CLAIM (추가상병 신청서)
 *  - REQUOTE_REQUEST (재요양 신청서)
 *
 * 평균임금 정정청구서는 AvgWageNotice 기반이므로 별도 라우트
 *  (/api/avg-wage/[id]/correction-pdf) 사용.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const template = body.template as TextFormTemplate;
    const data = (body.data ?? {}) as Record<string, unknown>;
    if (!template) {
      return NextResponse.json({ error: "template required" }, { status: 400 });
    }

    const { spec, fileName } = buildSpecByTemplate(template, data);
    const pdfBytes = await buildTextFormPdf(spec);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error("[forms/text-pdf] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
