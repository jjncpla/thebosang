import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readWorkbook, sheetToRows, str, toDate, normalizeTfName, parseClaimField } from "@/lib/excel-parser";

function mapProgressStatus(val: unknown): string {
  const s = str(val);
  if (!s) return "진행중";
  if (s.includes("종결")) return "종결";
  if (s.includes("송무")) return "송무인계";
  if (s.includes("검토")) return "검토중";
  if (s.includes("진행")) return "진행중";
  return "진행중";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "파일 파싱 실패" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = readWorkbook(buffer);

  // '이의제기' 시트, 행2(index 1) 헤더, 행3(index 2)부터 데이터
  const rows = sheetToRows(wb, "이의제기", 1, 2);

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const patientName = str(row["성명"]);
    const tfName = normalizeTfName(row["TF"]);
    const decisionDate = toDate(row["처분일(안날)"]) ?? toDate(row["처분일"]);

    if (!patientName) { skipped++; continue; }

    try {
      const examParsed = parseClaimField(row["심사청구/정정청구"] ?? row["심사청구"]);
      const reExamParsed = parseClaimField(row["재심사청구"]);

      const managerName = str(row["담당자"]);
      const bigoNote = str(row["비고"]);
      const memo = [
        managerName ? `담당: ${managerName}` : null,
        bigoNote,
      ].filter(Boolean).join(" / ") || null;

      const progressStatus = mapProgressStatus(row["사건진행여부"]);

      const data = {
        approvalStatus: str(row["승인여부"]) ?? "",
        tfName: tfName ?? "",
        patientName,
        caseType: str(row["사건분류"]) ?? "",
        decisionDate,
        examClaimDate: examParsed.claimDate,
        examResult: examParsed.result,
        examResultDate: examParsed.resultDate,
        reExamClaimDate: reExamParsed.claimDate,
        reExamResult: reExamParsed.result,
        reExamResultDate: reExamParsed.resultDate,
        managerId: null,
        memo,
        progressStatus,
        litigationHandover: progressStatus === "송무인계",
        litigationMemo: null,
        isQualityReview: false,
        needsReDecision: false,
      };

      const existing = await prisma.objectionCase.findFirst({
        where: {
          patientName,
          tfName: tfName ?? undefined,
          decisionDate: decisionDate ?? undefined,
        },
      });

      if (existing) {
        await prisma.objectionCase.update({ where: { id: existing.id }, data });
      } else {
        await prisma.objectionCase.create({ data });
      }
      success++;
    } catch (e) {
      errors.push(`${patientName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ success, skipped, errors });
}
