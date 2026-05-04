import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { syncFromObjectionReview } from "@/lib/case-sync";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tfName = searchParams.get("tfName");
  const progressStatus = searchParams.get("progressStatus");
  const caseType = searchParams.get("caseType");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (tfName) where.tfName = tfName;
  if (progressStatus) where.progressStatus = progressStatus;
  if (caseType) where.caseType = caseType;
  if (search) where.patientName = { contains: search, mode: "insensitive" };

  // 🏎️ 응답 경량화: 페이지 렌더링에 필요한 컬럼만 조회 (memo/updatedAt 제외)
  const [items, decisionCases] = await Promise.all([
    prisma.objectionReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tfName: true,
        patientName: true,
        caseType: true,
        approvalStatus: true,
        progressStatus: true,
        decisionDate: true,
        hasInfoDisclosure: true,
        infoDisclosureStatus: true,
        memo: true,
        caseId: true,
        assignedTo: true,
      },
    }),
    // 결정 수령 상태 사건 자동 인입 (HL: DECISION_RECEIVED + COPD/근골격계: 한글 status 승인/불승인)
    prisma.case.findMany({
      where: {
        OR: [
          { status: 'DECISION_RECEIVED' }, // HEARING_LOSS 영문 enum
          { status: { in: ['승인', '불승인', '이의제기'] } }, // COPD/근골격계 한글 status
        ],
        ...(tfName ? { tfName } : {}),
        ...(caseType ? { caseType } : {}),
        ...(search ? { patient: { name: { contains: search, mode: "insensitive" as const } } } : {}),
      },
      select: {
        id: true,
        tfName: true,
        caseType: true,
        status: true,
        patient: { select: { name: true } },
        hearingLoss: { select: { decisionReceivedAt: true } },
        copd: {
          select: {
            applications: {
              orderBy: { applicationRound: 'desc' },
              take: 1,
              select: { disposalDate: true, disabilityDispositionDate: true, disposalType: true, disabilityDispositionType: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // 이미 처분검토 테이블에 있는 caseId는 제외
  const existingCaseIds = new Set(items.map(r => r.caseId).filter(Boolean) as string[]);
  const autoItems = decisionCases
    .filter(c => !existingCaseIds.has(c.id))
    .map(c => {
      // caseType별로 decisionDate / approvalStatus 산출
      let autoDecisionDate: string | null = null;
      let autoApproval = '';
      if (c.caseType === 'HEARING_LOSS') {
        autoDecisionDate = c.hearingLoss?.decisionReceivedAt?.toISOString() ?? null;
      } else if (c.caseType === 'COPD') {
        const latest = c.copd?.applications[0];
        if (latest) {
          autoDecisionDate = (latest.disabilityDispositionDate ?? latest.disposalDate)?.toISOString() ?? null;
          if (latest.disabilityDispositionType === '부지급' || latest.disposalType === '부지급') autoApproval = '불승인';
          else if (latest.disabilityDispositionType === '일시금' || latest.disabilityDispositionType === '연금' || latest.disposalType === '승인') autoApproval = '승인';
        }
      }
      return {
        id: `auto_${c.id}`,
        tfName: c.tfName ?? '',
        patientName: c.patient.name,
        caseType: c.caseType,
        approvalStatus: autoApproval,
        progressStatus: '',
        decisionDate: autoDecisionDate,
        hasInfoDisclosure: false,
        infoDisclosureStatus: null,
        memo: null,
        caseId: c.id,
        isAutoFilled: true,
        assignedTo: null,
      };
    });

  return NextResponse.json([...autoItems, ...items]);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // reassign되는 필드 (caseId 자동 조회 fallback에서)
  let { tfName, patientName, caseType, progressStatus } = body;
  // reassign되지 않는 필드 — const로 분리
  const { approvalStatus, decisionDate, hasInfoDisclosure, infoDisclosureStatus, memo, caseId } = body;

  // caseId 제공 시 케이스 데이터 자동 조회 (처분검토 자동 반영용)
  if (caseId && (!tfName || !patientName)) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { patient: { select: { name: true } } },
    });
    if (caseData) {
      tfName = tfName || caseData.tfName || "";
      patientName = patientName || caseData.patient?.name || "";
      caseType = caseType || caseData.caseType || "";
      progressStatus = progressStatus || "검토중";
    }
  }

  if (!tfName || !patientName || !approvalStatus) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  // caseId가 있으면 upsert (기존 레코드 업데이트, 없으면 생성)
  if (caseId) {
    const existing = await prisma.objectionReview.findFirst({ where: { caseId } });
    if (existing) {
      const updated = await prisma.objectionReview.update({
        where: { id: existing.id },
        data: { approvalStatus, ...(progressStatus && { progressStatus }) },
      });

      if (updated.progressStatus === "평정청구 진행" || updated.approvalStatus === "승인" || updated.approvalStatus === "일부승인") {
        const existingWageReview = await prisma.wageReviewData.findFirst({ where: { caseId } });
        if (!existingWageReview) {
          await prisma.wageReviewData.create({
            data: {
              caseId,
              tfName: updated.tfName,
              patientName: updated.patientName,
              caseType: updated.caseType,
              decisionDate: updated.decisionDate,
              hasInfoDisclosure: updated.hasInfoDisclosure,
            }
          });
        }
      }

      if (updated.progressStatus === "이의제기 진행") {
        const existingObjectionCase = await prisma.objectionCase.findFirst({ where: { caseId } });
        if (!existingObjectionCase) {
          // 90일 제척기간 자동 계산 (산재법 §103 심사청구 기간)
          let examClaimDeadline: Date | null = null;
          if (updated.decisionDate) {
            examClaimDeadline = new Date(updated.decisionDate);
            examClaimDeadline.setDate(examClaimDeadline.getDate() + 90);
          }
          await prisma.objectionCase.create({
            data: {
              caseId,
              reviewId: updated.id,
              tfName: updated.tfName,
              patientName: updated.patientName,
              caseType: updated.caseType,
              decisionDate: updated.decisionDate,
              approvalStatus: updated.approvalStatus,
              progressStatus: "진행중",
              examClaimDeadline,
            }
          });
        }
      }

      // Case + HearingLossDetail 싱크
      await syncFromObjectionReview(updated.id);

      return NextResponse.json(updated);
    }
  }

  const item = await prisma.objectionReview.create({
    data: {
      tfName,
      patientName,
      caseType: caseType || "",
      approvalStatus,
      progressStatus,
      decisionDate: decisionDate ? new Date(decisionDate) : null,
      hasInfoDisclosure: infoDisclosureStatus
        ? ["확보", "평임확보"].includes(infoDisclosureStatus)
        : !!hasInfoDisclosure,
      infoDisclosureStatus: infoDisclosureStatus || null,
      memo: memo || null,
      caseId: caseId || null,
    },
  });

  if (item.progressStatus === "평정청구 진행" || item.approvalStatus === "승인" || item.approvalStatus === "일부승인") {
    let existingWageReview;
    if (item.caseId) {
      existingWageReview = await prisma.wageReviewData.findFirst({ where: { caseId: item.caseId } });
    } else {
      existingWageReview = await prisma.wageReviewData.findFirst({
        where: { tfName: item.tfName, patientName: item.patientName, caseType: item.caseType }
      });
    }

    if (!existingWageReview) {
      await prisma.wageReviewData.create({
        data: {
          caseId: item.caseId || null,
          tfName: item.tfName,
          patientName: item.patientName,
          caseType: item.caseType,
          decisionDate: item.decisionDate,
          hasInfoDisclosure: item.hasInfoDisclosure,
        }
      });
    }
  }

  if (item.progressStatus === "이의제기 진행") {
    let existingObjectionCase;
    if (item.caseId) {
      existingObjectionCase = await prisma.objectionCase.findFirst({ where: { caseId: item.caseId } });
    } else {
      existingObjectionCase = await prisma.objectionCase.findFirst({
        where: { tfName: item.tfName, patientName: item.patientName, caseType: item.caseType }
      });
    }

    if (!existingObjectionCase) {
      // 90일 제척기간 자동 계산
      let examClaimDeadline: Date | null = null;
      if (item.decisionDate) {
        examClaimDeadline = new Date(item.decisionDate);
        examClaimDeadline.setDate(examClaimDeadline.getDate() + 90);
      }
      await prisma.objectionCase.create({
        data: {
          caseId: item.caseId || null,
          reviewId: item.id,
          tfName: item.tfName,
          patientName: item.patientName,
          caseType: item.caseType,
          decisionDate: item.decisionDate,
          approvalStatus: item.approvalStatus,
          progressStatus: "진행중",
          examClaimDeadline,
        }
      });
    }
  }

  // Case + HearingLossDetail 싱크 (소음성 난청 & 링크된 경우만)
  await syncFromObjectionReview(item.id);

  return NextResponse.json(item, { status: 201 });
}
