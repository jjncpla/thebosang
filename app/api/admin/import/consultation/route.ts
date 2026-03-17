import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readWorkbook, sheetToRows, str, toDate } from "@/lib/excel-parser";

function mapStatus(val: unknown): string {
  const s = str(val);
  if (!s) return "진행중";
  if (s === "약정") return "약정";
  if (s === "종결") return "종결";
  if (s === "연락 대기" || s === "연락대기") return "연락대기";
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

  // '총 접수현황' 시트, 행6(index 5) 헤더, 행7(index 6)부터 데이터
  const rows = sheetToRows(wb, "총 접수현황", 5, 6);

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(row["성명"]);
    const phone = str(row["연락처"]) ?? "-";
    if (!name) { skipped++; continue; }

    try {
      const rawCaseTypes = str(row["사건종류"]);
      const caseTypes = rawCaseTypes
        ? rawCaseTypes.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
        : [];

      const visitDate = toDate(row["방문일자"]);

      await prisma.consultation.upsert({
        where: { name_phone: { name, phone } },
        update: {
          ssn: str(row["주민번호"]),
          address: str(row["주소"]),
          caseTypes,
          routeMain: str(row["상담경로(대분류)"]),
          routeSub: str(row["상담경로(중분류)"]),
          routeDetail: str(row["상담경로(소분류)"]),
          visitDate,
          status: mapStatus(row["사건수임"]),
          memo: str(row["비고"]),
          progressNote: str(row["기준진행경과"]),
          managerName: str(row["담당"]),
        },
        create: {
          name,
          phone,
          ssn: str(row["주민번호"]),
          address: str(row["주소"]),
          caseTypes,
          routeMain: str(row["상담경로(대분류)"]),
          routeSub: str(row["상담경로(중분류)"]),
          routeDetail: str(row["상담경로(소분류)"]),
          visitDate,
          status: mapStatus(row["사건수임"]),
          memo: str(row["비고"]),
          progressNote: str(row["기준진행경과"]),
          managerName: str(row["담당"]),
        },
      });
      success++;
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ success, skipped, errors });
}
