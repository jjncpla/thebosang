import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/resolution-notice/[id]/apply
 *
 * ResolutionNotice → Case 자동 인입.
 *  - decisionType "승인" → Case.status = APPROVED
 *  - decisionType "불승인" → Case.status = REJECTED + ObjectionReview 자동 생성
 *  - decisionType "일부승인" → Case.status = PARTIAL_APPROVED + ObjectionReview 자동 생성
 *  - 처분일은 Case에 직접 컬럼이 없어서 변경 안 함 (ObjectionReview.decisionDate에만 저장)
 *  - 적용 후 ResolutionNotice.appliedToCase = true 마킹
 *
 * body (선택):
 *   {
 *     skipObjection?: boolean,   // true면 ObjectionReview 자동 생성 생략
 *     tfName?: string,            // ObjectionReview에 전달 (없으면 case.tfName 사용)
 *   }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role ?? "";
  if (role === "이산계정") {
    return NextResponse.json({ error: "권한 부족" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const skipObjection: boolean = body?.skipObjection === true;
  const overrideTfName: string | undefined = body?.tfName;

  const notice = await prisma.resolutionNotice.findUnique({ where: { id } });
  if (!notice) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (notice.appliedToCase) {
    return NextResponse.json({ error: "이미 적용된 결정통지서" }, { status: 400 });
  }
  if (!notice.caseId) {
    return NextResponse.json({ error: "사건이 매칭되지 않음 — 먼저 match-case 수행" }, { status: 400 });
  }

  const targetCase = await prisma.case.findUnique({
    where: { id: notice.caseId },
    include: { patient: { select: { name: true } } },
  });
  if (!targetCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  // decisionType → Case.status 매핑
  let newStatus: string | null = null;
  let approvalStatusForObjection: string | null = null;
  if (notice.decisionType === "승인") {
    newStatus = "APPROVED";
    approvalStatusForObjection = "승인";
  } else if (notice.decisionType === "불승인") {
    newStatus = "REJECTED";
    approvalStatusForObjection = "불승인";
  } else if (notice.decisionType === "일부승인") {
    newStatus = "PARTIAL_APPROVED";
    approvalStatusForObjection = "일부승인";
  }

  if (!newStatus) {
    return NextResponse.json(
      { error: "decisionType 확인 불가 — 먼저 사용자 검토 후 PATCH로 보정" },
      { status: 400 }
    );
  }

  const userId = (session.user as { id?: string })?.id ?? null;
  let createdObjectionReviewId: string | null = null;

  await prisma.$transaction(async (tx) => {
    // 1. Case.status 업데이트
    await tx.case.update({
      where: { id: targetCase.id },
      data: { status: newStatus },
    });

    // 2. 불승인/일부승인 시 ObjectionReview 자동 생성
    if (
      !skipObjection &&
      approvalStatusForObjection &&
      (approvalStatusForObjection === "불승인" || approvalStatusForObjection === "일부승인")
    ) {
      // 기존 동일 caseId의 ObjectionReview 중복 생성 방지
      const existing = await tx.objectionReview.findFirst({
        where: { caseId: targetCase.id, decisionDate: notice.resolutionDate ?? undefined },
      });

      if (!existing) {
        const created = await tx.objectionReview.create({
          data: {
            caseId: targetCase.id,
            tfName: overrideTfName ?? targetCase.tfName ?? "",
            patientName: targetCase.patient.name,
            caseType: targetCase.caseType,
            decisionDate: notice.resolutionDate ?? null,
            approvalStatus: approvalStatusForObjection,
            progressStatus: "검토중",
            assignedTo: userId,
            memo: notice.rejectionReason
              ? `[자동생성] 결정통지서 OCR 인입\n불승인 사유: ${notice.rejectionReason.slice(0, 500)}`
              : "[자동생성] 결정통지서 OCR 인입",
          },
        });
        createdObjectionReviewId = created.id;
      }
    }

    // 3. ResolutionNotice 인입 완료 마킹
    await tx.resolutionNotice.update({
      where: { id: notice.id },
      data: {
        appliedToCase: true,
        appliedAt: new Date(),
        appliedById: userId,
        requiresUserReview: false,
      },
    });
  });

  return NextResponse.json({
    success: true,
    caseId: targetCase.id,
    newStatus,
    objectionReviewId: createdObjectionReviewId,
    message: `사건 ${targetCase.id}에 ${notice.decisionType} 결정 적용 완료${
      createdObjectionReviewId ? ` (이의제기 검토 자동생성: ${createdObjectionReviewId})` : ""
    }`,
  });
}
