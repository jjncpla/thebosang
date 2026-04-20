/**
 * 소음성 난청 전용 3-페이지 싱크 백필
 *
 * A) 엑셀로 들어온 ObjectionReview(caseType=HEARING_LOSS, caseId=null) 중
 *    Case(tfName+patient.name) 매칭되는 건 → caseId 연결
 * B) 연결된 ObjectionReview 전부에 대해:
 *    - HearingLossDetail.decisionType ← approvalStatus (APPROVED/REJECTED)
 *    - HearingLossDetail.decisionReceivedAt ← decisionDate (없을 때만)
 *    - Case.status ← progressStatus 매핑 또는 APPROVED/REJECTED
 * C) Case의 decisionType이 설정되어 있는데 ObjectionReview가 없는 건 생성
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROGRESS_TO_CASE_STATUS: Record<string, string> = {
  "검토중": "REVIEWING",
  "이의제기 진행": "OBJECTION",
  "평정청구 진행": "WAGE_CORRECTION",
  "종결": "CLOSED",
};

function approvalToDecisionType(approval: string | null): "APPROVED" | "REJECTED" | null {
  if (!approval) return null;
  if (approval === "승인" || approval === "일부승인") return "APPROVED";
  if (approval === "불승인") return "REJECTED";
  return null;
}

async function main() {
  console.log("=== A) 미연결 ObjectionReview ↔ Case 매칭 ===");
  const candidates = await prisma.objectionReview.findMany({
    where: { caseType: "HEARING_LOSS", caseId: null },
    select: { id: true, tfName: true, patientName: true },
  });
  console.log(`  대상: ${candidates.length}건`);

  // 일괄 Case 조회 (TF별 그룹화)
  const tfSet = [...new Set(candidates.map(c => c.tfName))];
  const cases = await prisma.case.findMany({
    where: { caseType: "HEARING_LOSS", tfName: { in: tfSet } },
    select: { id: true, tfName: true, patient: { select: { name: true } } },
  });
  const caseByKey = new Map<string, string>();
  for (const c of cases) {
    const key = `${c.tfName}|${c.patient?.name ?? ""}`;
    // 동일 key 중복이 있을 수 있으나 단순 처리 (첫 매칭 유지)
    if (!caseByKey.has(key)) caseByKey.set(key, c.id);
  }

  let linked = 0;
  for (const r of candidates) {
    const caseId = caseByKey.get(`${r.tfName}|${r.patientName}`);
    if (!caseId) continue;
    await prisma.objectionReview.update({ where: { id: r.id }, data: { caseId } });
    linked++;
    if (linked % 25 === 0) console.log(`    ... linked ${linked}`);
  }
  console.log(`  ✅ 연결 완료: ${linked}건`);

  console.log("\n=== B) 연결된 ObjectionReview → HearingLossDetail + Case 싱크 ===");
  const linkedReviews = await prisma.objectionReview.findMany({
    where: { caseType: "HEARING_LOSS", caseId: { not: null } },
    select: {
      id: true, caseId: true,
      approvalStatus: true, progressStatus: true, decisionDate: true,
    },
  });
  console.log(`  대상: ${linkedReviews.length}건`);

  let hlUpdated = 0, caseUpdated = 0;
  for (const r of linkedReviews) {
    const dt = approvalToDecisionType(r.approvalStatus);
    if (dt && r.caseId) {
      // HearingLossDetail upsert (decisionType)
      await prisma.hearingLossDetail.upsert({
        where: { caseId: r.caseId },
        create: { caseId: r.caseId, decisionType: dt, decisionReceivedAt: r.decisionDate },
        update: {
          decisionType: dt,
          ...(r.decisionDate ? { decisionReceivedAt: r.decisionDate } : {}),
        },
      });
      hlUpdated++;
    }

    // Case.status 전이
    if (r.caseId) {
      const progressMapped = PROGRESS_TO_CASE_STATUS[r.progressStatus];
      let target: string | null = null;
      if (progressMapped) target = progressMapped;
      else if (dt === "APPROVED") target = "APPROVED";
      else if (dt === "REJECTED") target = "REJECTED";
      if (target) {
        const c = await prisma.case.findUnique({ where: { id: r.caseId }, select: { status: true } });
        if (c && c.status !== target) {
          // 종결 상태는 임의로 되돌리지 않음
          if (!(c.status === "CLOSED" && target !== "CLOSED")) {
            await prisma.case.update({ where: { id: r.caseId }, data: { status: target } });
            caseUpdated++;
          }
        }
      }
    }

    if ((hlUpdated + caseUpdated) % 50 === 0 && (hlUpdated + caseUpdated) > 0) {
      console.log(`    ... hl=${hlUpdated} caseStatus=${caseUpdated}`);
    }
  }
  console.log(`  ✅ HearingLossDetail 갱신: ${hlUpdated} / Case.status 갱신: ${caseUpdated}`);

  console.log("\n=== C) decisionType 있는데 ObjectionReview 없는 Case → 생성 ===");
  const decidedCases = await prisma.case.findMany({
    where: {
      caseType: "HEARING_LOSS",
      hearingLoss: { decisionType: { not: null } },
    },
    include: {
      patient: { select: { name: true } },
      hearingLoss: { select: { decisionType: true, decisionReceivedAt: true } },
    },
  });
  console.log(`  처분 완료 Case: ${decidedCases.length}건`);

  const reviewsByCaseId = await prisma.objectionReview.findMany({
    where: { caseId: { in: decidedCases.map(c => c.id) } },
    select: { caseId: true },
  });
  const reviewCaseIds = new Set(reviewsByCaseId.map(r => r.caseId));

  let createdReviews = 0;
  for (const c of decidedCases) {
    if (reviewCaseIds.has(c.id)) continue;
    const dt = c.hearingLoss?.decisionType;
    if (!dt) continue;
    // 이름 매칭 이중 안전장치
    const byName = await prisma.objectionReview.findFirst({
      where: {
        caseType: "HEARING_LOSS",
        tfName: c.tfName ?? "",
        patientName: c.patient?.name ?? "",
      },
    });
    if (byName) {
      if (!byName.caseId) {
        await prisma.objectionReview.update({ where: { id: byName.id }, data: { caseId: c.id } });
      }
      continue;
    }
    await prisma.objectionReview.create({
      data: {
        caseId: c.id,
        tfName: c.tfName ?? "",
        patientName: c.patient?.name ?? "",
        caseType: "HEARING_LOSS",
        approvalStatus: dt === "APPROVED" ? "승인" : "불승인",
        progressStatus: "",
        decisionDate: c.hearingLoss?.decisionReceivedAt ?? null,
      },
    });
    createdReviews++;
  }
  console.log(`  ✅ ObjectionReview 생성: ${createdReviews}건`);

  // 요약
  console.log("\n=== 최종 요약 ===");
  const [rev, caseT, linkedN, hlApproved, hlRejected] = await Promise.all([
    prisma.objectionReview.count({ where: { caseType: "HEARING_LOSS" } }),
    prisma.case.count({ where: { caseType: "HEARING_LOSS" } }),
    prisma.objectionReview.count({ where: { caseType: "HEARING_LOSS", caseId: { not: null } } }),
    prisma.hearingLossDetail.count({ where: { decisionType: "APPROVED" } }),
    prisma.hearingLossDetail.count({ where: { decisionType: "REJECTED" } }),
  ]);
  console.log({ reviewTotal: rev, linked: linkedN, caseTotal: caseT, hlApproved, hlRejected });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
