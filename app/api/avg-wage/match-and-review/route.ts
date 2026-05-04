import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * OCR 결과 ↔ 사건 DB 매칭 검토
 *
 * 요청 body:
 *   {
 *     workerName?: string,         // 재해자 성명 (필수)
 *     birthDateRaw?: string | null, // YYMMDD (결정통지서)
 *     rrnPrefix?: string | null,    // YYMMDD (평균임금산정내역서)
 *     birthDate?: string | null,    // YYYY-MM-DD (있으면 우선 사용)
 *     accidentDate?: string | null, // YYYY-MM-DD
 *     diagnosisDate?: string | null,// YYYY-MM-DD (평임 산정내역서)
 *     // 비교용 OCR 추출값
 *     ocrFinalAvgWage?: number | null, // 적용평균임금 (= 최종 증감임금)
 *     ocrBaseAvgWage?: number | null,  // 근기법 평균임금
 *     ocrInitialAvgWage?: number | null, // 결정통지서 — 최종 증감임금
 *     ocrOriginalAvgWage?: number | null, // 결정통지서 — 재해 당시 최초 평균임금
 *     ocrPaymentAmount?: number | null,
 *   }
 *
 * 응답:
 *   {
 *     matched: boolean,
 *     matchedCase?: { id, patientName, caseType, status, tfName, branch, ... },
 *     comparison?: {
 *       savedBaseAvgWage, savedFinalAvgWage,
 *       diffBase, diffFinal,
 *       isBaseMatch, isFinalMatch,
 *     },
 *     candidates: [...],   // 매칭된 Case가 0건/2건+일 때 후보 리스트
 *     message: string,
 *   }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const workerName = (body.workerName as string | null)?.trim() || null;
    const birthDateRaw =
      (body.birthDateRaw as string | null) ||
      (body.rrnPrefix as string | null) ||
      null;
    // 추후 재해발생일 기반 보조 매칭에 사용될 변수 (현재는 이름+SSN 매칭만 사용)
    const _birthDateIso = (body.birthDate as string | null) || null;
    const _accidentDate =
      (body.accidentDate as string | null) ||
      (body.diagnosisDate as string | null) ||
      null;
    void _birthDateIso;
    void _accidentDate;

    const ocrFinalAvgWage =
      typeof body.ocrFinalAvgWage === "number"
        ? body.ocrFinalAvgWage
        : typeof body.ocrInitialAvgWage === "number"
          ? body.ocrInitialAvgWage
          : null;
    const ocrBaseAvgWage =
      typeof body.ocrBaseAvgWage === "number"
        ? body.ocrBaseAvgWage
        : typeof body.ocrOriginalAvgWage === "number"
          ? body.ocrOriginalAvgWage
          : null;

    if (!workerName) {
      return NextResponse.json(
        { error: "재해자 성명(workerName) 필수" },
        { status: 400 }
      );
    }

    // ── 1. Patient 매칭 ──
    // 1차: 이름 + ssn(YYMMDD) prefix 매칭
    // 2차: 이름만 매칭 (ssn 미상)
    const ssn6 = birthDateRaw && birthDateRaw.length >= 6 ? birthDateRaw.slice(0, 6) : null;

    const patientCandidates = await prisma.patient.findMany({
      where: ssn6
        ? { name: workerName, ssn: { startsWith: ssn6 } }
        : { name: workerName },
      include: {
        cases: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            caseType: true,
            status: true,
            tfName: true,
            branch: true,
            receptionDate: true,
            contractDate: true,
            createdAt: true,
            patient: { select: { name: true, ssn: true } },
          },
        },
      },
      take: 20,
    });

    // 매칭 후보 펼치기
    type CaseCandidate = {
      caseId: string;
      patientId: string;
      patientName: string;
      ssnMasked: string;
      caseType: string;
      status: string;
      tfName: string | null;
      branch: string | null;
      receptionDate: Date | null;
      contractDate: Date | null;
      createdAt: Date;
    };
    const candidates: CaseCandidate[] = [];
    for (const p of patientCandidates) {
      for (const c of p.cases) {
        candidates.push({
          caseId: c.id,
          patientId: p.id,
          patientName: p.name,
          ssnMasked:
            p.ssn.length > 8 ? p.ssn.slice(0, 8) + "******" : p.ssn,
          caseType: c.caseType,
          status: c.status,
          tfName: c.tfName,
          branch: c.branch,
          receptionDate: c.receptionDate,
          contractDate: c.contractDate,
          createdAt: c.createdAt,
        });
      }
    }

    // ── 2. 매칭 결과 ──
    if (candidates.length === 0) {
      return NextResponse.json({
        matched: false,
        candidates: [],
        message: ssn6
          ? `매칭 사건 없음 — 재해자명 "${workerName}" + 생년월일 ${ssn6} 일치 사건 미존재. 등록되지 않은 재해자일 가능성.`
          : `매칭 사건 없음 — 재해자명 "${workerName}" 일치 사건 미존재.`,
      });
    }

    // 단일 매칭 — 검토 결과 비교
    if (candidates.length === 1) {
      const matched = candidates[0];
      const wageReview = await prisma.wageReviewData.findFirst({
        where: { caseId: matched.caseId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          baseAvgWage: true,
          finalAvgWage: true,
          finalSelectedWage: true,
          comparisonWage: true,
          appliedWage: true,
          reviewResult: true,
        },
      });

      // 비교 산출
      const tol = 1; // 1원 이내 일치
      const savedBase = wageReview?.baseAvgWage ?? null;
      const savedFinal = wageReview?.finalAvgWage ?? null;

      const diffBase =
        savedBase !== null && ocrBaseAvgWage !== null
          ? ocrBaseAvgWage - savedBase
          : null;
      const diffFinal =
        savedFinal !== null && ocrFinalAvgWage !== null
          ? ocrFinalAvgWage - savedFinal
          : null;

      const isBaseMatch = diffBase !== null ? Math.abs(diffBase) < tol : null;
      const isFinalMatch = diffFinal !== null ? Math.abs(diffFinal) < tol : null;

      let message: string;
      if (!wageReview) {
        message = `사건 #${matched.caseId.slice(0, 8)} 매칭 — 저장된 평균임금 검토 데이터(WageReviewData) 없음. 신규 등록 또는 OCR 결과를 검토 데이터로 promote하세요.`;
      } else if (isFinalMatch === true) {
        message = `사건 #${matched.caseId.slice(0, 8)} 매칭 — OCR 적용임금과 저장된 적용임금 일치 ✅`;
      } else if (isFinalMatch === false) {
        message = `사건 #${matched.caseId.slice(0, 8)} 매칭 — OCR 적용임금(${ocrFinalAvgWage?.toLocaleString()}원) vs 저장된 적용임금(${savedFinal?.toLocaleString()}원) 불일치. 차이 ${diffFinal?.toLocaleString()}원.`;
      } else {
        message = `사건 #${matched.caseId.slice(0, 8)} 매칭 — OCR 또는 저장된 적용임금 누락. 수동 검토 필요.`;
      }

      return NextResponse.json({
        matched: true,
        matchedCase: matched,
        wageReview,
        comparison: {
          ocrFinalAvgWage,
          ocrBaseAvgWage,
          savedBaseAvgWage: savedBase,
          savedFinalAvgWage: savedFinal,
          diffBase,
          diffFinal,
          isBaseMatch,
          isFinalMatch,
        },
        candidates: [],
        message,
      });
    }

    // 다중 매칭 — 후보 리스트 반환
    return NextResponse.json({
      matched: false,
      candidates,
      message: `매칭 후보 ${candidates.length}건 — 동일 재해자에 복수 사건 존재 (상병별 분리 등). 재해발생일 또는 사건 ID로 수동 매칭 필요.`,
    });
  } catch (e) {
    console.error("[avg-wage/match-and-review] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
