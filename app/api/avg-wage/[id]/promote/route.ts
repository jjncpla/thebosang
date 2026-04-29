import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * AvgWageNotice → WageReviewData 변환
 *
 * 입력 (FormData/JSON):
 *   - tfName        (필수)
 *   - patientName   (필수, 기본값 = AvgWageNotice.workerName)
 *   - caseType      (필수)
 *   - caseId        (선택)
 *   - reviewManagerName (선택)
 *
 * 동작:
 *   1. AvgWageNotice 조회
 *   2. WageReviewData create (자동 추출 필드 매핑)
 *   3. AvgWageNotice.wageReviewId 업데이트
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json();
    const tfName = (body.tfName as string)?.trim();
    const patientName = (body.patientName as string)?.trim();
    const caseType = (body.caseType as string)?.trim();
    const caseId = (body.caseId as string)?.trim() || null;
    const reviewManagerName = (body.reviewManagerName as string)?.trim() || null;
    const reviewResult = (body.reviewResult as string)?.trim() || null;

    if (!tfName || !patientName || !caseType) {
      return NextResponse.json(
        { error: "tfName, patientName, caseType 필수" },
        { status: 400 }
      );
    }

    const notice = await prisma.avgWageNotice.findUnique({ where: { id } });
    if (!notice) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (notice.wageReviewId) {
      return NextResponse.json(
        { error: `이미 WageReviewData 변환됨 (id=${notice.wageReviewId})` },
        { status: 400 }
      );
    }

    // WageReviewData 생성 (자동 추출 필드 매핑)
    const created = await prisma.$transaction(async (tx) => {
      const wage = await tx.wageReviewData.create({
        data: {
          caseId,
          tfName,
          patientName,
          caseType,
          decisionDate: notice.diagnosisDate, // 산정사유발생일
          diagnosisDate: notice.diagnosisDate,
          workplaceName: notice.workplaceName,
          baseAvgWage: notice.baseAvgWage,
          finalAvgWage: notice.finalAvgWage,
          // 비교임금: 특례임금 vs 근기법 평균임금 큰 값
          comparisonWage: (() => {
            const candidates: number[] = [];
            if (notice.baseAvgWage !== null) candidates.push(notice.baseAvgWage);
            if (notice.statWageBase !== null) candidates.push(notice.statWageBase);
            if (candidates.length === 0) return null;
            const max = Math.max(...candidates);
            return max === notice.statWageBase ? "특례임금" : "근기법평임";
          })(),
          appliedWage: notice.wageCalcType, // 임금산정형태
          hasCommuteCoef: notice.commuteCoef !== null && notice.commuteCoef > 0,
          // 노동통계 매핑
          statWageQuarter: notice.statQuarter,
          statWageSize: notice.statSize,
          statWageBase: notice.statWageBase,
          statWageFinal: notice.statWageBase, // 동일 (별도 증감률 적용 전)
          // 검토 결과
          reviewManagerName,
          reviewResult: reviewResult ?? (notice.needsCorrection ? "정정청구 검토 진행" : "검토 진행"),
          reviewDetail: notice.correctionReason,
        },
      });

      // AvgWageNotice 갱신
      await tx.avgWageNotice.update({
        where: { id },
        data: {
          wageReviewId: wage.id,
          caseId: caseId ?? notice.caseId,
          verifyStatus: notice.verifyStatus ?? "변환완료",
        },
      });

      return wage;
    });

    return NextResponse.json({
      success: true,
      wageReviewId: created.id,
      wageReview: created,
    });
  } catch (e) {
    console.error("[avg-wage/promote] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
