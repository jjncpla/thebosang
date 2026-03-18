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
        }
      });
    }
  }

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.objectionReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
