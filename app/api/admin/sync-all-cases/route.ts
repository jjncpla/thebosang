import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PROGRESS_TO_CASE_STATUS, approvalToDecisionType } from "@/lib/case-sync";

/**
 * POST /api/admin/sync-all-cases  (최적화 버전)
 *
 * 전체를 메모리에 로드 후 계산, updateMany 배치로 DB 쿼리 최소화.
 * 기존 버전 대비 DB 쿼리: 레코드당 N→ 전체 약 15회
 *
 * 신뢰도: 기일관리(ObjectionCase) > 처분검토(ObjectionReview) > 사건목록(Case.status)
 */

function normalizeCaseType(raw: string): string {
  if (raw === "소음성 난청" || raw === "소음난청") return "HEARING_LOSS";
  if (raw === "진폐") return "PNEUMOCONIOSIS";
  if (raw === "COPD" || raw === "copd") return "COPD";
  if (raw === "근골격계") return "MUSCULOSKELETAL";
  if (raw === "업무상 사고") return "OCCUPATIONAL_ACCIDENT";
  if (raw === "직업성 암") return "OCCUPATIONAL_CANCER";
  if (raw === "유족") return "BEREAVED";
  return raw;
}

export async function POST() {
  const stats = {
    reviewAutoLinked: 0,
    caseAutoLinked: 0,
    caseStatusUpdated: 0,
    hlDecisionUpdated: 0,
    errors: [] as string[],
  };

  // ── 1. 전체 데이터 일괄 로드 ────────────────────────────────────────────
  const [allCases, allReviews, allObjCases, allHLDetails] = await Promise.all([
    prisma.case.findMany({
      select: { id: true, tfName: true, caseType: true, status: true, patient: { select: { name: true } } },
    }),
    prisma.objectionReview.findMany({
      select: { id: true, caseId: true, tfName: true, patientName: true, caseType: true, approvalStatus: true, progressStatus: true, decisionDate: true },
    }),
    prisma.objectionCase.findMany({
      select: { id: true, caseId: true, reviewId: true, tfName: true, patientName: true, caseType: true, progressStatus: true },
    }),
    prisma.hearingLossDetail.findMany({
      select: { caseId: true, decisionType: true, decisionReceivedAt: true },
    }),
  ]);

  // ── 2. Case 룩업맵 생성 (tfName|patientName|caseType → caseId, 중복이면 "__DUP__") ──
  const caseKeyMap = new Map<string, string>();
  for (const c of allCases) {
    const key = `${c.tfName ?? ""}|${c.patient?.name ?? ""}|${c.caseType}`;
    if (caseKeyMap.has(key)) caseKeyMap.set(key, "__DUP__");
    else caseKeyMap.set(key, c.id);
  }
  const caseStatusMap = new Map(allCases.map((c) => [c.id, c.status]));

  // ── 3. 미링크 ObjectionReview 자동 매칭 ─────────────────────────────────
  const reviewLinkUpdates: { id: string; caseId: string }[] = [];
  const reviewCaseIdMap = new Map<string, string>(); // reviewId → resolved caseId

  for (const r of allReviews) {
    if (r.caseId) {
      reviewCaseIdMap.set(r.id, r.caseId);
      continue;
    }
    const key = `${r.tfName ?? ""}|${r.patientName ?? ""}|${normalizeCaseType(r.caseType ?? "")}`;
    const cId = caseKeyMap.get(key);
    if (cId && cId !== "__DUP__") {
      reviewLinkUpdates.push({ id: r.id, caseId: cId });
      reviewCaseIdMap.set(r.id, cId);
    }
  }
  // 기존 링크된 것도 맵에 등록
  for (const r of allReviews) {
    if (r.caseId && !reviewCaseIdMap.has(r.id)) reviewCaseIdMap.set(r.id, r.caseId);
  }

  // ── 4. 미링크 ObjectionCase 자동 매칭 ───────────────────────────────────
  const objCaseLinkUpdates: { id: string; caseId: string }[] = [];
  const objCaseCaseIdMap = new Map<string, string>(); // objCaseId → resolved caseId

  for (const oc of allObjCases) {
    if (oc.caseId) {
      objCaseCaseIdMap.set(oc.id, oc.caseId);
      continue;
    }
    const key = `${oc.tfName ?? ""}|${oc.patientName ?? ""}|${normalizeCaseType(oc.caseType ?? "")}`;
    const cId = caseKeyMap.get(key);
    if (cId && cId !== "__DUP__") {
      objCaseLinkUpdates.push({ id: oc.id, caseId: cId });
      objCaseCaseIdMap.set(oc.id, cId);
    }
  }
  for (const oc of allObjCases) {
    if (oc.caseId && !objCaseCaseIdMap.has(oc.id)) objCaseCaseIdMap.set(oc.id, oc.caseId);
  }

  // ── 5. 자동 매칭 DB 반영 (배치 50건씩) ──────────────────────────────────
  const batchLink = async <T extends { id: string; caseId: string }>(
    items: T[],
    updateFn: (id: string, caseId: string) => Promise<void>
  ) => {
    const BATCH = 50;
    for (let i = 0; i < items.length; i += BATCH) {
      await Promise.all(items.slice(i, i + BATCH).map((it) => updateFn(it.id, it.caseId)));
    }
  };

  await batchLink(reviewLinkUpdates, (id, caseId) =>
    prisma.objectionReview.update({ where: { id }, data: { caseId } }).then(() => void 0)
  );
  stats.reviewAutoLinked = reviewLinkUpdates.length;

  await batchLink(objCaseLinkUpdates, (id, caseId) =>
    prisma.objectionCase.update({ where: { id }, data: { caseId } }).then(() => void 0)
  );
  stats.caseAutoLinked = objCaseLinkUpdates.length;

  // ── 6. 목표 Case.status 결정 (메모리 연산) ──────────────────────────────
  // 신뢰도: 기일관리(ObjectionCase) > 처분검토(ObjectionReview)
  const targetCaseStatus = new Map<string, string>(); // caseId → targetStatus

  // caseType lookup (영문 enum 도메인 vs 한글 도메인 분기에 사용)
  const caseTypeOf = new Map<string, string>();
  for (const c of allCases) caseTypeOf.set(c.id, c.caseType);

  // 처분검토 기준 (낮은 우선순위) — HEARING_LOSS만 적용 (그 외는 caseType별 자체 sync 유지)
  for (const r of allReviews) {
    const cId = r.caseId ?? reviewCaseIdMap.get(r.id);
    if (!cId) continue;
    if (caseTypeOf.get(cId) !== "HEARING_LOSS") continue; // COPD/근골격계 한글 status 도메인 보호
    const progressMapped = PROGRESS_TO_CASE_STATUS[r.progressStatus ?? ""];
    if (progressMapped) {
      targetCaseStatus.set(cId, progressMapped);
    } else {
      const dt = approvalToDecisionType(r.approvalStatus);
      if (dt === "APPROVED") targetCaseStatus.set(cId, "APPROVED");
      else if (dt === "REJECTED") targetCaseStatus.set(cId, "REJECTED");
    }
  }

  // 기일관리 기준 (높은 우선순위 — 처분검토 결과 덮어씀) — caseType별 분기
  for (const oc of allObjCases) {
    const cId = oc.caseId ?? objCaseCaseIdMap.get(oc.id);
    if (!cId) continue;
    const ct = caseTypeOf.get(cId);
    const isHL = ct === "HEARING_LOSS";
    if (oc.progressStatus === "종결") {
      targetCaseStatus.set(cId, isHL ? "CLOSED" : "종결");
    } else if (oc.progressStatus === "진행중") {
      targetCaseStatus.set(cId, isHL ? "OBJECTION" : "이의제기");
    }
  }

  // ── 7. Case.status 변경 대상 필터링 ─────────────────────────────────────
  // CLOSED 상태는 CLOSED 외로 되돌리지 않음
  const byStatus = new Map<string, string[]>();
  for (const [cId, targetStatus] of targetCaseStatus) {
    const current = caseStatusMap.get(cId);
    if (!current) continue;
    if (current === "CLOSED" && targetStatus !== "CLOSED") continue; // 보호
    if (current === targetStatus) continue; // 변경 불필요
    if (!byStatus.has(targetStatus)) byStatus.set(targetStatus, []);
    byStatus.get(targetStatus)!.push(cId);
  }

  // updateMany (status별 배치)
  for (const [status, ids] of byStatus) {
    const r = await prisma.case.updateMany({ where: { id: { in: ids } }, data: { status } });
    stats.caseStatusUpdated += r.count;
  }

  // ── 8. HearingLossDetail.decisionType 싱크 ──────────────────────────────
  const hlMap = new Map(allHLDetails.map((h) => [h.caseId, h]));
  const hlUpserts: { caseId: string; decisionType: string; decisionDate: Date | null }[] = [];

  for (const r of allReviews) {
    const cId = r.caseId ?? reviewCaseIdMap.get(r.id);
    if (!cId) continue;
    if (caseTypeOf.get(cId) !== "HEARING_LOSS") continue; // COPD/근골격계 등은 HearingLossDetail 만들지 않음
    const dt = approvalToDecisionType(r.approvalStatus);
    if (!dt) continue;
    const existing = hlMap.get(cId);
    if (existing?.decisionType === dt) continue; // 변경 불필요
    hlUpserts.push({ caseId: cId, decisionType: dt, decisionDate: r.decisionDate ?? null });
  }

  // upsert는 배치 50
  const HL_BATCH = 50;
  for (let i = 0; i < hlUpserts.length; i += HL_BATCH) {
    await Promise.all(
      hlUpserts.slice(i, i + HL_BATCH).map((u) =>
        prisma.hearingLossDetail.upsert({
          where: { caseId: u.caseId },
          create: { caseId: u.caseId, decisionType: u.decisionType, decisionReceivedAt: u.decisionDate },
          update: { decisionType: u.decisionType, ...(u.decisionDate ? { decisionReceivedAt: u.decisionDate } : {}) },
        })
      )
    );
    stats.hlDecisionUpdated += hlUpserts.slice(i, i + HL_BATCH).length;
  }

  return NextResponse.json({ ok: true, stats });
}
