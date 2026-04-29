import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { parseDecisionNotice } from "@/lib/notice-parser";
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

async function ocrPdf(pdfBase64: string): Promise<string> {
  const client = getDocAIClient();
  const processorName = process.env.GOOGLE_DOCAI_PROCESSOR;
  if (!processorName) throw new Error("GOOGLE_DOCAI_PROCESSOR not set");

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: { content: pdfBase64, mimeType: "application/pdf" },
  });
  return result.document?.text ?? "";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const includeRaw = formData.get("includeRaw") === "true";
    const caseId = (formData.get("caseId") as string | null) || null;
    const patientId = (formData.get("patientId") as string | null) || null;
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
    const text = await ocrPdf(base64);

    // 파싱
    const parsed = parseDecisionNotice(text);
    if (includeRaw) parsed.rawText = text;

    // DB 저장 (검토 이력)
    let noticeId: string | null = null;
    if (!skipSave) {
      try {
        const userId = (session.user as { id?: string })?.id ?? null;

        const safeDate = (s: string | null | undefined) => {
          if (!s) return null;
          const d = new Date(s);
          return isNaN(d.getTime()) ? null : d;
        };

        const ocrTrimmed = text.length > 100000 ? text.slice(0, 100000) : text;

        const created = await prisma.decisionNotice.create({
          data: {
            caseId,
            patientId,
            fileName: file.name,
            fileSize: file.size,
            decisionType: parsed.decisionType ?? "기타",
            decisionDate: safeDate(parsed.decisionDate),
            managementNo: parsed.managementNo,
            caseNo: parsed.caseNo,
            resultStatus: parsed.resultStatus,
            workerName: parsed.workerName,
            birthDate: safeDate(parsed.birthDate),
            accidentDate: safeDate(parsed.accidentDate),
            businessName: parsed.businessName,
            paymentAmount: parsed.paymentAmount,
            cumulativeAmount: parsed.cumulativeAmount,
            initialAvgWage: parsed.initialAvgWage,
            parsedData: parsed as unknown as object,
            ocrText: ocrTrimmed,
            verifyStatus: "미검증",
            uploadedBy: userId,
          },
        });
        noticeId = created.id;
      } catch (saveErr) {
        // DB 저장 실패해도 파싱 결과는 반환
        console.error("[notice/parse] DB save error:", saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      ocrTextLength: text.length,
      noticeId,
      parsed,
    });
  } catch (e) {
    console.error("[notice/parse] error:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
