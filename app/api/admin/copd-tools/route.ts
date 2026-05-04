import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncCopdCaseStatus, syncCopdCaseEvents } from "@/lib/copd-status";

// COPD 운영 도구 — ADMIN 전용
//   action=backfill-disease-type: 기존 SpecialClinicSchedule 행의 diseaseType 채움 (caseId → Case.caseType)
//   action=seed-test-patient    : 테스트 재해자 + COPD 사건 + 1차 신청 1건 생성
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const action = new URL(req.url).searchParams.get("action") ?? "";

  try {
    if (action === "migrate-legacy-casetype") {
      // legacy 한글 caseType → 영문 enum 통일 마이그레이션
      // /objection/deadline에서 한글로 저장된 ObjectionCase.caseType과 ObjectionReview.caseType 둘 다 처리
      const labelToEnum: Record<string, string> = {
        "난청": "HEARING_LOSS",
        "소음성 난청": "HEARING_LOSS",
        "진폐": "PNEUMOCONIOSIS",
        "근골격계": "MUSCULOSKELETAL",
        "업무상 사고": "OCCUPATIONAL_ACCIDENT",
        "직업성 암": "OCCUPATIONAL_CANCER",
        "유족": "BEREAVED",
        "기타": "OTHER",
      };
      const stats: Record<string, number> = {};
      for (const [label, enumKey] of Object.entries(labelToEnum)) {
        const ocResult = await prisma.objectionCase.updateMany({
          where: { caseType: label },
          data: { caseType: enumKey },
        });
        const orResult = await prisma.objectionReview.updateMany({
          where: { caseType: label },
          data: { caseType: enumKey },
        });
        const wgResult = await prisma.wageReviewData.updateMany({
          where: { caseType: label },
          data: { caseType: enumKey },
        });
        if (ocResult.count + orResult.count + wgResult.count > 0) {
          stats[label] = ocResult.count + orResult.count + wgResult.count;
        }
      }
      return NextResponse.json({ updated: Object.values(stats).reduce((a, b) => a + b, 0), stats });
    }

    if (action === "backfill-disease-type") {
      // caseId가 있는 일정 중 diseaseType이 NULL인 것들을 Case.caseType으로 채움
      const targets = await prisma.specialClinicSchedule.findMany({
        where: { caseId: { not: null }, diseaseType: null },
        select: { id: true, caseId: true },
      });
      const caseIds = [...new Set(targets.map((t) => t.caseId).filter((x): x is string => !!x))];
      if (caseIds.length === 0) {
        return NextResponse.json({ updated: 0, message: "백필할 일정 없음" });
      }
      const cases = await prisma.case.findMany({
        where: { id: { in: caseIds } },
        select: { id: true, caseType: true },
      });
      const caseTypeMap: Record<string, string> = {};
      for (const c of cases) caseTypeMap[c.id] = c.caseType;

      let updated = 0;
      // caseType별로 그룹화하여 updateMany
      const byCaseType: Record<string, string[]> = {};
      for (const t of targets) {
        if (!t.caseId) continue;
        const ct = caseTypeMap[t.caseId];
        if (!ct) continue;
        if (!byCaseType[ct]) byCaseType[ct] = [];
        byCaseType[ct].push(t.id);
      }
      for (const [ct, ids] of Object.entries(byCaseType)) {
        const r = await prisma.specialClinicSchedule.updateMany({
          where: { id: { in: ids } },
          data: { diseaseType: ct },
        });
        updated += r.count;
      }

      return NextResponse.json({ updated, byCaseType: Object.fromEntries(Object.entries(byCaseType).map(([k, v]) => [k, v.length])) });
    }

    if (action === "seed-test-patient") {
      // 엑셀 첫 케이스(홍순덕, UDO-3) 패턴 + "TEST" 표시
      const ssn = "511210-9999911"; // 테스트용 (검증 회피)
      const name = `[TEST] COPD재해자_${new Date().toISOString().slice(0, 10)}`;

      // 기존 테스트 재해자가 있으면 그대로 반환
      const existing = await prisma.patient.findUnique({ where: { ssn } });
      if (existing) {
        const cases = await prisma.case.findMany({
          where: { patientId: existing.id, caseType: "COPD" },
          orderBy: { createdAt: "desc" },
          take: 1,
        });
        if (cases.length > 0) {
          return NextResponse.json({
            patientId: existing.id,
            caseId: cases[0].id,
            url: `/cases/${cases[0].id}/copd`,
            message: "기존 테스트 재해자 재사용",
          });
        }
      }

      const patient = existing
        ? existing
        : await prisma.patient.create({
            data: {
              name,
              ssn,
              phone: "010-0000-0000",
              address: "테스트 주소 (실제 데이터 아님)",
              memo: "COPD 회차별 신청 테스트용 더미 재해자",
            },
          });

      const newCase = await prisma.case.create({
        data: {
          patientId: patient.id,
          caseType: "COPD",
          status: "접수대기",
          tfName: "울산TF",
          branch: "울산",
          memo: "[TEST] COPD 회차별 신청 테스트 사건",
        },
      });

      const detail = await prisma.copdDetail.create({
        data: {
          caseId: newCase.id,
          smokingStatus: "금연",
          smokingPacks: 20,
          smokingYears: 30,
          firstClinic: "김남용내과",
          firstExamDate: new Date("2022-01-07"),
          fev1Rate: 65,
          fev1Volume: 1.8,
          copdMemo: "테스트 더미 데이터입니다.",
        },
      });

      // 1차 신청 (수치미달, 재진행 가능 시점 + 1년 자동)
      await prisma.copdApplication.create({
        data: {
          copdDetailId: detail.id,
          applicationRound: 1,
          applicationDate: new Date("2022-01-27"),
          examRequestReceivedAt: new Date("2022-02-08"),
          exam1Hospital: "창원병원",
          exam1Date: new Date("2022-10-07"),
          exam1Fev1Rate: 65,
          exam1Fev1Volume: 84,
          exam1Note: "수치미달",
          exam2Skipped: true,
          examResult: "수치미달",
          reExamPossibleDate: new Date("2023-10-08"),
          disposalType: "부지급",
          disposalDate: new Date("2022-11-02"),
          memo: "1차 시도, 수치미달로 부지급 → 1년 후 재신청",
        },
      });

      // 상태/캘린더 동기화
      await syncCopdCaseStatus(newCase.id);
      await syncCopdCaseEvents(newCase.id);

      return NextResponse.json({
        patientId: patient.id,
        caseId: newCase.id,
        url: `/cases/${newCase.id}/copd`,
        message: "테스트 재해자 생성 완료",
      });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[admin/copd-tools]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
