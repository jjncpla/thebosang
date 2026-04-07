import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { IMPORT_DATA } from "./data";

export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 기존 레코드가 있으면 중단
  const existingCount = await prisma.objectionCase.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: `이미 ${existingCount}건의 데이터가 존재합니다. 빈 테이블에서만 임포트 가능합니다.` },
      { status: 400 }
    );
  }

  // User name -> id 맵 생성
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userMap = new Map<string, string>();
  for (const u of users) {
    if (u.name) userMap.set(u.name, u.id);
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of IMPORT_DATA) {
    try {
      const managerId = row.managerName ? (userMap.get(row.managerName) ?? null) : null;

      await prisma.objectionCase.create({
        data: {
          approvalStatus: row.approvalStatus,
          tfName: row.tfName,
          patientName: row.patientName,
          caseType: row.caseType,
          decisionDate: row.decisionDate ? new Date(row.decisionDate) : null,
          examResult: row.examResult ?? null,
          examResultDate: row.examResultDate ? new Date(row.examResultDate) : null,
          examClaimDate: row.examClaimDate ? new Date(row.examClaimDate) : null,
          reExamResult: row.reExamResult ?? null,
          reExamResultDate: row.reExamResultDate ? new Date(row.reExamResultDate) : null,
          reExamClaimDate: row.reExamClaimDate ? new Date(row.reExamClaimDate) : null,
          managerId,
          progressStatus: row.progressStatus ?? "검토중",
          memo: row.memo ?? null,
        },
      });
      success++;
    } catch (err) {
      failed++;
      errors.push(`${row.patientName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    total: IMPORT_DATA.length,
    success,
    failed,
    errors: errors.slice(0, 20), // 최대 20개 에러만 반환
  });
}
