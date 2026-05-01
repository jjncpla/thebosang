import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { parseResolutionNotice, evaluateAutoIngest } from "@/lib/decision-notice-parser";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

let docAIClient: DocumentProcessorServiceClient | null = null;
function getDocAIClient() {
  if (docAIClient) return docAIClient;
  const b64 = process.env.GOOGLE_CREDENTIALS_B64;
  if (!b64) throw new Error("GOOGLE_CREDENTIALS_B64 not set");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  docAIClient = new DocumentProcessorServiceClient({ credentials });
  return docAIClient;
}

async function ocrPdf(pdfBase64: string): Promise<{ text: string; pageCount: number }> {
  const client = getDocAIClient();
  const processorName = process.env.GOOGLE_DOCAI_PROCESSOR;
  if (!processorName) throw new Error("GOOGLE_DOCAI_PROCESSOR not set");

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: { content: pdfBase64, mimeType: "application/pdf" },
  });
  const text = result.document?.text ?? "";
  const pageCount = result.document?.pages?.length ?? 1;
  return { text, pageCount };
}

/**
 * POST /api/resolution-notice/parse
 * 결정통지서 PDF를 OCR로 파싱 후 ResolutionNotice 레코드 생성.
 * 사용자 권한: 인증된 사용자 (STAFF 이상).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role ?? "";
  if (role === "이산계정") {
    return NextResponse.json({ error: "권한 부족" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const includeRaw = formData.get("includeRaw") === "true";
    const skipSave = formData.get("skipSave") === "true";

    if (!file) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기 15MB 초과" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");

    // OCR
    const { text, pageCount } = await ocrPdf(base64);

    // 파싱
    const parsed = parseResolutionNotice(text);
    const decision = evaluateAutoIngest(parsed);

    if (includeRaw) parsed.rawText = text;

    // DB 저장
    let noticeId: string | null = null;
    if (!skipSave && parsed.isResolutionNotice) {
      try {
        const userId = (session.user as { id?: string })?.id ?? null;

        const safeDate = (s: string | null | undefined) => {
          if (!s) return null;
          const d = new Date(s);
          return isNaN(d.getTime()) ? null : d;
        };

        const ocrTrimmed = text.length > 100000 ? text.slice(0, 100000) : text;

        const created = await prisma.resolutionNotice.create({
          data: {
            originalFileName: file.name,
            fileSize: file.size,
            pageCount,
            ocrEngine: "DOCAI",

            // 추출 필드
            resolutionDate: safeDate(parsed.decisionDate),
            noticeNumber: parsed.mgmtNo,
            kwcOfficeName: parsed.comwelBranch,
            postalCode: parsed.zipcode,
            decisionType:
              parsed.resultStatus === "APPROVED"
                ? "승인"
                : parsed.resultStatus === "REJECTED"
                ? "불승인"
                : parsed.resultStatus === "PARTIAL"
                ? "일부승인"
                : null,

            recipientName: parsed.workerName,
            medicalInstitution: parsed.medicalInstName,
            medicalInstNo: parsed.medicalInstNo,
            injuryName: parsed.diagnosisName,
            icdCode: parsed.icdCode,
            treatmentPeriodStart: safeDate(parsed.treatmentStartDate),
            treatmentPeriodEnd: safeDate(parsed.treatmentEndDate),

            rejectionReason: parsed.rejectionReason,
            calculationDetail: parsed.decisionDetail,
            feeNotice: parsed.feeNotice,

            diseaseCategory: parsed.diseaseCategory,

            // 자동 인입 판정
            autoIngestConfidence: parsed.confidence,
            requiresUserReview: decision.requiresUserReview,
            appliedToCase: false,

            // 원본 + 파싱 메타
            parsedData: parsed as unknown as object,
            rawText: ocrTrimmed,
            warnings: parsed.warnings,

            uploadedById: userId,
          },
        });
        noticeId = created.id;
      } catch (saveErr) {
        console.error("[resolution-notice/parse] DB save error:", saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      ocrTextLength: text.length,
      pageCount,
      noticeId,
      parsed,
      autoIngest: decision,
    });
  } catch (e) {
    console.error("[resolution-notice/parse] error:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
