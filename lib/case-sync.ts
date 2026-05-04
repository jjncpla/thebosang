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
import { generateAndStoreLaborAttorneyRecord } from "@/lib/pdf/labor-attorney-record";

/**
 * 처분결정(승인/불승인/반려)이 확정된 사건에 대해 공인노무사 업무처리부 PDF 자동 생성
 * 실패해도 메인 흐름을 깨지 않도록 try-catch
 */
async function autoGenerateLaborAttorneyRecord(caseId: string) {
  try {
    await generateAndStoreLaborAttorneyRecord(caseId);
  } catch (e) {
    console.error("[autoGenerateLaborAttorneyRecord]", caseId, e);
  }
}

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
 * Case.status 변경 시 HL.decisionType + ObjectionReview 싱크 (양방향)
 *
 * 규칙:
 *  - APPROVED/REJECTED: HL.decisionType 맞추고 Review 보장
 *  - OBJECTION/WAGE_CORRECTION: Review 유지 (이의제기 흐름)
 *  - CLOSED: ObjectionCase 기록 있으면 Review 유지, 없으면 결정 철회로 간주
 *  - 그 외 (CONSULTING/DECISION_RECEIVED/반려/파기 등): 결정 철회 →
 *    ObjectionCase 없으면 Review 삭제 + HL.decisionType=null
 */
export async function syncFromCaseStatus(caseId: string) {
  const caseInfo = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: { select: { name: true } },
      hearingLoss: { select: { decisionType: true, decisionReceivedAt: true } },
    },
  });
  if (!caseInfo) return;

  // COPD 등 비-HL 케이스: closedReason 반려/파기 시 업무처리부만 생성하고 종료
  // (HL 전용 ObjectionReview 싱크 로직은 적용하지 않음)
  if (caseInfo.caseType !== "HEARING_LOSS") {
    if (caseInfo.closedReason === "반려" || caseInfo.closedReason === "파기") {
      await autoGenerateLaborAttorneyRecord(caseId);
    }
    return;
  }

  const status = caseInfo.status;

  // ── (1) 결정 상태인 경우: HL + Review 보장 ───────────────────
  if (status === "APPROVED" || status === "REJECTED") {
    if (caseInfo.hearingLoss?.decisionType !== status) {
      await prisma.hearingLossDetail.upsert({
        where: { caseId },
        create: { caseId, decisionType: status },
        update: { decisionType: status },
      });
    }
    const approval = status === "APPROVED" ? "승인" : "불승인";
    let review = await prisma.objectionReview.findFirst({ where: { caseId } });
    if (!review) {
      review = await prisma.objectionReview.findFirst({
        where: {
          caseType: "HEARING_LOSS",
          tfName: caseInfo.tfName ?? "",
          patientName: caseInfo.patient?.name ?? "",
          caseId: null, // 이미 다른 caseId에 묶인 Review 오매칭 방지 (동명이인 안전성)
        },
      });
      if (review) {
        await prisma.objectionReview.update({
          where: { id: review.id },
          data: { caseId: review.caseId ?? caseId, approvalStatus: review.approvalStatus || approval },
        });
      } else {
        await prisma.objectionReview.create({
          data: {
            caseId,
            tfName: caseInfo.tfName ?? "",
            patientName: caseInfo.patient?.name ?? "",
            caseType: "HEARING_LOSS",
            approvalStatus: approval,
            progressStatus: "",
            decisionDate: caseInfo.hearingLoss?.decisionReceivedAt ?? null,
          },
        });
      }
    }
    // 결정 확정 → 업무처리부 자동 생성
    await autoGenerateLaborAttorneyRecord(caseId);
    return;
  }

  // ── (2) 이의제기 흐름 상태: Review 보존 ─────────────────────
  if (status === "OBJECTION" || status === "WAGE_CORRECTION") return;

  // ── (3) 나머지 상태 (CLOSED, CONSULTING, 반려, 파기 등) ─────
  // Review가 있고 → ObjectionCase 기록 여부로 판단
  const review = await prisma.objectionReview.findFirst({ where: { caseId } });
  if (!review) return;

  const hasObjectionCase = await prisma.objectionCase.findFirst({
    where: { OR: [{ caseId }, { reviewId: review.id }] },
  });
  // 이의제기 활동이 있었던 건: 그대로 보존
  if (hasObjectionCase) return;
  // CLOSED에 Review.progressStatus=종결이면 정상 종결로 간주 — 보호
  if (status === "CLOSED" && review.progressStatus === "종결") return;

  // → 결정이 철회되었거나 잘못 입력된 건 → Review 삭제 + HL.decisionType 리셋
  if (caseInfo.hearingLoss?.decisionType) {
    await prisma.hearingLossDetail.update({
      where: { caseId },
      data: { decisionType: null },
    }).catch(() => {});
  }
  await prisma.objectionReview.delete({ where: { id: review.id } }).catch(() => {});

  // 반려/파기로 closedReason이 지정된 경우에도 업무처리부 생성 (보관용)
  if (caseInfo.closedReason === "반려" || caseInfo.closedReason === "파기") {
    await autoGenerateLaborAttorneyRecord(caseId);
  }
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

  // 결정 확정 → 업무처리부 자동 생성
  await autoGenerateLaborAttorneyRecord(caseId);
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

  // 승인/불승인/일부승인 → 업무처리부 자동 생성
  if (decisionType) {
    await autoGenerateLaborAttorneyRecord(review.caseId);
  }
}

/**
 * COPD 회차 처분 결정 시 ObjectionReview 자동 upsert
 * - CopdApplication.disposalType (요양) + disabilityDispositionType (장해) 종합 판정
 * - 가장 최근 회차(applicationRound 내림차순) 기준
 * - 우선순위: 장해 처분이 입력되면 그것을 기준, 없으면 요양 처분
 */
export async function syncFromCopdDecision(caseId: string) {
  const caseInfo = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: { select: { name: true } },
      copd: {
        include: {
          applications: {
            orderBy: { applicationRound: "desc" }, // 모두 가져와서 처분 있는 회차 fallback
          },
        },
      },
    },
  });
  if (!caseInfo || caseInfo.caseType !== "COPD") return;
  const apps = caseInfo.copd?.applications ?? [];
  if (apps.length === 0) return;
  // 처분(요양 또는 장해)이 입력된 가장 최근 회차를 사용
  // → 새 회차가 빈 상태로 추가돼도 직전 처분의 ObjectionReview는 유지됨
  const latest =
    apps.find(
      (a) =>
        a.disabilityDispositionType ||
        a.disposalType === "승인" ||
        a.disposalType === "부지급"
    ) ?? apps[0];

  // 결정 산출
  let approval: "승인" | "불승인" | null = null;
  let decisionDate: Date | null = null;

  // 90일 이의제기 D-day 기산은 결정통지 수령일 기준 — 입력됐으면 그것을 우선 사용
  const noticeDate = latest.disposalNoticeReceivedAt ?? null;
  if (latest.disabilityDispositionType === "부지급") {
    approval = "불승인";
    decisionDate = noticeDate ?? latest.disabilityDispositionDate ?? latest.disposalDate ?? null;
  } else if (latest.disabilityDispositionType === "일시금" || latest.disabilityDispositionType === "연금") {
    approval = "승인";
    decisionDate = noticeDate ?? latest.disabilityDispositionDate ?? null;
  } else if (latest.disposalType === "승인") {
    approval = "승인";
    decisionDate = noticeDate ?? latest.disposalDate ?? null;
  } else if (latest.disposalType === "부지급") {
    approval = "불승인";
    decisionDate = noticeDate ?? latest.disposalDate ?? null;
  }
  // "반려"/"보류"/null은 처분이 아직 확정되지 않은 상태로 간주 → Review 생성 안 함

  // 질판위 기각 케이스 — 처분은 아직 없지만 사용자가 즉시 이의제기 절차 검토하도록 빈 Review 생성
  // (어떤 회차에서든 기각이 한 번이라도 입력됐으면 Review 생성)
  const hasOccRejection = apps.some((a) => a.occResult === "기각");

  if (!approval) {
    if (hasOccRejection) {
      // 기각만 있고 처분이 없는 케이스 — 빈 approvalStatus + 메모로 표시
      let review = await prisma.objectionReview.findFirst({ where: { caseId } });
      if (!review) {
        await prisma.objectionReview.create({
          data: {
            caseId,
            tfName: caseInfo.tfName ?? "",
            patientName: caseInfo.patient?.name ?? "",
            caseType: "COPD",
            approvalStatus: "",
            progressStatus: "",
            decisionDate: null,
            memo: "[COPD_AUTO] 질판위 기각 — 이의제기 검토 필요",
          },
        });
      }
      return;
    }
    // 처분이 철회된 경우 — 기존 자동 생성 Review가 있으면 정리 (사용자 수동 입력은 보존)
    const auto = await prisma.objectionReview.findFirst({
      where: { caseId, memo: { contains: "[COPD_AUTO]" } },
    });
    if (auto) await prisma.objectionReview.delete({ where: { id: auto.id } }).catch(() => {});
    return;
  }

  // upsert
  let review = await prisma.objectionReview.findFirst({ where: { caseId } });
  if (!review) {
    review = await prisma.objectionReview.findFirst({
      where: {
        caseType: "COPD",
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
        decisionDate: decisionDate ?? review.decisionDate,
      },
    });
  } else {
    await prisma.objectionReview.create({
      data: {
        caseId,
        tfName: caseInfo.tfName ?? "",
        patientName: caseInfo.patient?.name ?? "",
        caseType: "COPD",
        approvalStatus: approval,
        progressStatus: "",
        decisionDate,
        memo: "[COPD_AUTO] 회차 처분 자동 인입 — 회차 R" + latest.applicationRound,
      },
    });
  }

  // 결정 확정 → 업무처리부 자동 생성 (HEARING_LOSS와 동일)
  await autoGenerateLaborAttorneyRecord(caseId);

  // 승인 시 WageReviewData 자동 생성 (HL의 처분검토 POST/PATCH 흐름과 동일)
  if (approval === "승인") {
    const existingWage = await prisma.wageReviewData.findFirst({ where: { caseId } });
    if (!existingWage) {
      await prisma.wageReviewData.create({
        data: {
          caseId,
          tfName: caseInfo.tfName ?? "",
          patientName: caseInfo.patient?.name ?? "",
          caseType: "COPD",
          decisionDate,
          hasInfoDisclosure: false,
        },
      });
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
    const c = await prisma.case.findUnique({
      where: { id: review.caseId },
      select: { status: true, caseType: true },
    });
    if (c) {
      // caseType별로 status 값 도메인 분리: HEARING_LOSS는 영문 enum, 그 외(COPD 등)는 한글
      const caseStatus =
        c.caseType === "HEARING_LOSS"
          ? oc.progressStatus === "종결" ? "CLOSED" : "OBJECTION"
          : oc.progressStatus === "종결" ? "종결" : "이의제기";
      if (c.status !== caseStatus) {
        await prisma.case.update({ where: { id: review.caseId }, data: { status: caseStatus } });
      }
    }
  }
}
