import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { syncFromObjectionReview } from "@/lib/case-sync";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    tfName, patientName, caseType, approvalStatus, progressStatus, decisionDate,
    hasInfoDisclosure, infoDisclosureStatus, memo, caseId,
  } = body;

  // 부분 업데이트 지원: undefined 인 필드는 변경하지 않음
  const data: Record<string, unknown> = {};
  if (tfName !== undefined) data.tfName = tfName;
  if (patientName !== undefined) data.patientName = patientName;
  if (caseType !== undefined) data.caseType = caseType;
  if (approvalStatus !== undefined) data.approvalStatus = approvalStatus;
  if (progressStatus !== undefined) data.progressStatus = progressStatus;
  if (decisionDate !== undefined) data.decisionDate = decisionDate ? new Date(decisionDate) : null;
  if (infoDisclosureStatus !== undefined) {
    data.infoDisclosureStatus = infoDisclosureStatus ?? null;
    data.hasInfoDisclosure = ["확보", "평임확보"].includes(infoDisclosureStatus);
  } else if (hasInfoDisclosure !== undefined) {
    data.hasInfoDisclosure = !!hasInfoDisclosure;
  }
  if (memo !== undefined) data.memo = memo || null;
  if (caseId !== undefined) data.caseId = caseId || null;
  // (송무 인계 필드는 ObjectionCase 모델로 이동됨 — /api/objection/cases/[id] PATCH에서 처리)

  const item = await prisma.objectionReview.update({
    where: { id },
    data,
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
      // 제척도래일 자동 산정 (처분일 + 90일)
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
          examClaimDeadline,
          approvalStatus: item.approvalStatus,
          progressStatus: "접수대기",
        }
      });
    }
  }

  // Case + HearingLossDetail 싱크 (소음성 난청 & 링크된 경우만)
  await syncFromObjectionReview(item.id);

  // progressStatus 변경 시 Todo 자동 생성
  const TODO_TRIGGER_STATUS: Record<string, { title: string; type: string }> = {
    "이의제기 진행": { title: "이의제기 이유서 작성 필요", type: "OBJECTION_DEADLINE" },
    "평정청구 진행": { title: "평균임금 정정 청구 서류 준비", type: "WAGE_REQUEST" },
  };

  if (body.progressStatus && TODO_TRIGGER_STATUS[body.progressStatus]) {
    const trigger = TODO_TRIGGER_STATUS[body.progressStatus];

    // 중복 방지: 동일 사건+상태 조합으로 미완료 Todo가 있으면 생성 안 함
    const existingTodo = await prisma.todo.findFirst({
      where: {
        caseId: item.caseId ?? undefined,
        title: { contains: trigger.title },
        isDone: false,
      },
    });

    if (!existingTodo) {
      // 담당자 조회
      let assignedTo = session.user.id;
      let todoPatientName = item.patientName ?? "재해자";

      if (item.caseId) {
        const caseInfo = await prisma.case.findUnique({
          where: { id: item.caseId },
          select: { caseManagerId: true, patient: { select: { name: true } } },
        });
        if (caseInfo?.caseManagerId) assignedTo = caseInfo.caseManagerId;
        if (caseInfo?.patient?.name) todoPatientName = caseInfo.patient.name;
      }

      await prisma.todo.create({
        data: {
          title: `[${todoPatientName}] ${trigger.title}`,
          type: trigger.type,
          caseId: item.caseId ?? null,
          patientName: todoPatientName,
          assignedTo,
          dueDate: null,
        },
      });
    }
  }

  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { assignedTo } = body;

  const updated = await prisma.objectionReview.update({
    where: { id },
    data: { assignedTo: assignedTo || null },
  });

  // assignedTo가 새로 지정된 경우 Todo 자동 생성
  if (assignedTo) {
    const existing = await prisma.todo.findFirst({
      where: {
        caseId: updated.caseId ?? undefined,
        assignedTo,
        type: "GENERAL",
        title: { contains: "처분 검토 요청" },
        isDone: false,
      },
    });

    if (!existing) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      await prisma.todo.create({
        data: {
          title: `[처분검토] ${updated.patientName} 처분 검토 요청`,
          type: "GENERAL",
          dueDate,
          caseId: updated.caseId ?? null,
          patientName: updated.patientName,
          assignedTo,
          isDone: false,
          memo: `TF: ${updated.tfName} / 처분일: ${
            updated.decisionDate
              ? updated.decisionDate.toISOString().split("T")[0]
              : "미입력"
          } / 승인여부: ${updated.approvalStatus}`,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.objectionReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
