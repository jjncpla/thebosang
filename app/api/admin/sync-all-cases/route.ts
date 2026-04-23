import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFromObjectionCase, syncFromObjectionReview } from "@/lib/case-sync";

/**
 * POST /api/admin/sync-all-cases
 *
 * 전체 싱크 배치 작업:
 * 1. 미링크 ObjectionReview 자동 매칭 (tfName + patientName + caseType으로 Case 찾아 caseId 연결)
 * 2. 미링크 ObjectionCase 자동 매칭
 * 3. ObjectionCase → ObjectionReview → Case.status 캐스케이드 싱크
 * 4. ObjectionReview → Case.status 싱크 (기일관리 없는 처분검토 건 포함)
 *
 * 신뢰도: 기일관리(ObjectionCase) > 처분검토(ObjectionReview) > 사건목록(Case.status)
 */
export async function POST() {
  const stats = {
    reviewAutoLinked: 0,
    caseAutoLinked: 0,
    objectionCaseSynced: 0,
    objectionReviewSynced: 0,
    errors: [] as string[],
  };

  // ─── Step 1: 미링크 ObjectionReview → Case 자동 매칭 ───────────────────
  const unlinkedReviews = await prisma.objectionReview.findMany({
    where: { caseId: null },
    select: { id: true, tfName: true, patientName: true, caseType: true },
  });

  for (const review of unlinkedReviews) {
    try {
      // caseType 매핑: ObjectionReview는 "HEARING_LOSS" 등 영문 or 한글 혼재 가능
      const caseTypeFilter = review.caseType === "소음성 난청" ? "HEARING_LOSS"
        : review.caseType === "COPD" ? "COPD"
        : review.caseType === "진폐" ? "PNEUMOCONIOSIS"
        : review.caseType; // already English

      const matches = await prisma.case.findMany({
        where: {
          tfName: review.tfName,
          caseType: caseTypeFilter,
          patient: { name: review.patientName },
        },
        select: { id: true },
      });

      if (matches.length === 1) {
        await prisma.objectionReview.update({
          where: { id: review.id },
          data: { caseId: matches[0].id },
        });
        stats.reviewAutoLinked++;
      }
      // matches.length > 1 → ambiguous, skip
    } catch (e) {
      stats.errors.push(`ObjectionReview ${review.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── Step 2: 미링크 ObjectionCase → Case 자동 매칭 ────────────────────
  const unlinkedObjCases = await prisma.objectionCase.findMany({
    where: { caseId: null },
    select: { id: true, tfName: true, patientName: true, caseType: true },
  });

  for (const oc of unlinkedObjCases) {
    try {
      const caseTypeFilter = oc.caseType === "소음성 난청" ? "HEARING_LOSS"
        : oc.caseType === "COPD" ? "COPD"
        : oc.caseType === "진폐" ? "PNEUMOCONIOSIS"
        : oc.caseType;

      const matches = await prisma.case.findMany({
        where: {
          tfName: oc.tfName,
          caseType: caseTypeFilter,
          patient: { name: oc.patientName },
        },
        select: { id: true },
      });

      if (matches.length === 1) {
        await prisma.objectionCase.update({
          where: { id: oc.id },
          data: { caseId: matches[0].id },
        });
        stats.caseAutoLinked++;
      }
    } catch (e) {
      stats.errors.push(`ObjectionCase ${oc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── Step 3: ObjectionCase → ObjectionReview → Case 캐스케이드 싱크 ────
  const allObjCases = await prisma.objectionCase.findMany({
    where: { caseId: { not: null } },
    select: { id: true },
  });

  for (const oc of allObjCases) {
    try {
      await syncFromObjectionCase(oc.id);
      stats.objectionCaseSynced++;
    } catch (e) {
      stats.errors.push(`syncFromObjectionCase ${oc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── Step 4: ObjectionReview → Case.status 싱크 (기일관리 없는 건 포함) ─
  // Step 3에서 싱크된 건들도 재싱크해도 무방 (idempotent)
  const allLinkedReviews = await prisma.objectionReview.findMany({
    where: { caseId: { not: null } },
    select: { id: true },
  });

  for (const review of allLinkedReviews) {
    try {
      await syncFromObjectionReview(review.id);
      stats.objectionReviewSynced++;
    } catch (e) {
      stats.errors.push(`syncFromObjectionReview ${review.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, stats });
}
