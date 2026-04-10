import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { tfName, patientName, caseType, approvalStatus, progressStatus, decisionDate, hasInfoDisclosure, memo, caseId } = body;

  const item = await prisma.objectionReview.update({
    where: { id },
    data: {
      tfName,
      patientName,
      caseType,
      approvalStatus,
      progressStatus,
      decisionDate: decisionDate ? new Date(decisionDate) : null,
      hasInfoDisclosure: !!hasInfoDisclosure,
      memo: memo || null,
      caseId: caseId || null,
    },
  });

  if (item.progressStatus === "평정청구 진행" || item.approvalStatus === "승인") {
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
          progressStatus: "진행중",
        }
      });
    }
  }

  // Case.status 자동 전이
  if (item.caseId) {
    const statusMap: Record<string, string> = {
      '검토중': 'REVIEWING',
      '이의제기 진행': 'OBJECTION',
      '평정청구 진행': 'WAGE_CORRECTION',
      '종결': 'CLOSED',
      '송무 인계': 'CLOSED',
      '송무 검토': 'CLOSED',
    };
    const newStatus = statusMap[item.progressStatus];
    if (newStatus) {
      await prisma.case.update({
        where: { id: item.caseId },
        data: { status: newStatus },
      });
    }
  }

  // progressStatus 변경 시 Todo 자동 생성
  const TODO_TRIGGER_STATUS: Record<string, { title: string; type: string }> = {
    "이의제기 진행": { title: "이의제기 이유서 작성 필요", type: "OBJECTION_DEADLINE" },
    "평정청구 진행": { title: "평균임금 정정 청구 서류 준비", type: "WAGE_REQUEST" },
    "송무 검토":    { title: "송무 검토 필요", type: "GENERAL" },
    "송무 인계":    { title: "송무 인계 처리 필요", type: "GENERAL" },
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
