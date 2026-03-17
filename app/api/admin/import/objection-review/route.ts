import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readWorkbook, sheetToRows, str, toDate, normalizeTfName } from "@/lib/excel-parser";

function mapProgressStatus(val: unknown): string {
  const s = str(val);
  if (!s) return "검토중";
  if (s.includes("이의제기")) return "이의제기 진행";
  if (s.includes("송무")) return "송무 인계";
  if (s.includes("평정") || s.includes("평임")) return "평정청구 진행";
  if (s === "종결") return "종결";
  if (s.includes("검토")) return "검토중";
  return s;
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

  // '최초총현황' 시트, 행2(index 1) 헤더, 행3(index 2)부터 데이터
  const rows = sheetToRows(wb, "최초총현황", 1, 2);

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const patientName = str(row["성명"]);
    const tfName = normalizeTfName(row["TF"]);
    const caseType = str(row["사건분류"]);
    const decisionDate = toDate(row["처분일"]);

    if (!patientName) { skipped++; continue; }

    try {
      const data = {
        approvalStatus: str(row["승인여부"]) ?? "",
        tfName: tfName ?? "",
        patientName,
        caseType: caseType ?? "",
        decisionDate,
        progressStatus: mapProgressStatus(row["사건진행여부"]),
        hasInfoDisclosure: !!(str(row["정공"])),
      };

      const existing = await prisma.objectionReview.findFirst({
        where: {
          patientName,
          tfName: tfName ?? undefined,
          caseType: caseType ?? undefined,
          decisionDate: decisionDate ?? undefined,
        },
      });

      if (existing) {
        await prisma.objectionReview.update({ where: { id: existing.id }, data });
      } else {
        await prisma.objectionReview.create({ data });
      }
      success++;
    } catch (e) {
      errors.push(`${patientName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ success, skipped, errors });
}
