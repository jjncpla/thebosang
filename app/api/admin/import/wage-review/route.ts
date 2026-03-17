import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readWorkbook, sheetToRows, str, flt, toDate, normalizeTfName } from "@/lib/excel-parser";

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

  // '평임 데이터 검토' 시트, 행4(index 3) 헤더, 행5(index 4)부터 데이터
  const rows = sheetToRows(wb, "평임 데이터 검토", 3, 4);

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const patientName = str(row["성명"]);
    const tfName = normalizeTfName(row["TF"]);
    const decisionDate = toDate(row["처분일"]);

    if (!patientName) { skipped++; continue; }

    try {
      const hasNatDisStr = str(row["국가장애여부"]);
      const hasCommuteStr = str(row["통상근로계수여부"]);

      const data = {
        tfName: tfName ?? "",
        patientName,
        caseType: str(row["사건분류"]) ?? "",
        decisionDate,
        hasInfoDisclosure: !!(str(row["정공"])),
        retirementDate: toDate(row["퇴직일자"]),
        diagnosisDate: toDate(row["산정사유발생일"]),
        hasNationalDisability: hasNatDisStr === "Y" || hasNatDisStr === "y",
        disabilityGrade: str(row["급수"]),
        workerType: str(row["일용/상용"]),
        comparisonWage: str(row["비교임금"]),
        appliedWage: str(row["적용임금"]),
        workplaceName: str(row["적용사업장명"]),
        occupation1: str(row["직종1"]),
        occupation1Years: str(row["직종1직력"]),
        occupation2: str(row["직종2"]),
        occupation2Years: str(row["직종2직력"]),
        occupation3: str(row["직종3"]),
        occupation3Years: str(row["직종3직력"]),
        baseAvgWage: flt(row["최초산출평균임금"]),
        basisNote: str(row["산정근거"]),
        hasCommuteCoef: hasCommuteStr ? hasCommuteStr === "Y" || hasCommuteStr === "y" : null,
        changeRate: flt(row["증감률"]),
        finalAvgWage: flt(row["적용평균임금"]),
        statWageGender: str(row["성별(2)"]),
        statWageSize: str(row["규모"]),
        statWageIndustry: str(row["업종(2)"]),
        statWageOccupation: str(row["직종"]),
        statWageQuarter: str(row["적용분기"]),
        statWageBase: flt(row["최초산정임금"]),
        statWageChangeRate: flt(row["증감률(3)"]),
        statWageFinal: flt(row["적용평균임금(3)"]),
        finalSelectedWage: flt(row["적용평균임금(3)"]) ?? flt(row["적용평균임금"]),
        reviewManagerName: str(row["검토담당자"]),
        reviewResult: str(row["검토결과"]),
        reviewDetail: str(row["상세쟁점"]),
        progressNote: str(row["진행경과"]),
        claimDate: toDate(row["청구일"]),
        decisionResultDate: toDate(row["결정일"]),
        additionalReview: str(row["추가검토"]),
      };

      const existing = await prisma.wageReviewData.findFirst({
        where: {
          patientName,
          tfName: tfName ?? undefined,
          decisionDate: decisionDate ?? undefined,
        },
      });

      if (existing) {
        await prisma.wageReviewData.update({ where: { id: existing.id }, data });
      } else {
        await prisma.wageReviewData.create({ data });
      }
      success++;
    } catch (e) {
      errors.push(`${patientName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ success, skipped, errors });
}
