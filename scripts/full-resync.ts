/**
 * 소음성 난청 전용: 사건목록(Case+HL) ↔ 처분검토(Review) ↔ 기일관리(ObjectionCase)
 * 전면 재동기화 스크립트
 *
 * 순서 (기일관리를 우선 기준으로):
 *  A) Case.status ↔ HearingLossDetail.decisionType 내부 일치 보정
 *     - status=APPROVED/REJECTED → HL.decisionType 동기화 (없으면 생성)
 *     - HL.decisionType 있는데 Case.status가 결정 외 값이면 Case.status 보정
 *       (CLOSED/OBJECTION/WAGE_CORRECTION은 보호)
 *  B) Case 결정(APPROVED/REJECTED 또는 HL decisionType) → ObjectionReview 보장
 *     - Review 없으면 생성, 이름+TF로 매칭되는 unlinked Review가 있으면 link
 *  C) 기일관리(ObjectionCase) → Review/Case 역싱크
 *     - Review 없으면 생성 (progressStatus='이의제기 진행')
 *     - Review 있지만 Case 없으면 이름+TF 매칭으로 link (생성 X — Patient 누락 위험)
 *     - 연결된 Case.status = OBJECTION (CLOSED 제외)
 *  D) 최종 검증
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
  // ─────────────────────────────────────────────────────
  // A) Case.status ↔ HL.decisionType 내부 일치
  // ─────────────────────────────────────────────────────
  console.log("=== A) Case.status ↔ HL.decisionType 일치 보정 ===");
  const hlCases = await prisma.case.findMany({
    where: { caseType: "HEARING_LOSS" },
    select: { id: true, status: true, hearingLoss: { select: { decisionType: true, decisionReceivedAt: true } } },
  });
  console.log(`  소음성 난청 Case: ${hlCases.length}`);

  let fixedHL = 0, fixedCaseStatus = 0;
  for (const c of hlCases) {
    const st = c.status;
    const dt = c.hearingLoss?.decisionType ?? null;

    // Case.status가 APPROVED/REJECTED인데 HL.decisionType 없거나 불일치 → HL 동기화
    if (st === "APPROVED" && dt !== "APPROVED") {
      await prisma.hearingLossDetail.upsert({
        where: { caseId: c.id },
        create: { caseId: c.id, decisionType: "APPROVED" },
        update: { decisionType: "APPROVED" },
      });
      fixedHL++;
    } else if (st === "REJECTED" && dt !== "REJECTED") {
      await prisma.hearingLossDetail.upsert({
        where: { caseId: c.id },
        create: { caseId: c.id, decisionType: "REJECTED" },
        update: { decisionType: "REJECTED" },
      });
      fixedHL++;
    }
    // HL.decisionType이 결정인데 Case.status가 결정 전 (보호상태 제외) → status 보정
    else if (dt === "APPROVED" && !["APPROVED", "CLOSED", "OBJECTION", "WAGE_CORRECTION"].includes(st)) {
      await prisma.case.update({ where: { id: c.id }, data: { status: "APPROVED" } });
      fixedCaseStatus++;
    } else if (dt === "REJECTED" && !["REJECTED", "CLOSED", "OBJECTION", "WAGE_CORRECTION"].includes(st)) {
      await prisma.case.update({ where: { id: c.id }, data: { status: "REJECTED" } });
      fixedCaseStatus++;
    }
  }
  console.log(`  ✅ HL.decisionType 보정: ${fixedHL} / Case.status 보정: ${fixedCaseStatus}`);

  // ─────────────────────────────────────────────────────
  // B) Case 결정 → Review 보장
  // ─────────────────────────────────────────────────────
  console.log("\n=== B) Case 결정 → Review 보장 ===");
  const decidedCases = await prisma.case.findMany({
    where: {
      caseType: "HEARING_LOSS",
      OR: [
        { status: { in: ["APPROVED", "REJECTED"] } },
        { hearingLoss: { decisionType: { in: ["APPROVED", "REJECTED"] } } },
      ],
    },
    select: {
      id: true, status: true, tfName: true,
      patient: { select: { name: true } },
      hearingLoss: { select: { decisionType: true, decisionReceivedAt: true } },
    },
  });
  console.log(`  결정 난 Case: ${decidedCases.length}`);

  let reviewLinked = 0, reviewCreated = 0;
  for (const c of decidedCases) {
    const effectiveDecision = c.hearingLoss?.decisionType ??
      (c.status === "APPROVED" ? "APPROVED" : c.status === "REJECTED" ? "REJECTED" : null);
    if (!effectiveDecision) continue;

    const approval = effectiveDecision === "APPROVED" ? "승인" : "불승인";

    // 1) caseId로 매칭된 Review 확인
    let review = await prisma.objectionReview.findFirst({ where: { caseId: c.id } });

    // 2) 없으면 이름+TF로 매칭된 unlinked Review 찾아 link
    if (!review) {
      const byName = await prisma.objectionReview.findFirst({
        where: {
          caseType: "HEARING_LOSS",
          tfName: c.tfName ?? "",
          patientName: c.patient?.name ?? "",
        },
      });
      if (byName) {
        review = await prisma.objectionReview.update({
          where: { id: byName.id },
          data: {
            caseId: byName.caseId ?? c.id,
            approvalStatus: byName.approvalStatus || approval,
            decisionDate: byName.decisionDate ?? c.hearingLoss?.decisionReceivedAt ?? null,
          },
        });
        reviewLinked++;
      }
    }

    // 3) 아무 것도 없으면 생성
    if (!review) {
      await prisma.objectionReview.create({
        data: {
          caseId: c.id,
          tfName: c.tfName ?? "",
          patientName: c.patient?.name ?? "",
          caseType: "HEARING_LOSS",
          approvalStatus: approval,
          progressStatus: "",
          decisionDate: c.hearingLoss?.decisionReceivedAt ?? null,
        },
      });
      reviewCreated++;
    }
  }
  console.log(`  ✅ Review 생성: ${reviewCreated} / link: ${reviewLinked}`);

  // ─────────────────────────────────────────────────────
  // C) 기일관리 기준 역싱크 — ObjectionCase → Review + Case
  // ─────────────────────────────────────────────────────
  console.log("\n=== C) 기일관리 기준 역싱크 (소음성 난청만) ===");
  const objCases = await prisma.objectionCase.findMany({
    where: { caseType: "HEARING_LOSS" },
    select: {
      id: true, reviewId: true, caseId: true,
      tfName: true, patientName: true,
      approvalStatus: true, progressStatus: true, decisionDate: true,
    },
  });
  console.log(`  기일관리 소음성 난청: ${objCases.length}`);

  let deadlineReviewCreated = 0, deadlineReviewLinked = 0, deadlineCaseLinked = 0, deadlineCaseStatus = 0;
  for (const oc of objCases) {
    // 1) Review 찾기: reviewId > caseId > 이름+TF
    let review: Awaited<ReturnType<typeof prisma.objectionReview.findFirst>> = null;
    if (oc.reviewId) review = await prisma.objectionReview.findUnique({ where: { id: oc.reviewId } });
    if (!review && oc.caseId) review = await prisma.objectionReview.findFirst({ where: { caseId: oc.caseId } });
    if (!review) review = await prisma.objectionReview.findFirst({
      where: { caseType: "HEARING_LOSS", tfName: oc.tfName, patientName: oc.patientName },
    });

    // 2) Review 없으면 생성 (이의제기 진행 상태로)
    if (!review) {
      const approval = oc.approvalStatus || "불승인";
      review = await prisma.objectionReview.create({
        data: {
          caseId: oc.caseId,
          tfName: oc.tfName,
          patientName: oc.patientName,
          caseType: "HEARING_LOSS",
          approvalStatus: approval,
          progressStatus: oc.progressStatus === "종결" ? "종결" : "이의제기 진행",
          decisionDate: oc.decisionDate ?? null,
        },
      });
      deadlineReviewCreated++;
    } else {
      // reviewId 연결 누락분 보정
      const updates: Record<string, unknown> = {};
      if (!oc.reviewId) {
        await prisma.objectionCase.update({ where: { id: oc.id }, data: { reviewId: review.id } });
      }
      // 진행중이면 review를 '이의제기 진행'으로 끌어올림 (단, 이미 종결인 건 보존)
      if (oc.progressStatus !== "종결" && review.progressStatus !== "이의제기 진행") {
        updates.progressStatus = "이의제기 진행";
      } else if (oc.progressStatus === "종결" && review.progressStatus !== "종결") {
        updates.progressStatus = "종결";
      }
      if (Object.keys(updates).length > 0) {
        review = await prisma.objectionReview.update({ where: { id: review.id }, data: updates });
      }
      deadlineReviewLinked++;
    }

    // 3) Case link 시도
    let caseId = review.caseId ?? oc.caseId ?? null;
    if (!caseId) {
      const caseByName = await prisma.case.findFirst({
        where: {
          caseType: "HEARING_LOSS",
          tfName: oc.tfName,
          patient: { name: oc.patientName },
        },
        select: { id: true },
      });
      if (caseByName) {
        caseId = caseByName.id;
        await prisma.objectionReview.update({ where: { id: review.id }, data: { caseId } });
        await prisma.objectionCase.update({ where: { id: oc.id }, data: { caseId } });
        deadlineCaseLinked++;
      }
    } else if (!oc.caseId) {
      await prisma.objectionCase.update({ where: { id: oc.id }, data: { caseId } });
    }

    // 4) Case.status 보정 (CLOSED 보호)
    if (caseId) {
      const currentCase = await prisma.case.findUnique({ where: { id: caseId }, select: { status: true } });
      if (currentCase) {
        const targetStatus = oc.progressStatus === "종결" ? "CLOSED" : "OBJECTION";
        if (currentCase.status !== targetStatus && currentCase.status !== "CLOSED") {
          await prisma.case.update({ where: { id: caseId }, data: { status: targetStatus } });
          deadlineCaseStatus++;
        }
      }
    }
  }
  console.log(`  ✅ Review 생성: ${deadlineReviewCreated} / 기존 Review 링크 보정: ${deadlineReviewLinked} / Case link: ${deadlineCaseLinked} / Case.status: ${deadlineCaseStatus}`);

  // ─────────────────────────────────────────────────────
  // D) 최종 검증
  // ─────────────────────────────────────────────────────
  console.log("\n=== D) 최종 검증 ===");
  const check = await prisma.$queryRaw<{ k: string; v: bigint }[]>`
    SELECT 'decided_case' AS k, COUNT(*)::bigint AS v FROM "Case" WHERE "caseType"='HEARING_LOSS' AND status IN ('APPROVED','REJECTED')
    UNION ALL SELECT 'decided_case_no_review', COUNT(*)::bigint FROM "Case" c
      WHERE c."caseType"='HEARING_LOSS' AND c.status IN ('APPROVED','REJECTED')
        AND NOT EXISTS (SELECT 1 FROM "ObjectionReview" r WHERE r."caseId"=c.id)
    UNION ALL SELECT 'oc_no_review', COUNT(*)::bigint FROM "ObjectionCase" oc
      WHERE oc."caseType"='HEARING_LOSS'
        AND oc."reviewId" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "ObjectionReview" r WHERE r."caseId"=oc."caseId" OR (r."tfName"=oc."tfName" AND r."patientName"=oc."patientName" AND r."caseType"='HEARING_LOSS'))
    UNION ALL SELECT 'case_hl_mismatch', COUNT(*)::bigint FROM "Case" c
      LEFT JOIN "hearing_loss_details" h ON h."caseId"=c.id
      WHERE c."caseType"='HEARING_LOSS'
        AND ((c.status='APPROVED' AND (h."decisionType" IS NULL OR h."decisionType"!='APPROVED'))
          OR (c.status='REJECTED' AND (h."decisionType" IS NULL OR h."decisionType"!='REJECTED')))
  `;
  for (const row of check) console.log(`  ${row.k}: ${row.v}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
