/**
 * 사건 관리(/cases) ↔ 최초총현황(/objection/review) ↔ 기일관리(/objection/deadline)
 * 양방향 싱크 헬퍼
 *
 * 소음성 난청(HEARING_LOSS)에 한해서 싱크 수행.
 * 각 변경 API에서 적절한 시점에 호출하여 세 테이블을 일관되게 유지한다.
 *
 * 상태 매핑:
 *  - HearingLossDetail.decisionType (APPROVED/REJECTED)
 *    ↔ ObjectionReview.approvalStatus (승인/불승인/일부승인)
 *  - ObjectionReview.progressStatus (검토중/이의제기 진행/평정청구 진행/종결)
 *    ↔ Case.status (REVIEWING/OBJECTION/WAGE_CORRECTION/CLOSED)
 *  - ObjectionCase.progressStatus 종결 → ObjectionReview.progressStatus 종결 → Case.status CLOSED
 */
import { prisma } from "@/lib/prisma";

export const PROGRESS_TO_CASE_STATUS: Record<string, string> = {
  "검토중": "REVIEWING",
  "이의제기 진행": "OBJECTION",
  "평정청구 진행": "WAGE_CORRECTION",
  "종결": "CLOSED",
};

export function approvalToDecisionType(approval: string | null): "APPROVED" | "REJECTED" | null {
  if (!approval) return null;
  if (approval === "승인" || approval === "일부승인") return "APPROVED";
  if (approval === "불승인") return "REJECTED";
  return null;
}

export function decisionTypeToApproval(dt: string | null | undefined): "승인" | "불승인" | null {
  if (dt === "APPROVED") return "승인";
  if (dt === "REJECTED") return "불승인";
  return null;
}

/**
 * HearingLossDetail.decisionType 입력/변경 시 Case + ObjectionReview 싱크
 * - Case.status: OBJECTION/WAGE_CORRECTION/CLOSED이면 덮지 않고 유지
 * - ObjectionReview: caseId 매칭 우선, 없으면 tfName+patientName+caseType 매칭, 없으면 신규 생성
 */
export async function syncFromHearingLossDecision(
  caseId: string,
  decisionType: string | null | undefined,
  decisionReceivedAt: Date | null | undefined
) {
  if (!decisionType) return;
  const approval = decisionTypeToApproval(decisionType);
  if (!approval) return;

  const caseInfo = await prisma.case.findUnique({
    where: { id: caseId },
    include: { patient: { select: { name: true } } },
  });
  if (!caseInfo || caseInfo.caseType !== "HEARING_LOSS") return;

  // Case.status 전이 (진행/종결 상태 보존)
  const PRESERVE = new Set(["OBJECTION", "WAGE_CORRECTION", "CLOSED"]);
  if (!PRESERVE.has(caseInfo.status)) {
    const newStatus = decisionType === "APPROVED" ? "APPROVED" : "REJECTED";
    if (caseInfo.status !== newStatus) {
      await prisma.case.update({ where: { id: caseId }, data: { status: newStatus } });
    }
  }

  // ObjectionReview upsert
  let review = await prisma.objectionReview.findFirst({ where: { caseId } });
  if (!review) {
    // 엑셀 인입으로 caseId=null인 건 중 매칭
    review = await prisma.objectionReview.findFirst({
      where: {
        caseType: caseInfo.caseType,
        tfName: caseInfo.tfName ?? "",
        patientName: caseInfo.patient?.name ?? "",
        caseId: null,
      },
    });
  }
  if (review) {
    await prisma.objectionReview.update({
      where: { id: review.id },
      data: {
        caseId: review.caseId ?? caseId,
        approvalStatus: approval,
        decisionDate: decisionReceivedAt ?? review.decisionDate,
      },
    });
  } else {
    await prisma.objectionReview.create({
      data: {
        caseId,
        tfName: caseInfo.tfName ?? "",
        patientName: caseInfo.patient?.name ?? "",
        caseType: caseInfo.caseType,
        approvalStatus: approval,
        progressStatus: "",
        decisionDate: decisionReceivedAt ?? null,
      },
    });
  }
}

/**
 * ObjectionReview 변경 시 Case + HearingLossDetail 싱크
 * - 소음성 난청 + caseId 연결된 경우에만 수행
 * - approvalStatus → HearingLossDetail.decisionType
 * - progressStatus → Case.status (매핑 있을 때만)
 * - 매핑 없고 decisionType만 있으면 Case.status → APPROVED/REJECTED (보존 상태 제외)
 */
export async function syncFromObjectionReview(reviewId: string) {
  const review = await prisma.objectionReview.findUnique({ where: { id: reviewId } });
  if (!review || !review.caseId) return;
  if (review.caseType !== "HEARING_LOSS") return;

  const decisionType = approvalToDecisionType(review.approvalStatus);

  // HearingLossDetail.decisionType + decisionReceivedAt
  if (decisionType) {
    await prisma.hearingLossDetail.upsert({
      where: { caseId: review.caseId },
      create: {
        caseId: review.caseId,
        decisionType,
        decisionReceivedAt: review.decisionDate,
      },
      update: {
        decisionType,
        ...(review.decisionDate ? { decisionReceivedAt: review.decisionDate } : {}),
      },
    });
  }

  // Case.status 전이
  const progressMapped = PROGRESS_TO_CASE_STATUS[review.progressStatus];
  let targetStatus: string | null = null;
  if (progressMapped) targetStatus = progressMapped;
  else if (decisionType === "APPROVED") targetStatus = "APPROVED";
  else if (decisionType === "REJECTED") targetStatus = "REJECTED";

  if (targetStatus) {
    const c = await prisma.case.findUnique({ where: { id: review.caseId }, select: { status: true } });
    // CLOSED면 종결 외로 돌리지 않음 (종결 상태 보호)
    if (c && c.status !== targetStatus) {
      if (c.status === "CLOSED" && targetStatus !== "CLOSED") {
        // skip: 종결 상태를 임의로 되돌리지 않음
      } else {
        await prisma.case.update({ where: { id: review.caseId }, data: { status: targetStatus } });
      }
    }
  }
}

/**
 * ObjectionCase 변경 시 ObjectionReview(+ Case) 싱크
 * - progressStatus=종결이면 ObjectionReview 종결 + Case.status CLOSED
 * - progressStatus=진행중이면 review를 '이의제기 진행'으로 유지
 */
export async function syncFromObjectionCase(objectionCaseId: string) {
  const oc = await prisma.objectionCase.findUnique({ where: { id: objectionCaseId } });
  if (!oc) return;

  const targetReviewProgress =
    oc.progressStatus === "종결" ? "종결" :
    oc.progressStatus === "진행중" ? "이의제기 진행" :
    null;
  if (!targetReviewProgress) return;

  let review = null;
  if (oc.reviewId) review = await prisma.objectionReview.findUnique({ where: { id: oc.reviewId } });
  if (!review && oc.caseId) review = await prisma.objectionReview.findFirst({ where: { caseId: oc.caseId } });
  if (!review) review = await prisma.objectionReview.findFirst({
    where: { tfName: oc.tfName, patientName: oc.patientName, caseType: oc.caseType },
  });
  if (!review) return;

  if (review.progressStatus !== targetReviewProgress) {
    await prisma.objectionReview.update({
      where: { id: review.id },
      data: { progressStatus: targetReviewProgress },
    });
  }

  if (review.caseId) {
    const caseStatus = oc.progressStatus === "종결" ? "CLOSED" : "OBJECTION";
    const c = await prisma.case.findUnique({ where: { id: review.caseId }, select: { status: true } });
    if (c && c.status !== caseStatus) {
      await prisma.case.update({ where: { id: review.caseId }, data: { status: caseStatus } });
    }
  }
}
