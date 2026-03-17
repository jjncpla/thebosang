import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tfName = searchParams.get("tfName");
  const reviewResult = searchParams.get("reviewResult");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (tfName) where.tfName = tfName;
  if (reviewResult) where.reviewResult = reviewResult;
  if (search) where.patientName = { contains: search, mode: "insensitive" };

  const items = await prisma.wageReviewData.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const item = await prisma.wageReviewData.create({
    data: {
      tfName: body.tfName || "",
      patientName: body.patientName || "",
      caseType: body.caseType || "",
      decisionDate: body.decisionDate ? new Date(body.decisionDate) : null,
      hasInfoDisclosure: !!body.hasInfoDisclosure,
      retirementDate: body.retirementDate ? new Date(body.retirementDate) : null,
      diagnosisDate: body.diagnosisDate ? new Date(body.diagnosisDate) : null,
      hasNationalDisability: !!body.hasNationalDisability,
      disabilityGrade: body.disabilityGrade || null,
      workerType: body.workerType || null,
      comparisonWage: body.comparisonWage || null,
      appliedWage: body.appliedWage || null,
      workplaceName: body.workplaceName || null,
      occupation1: body.occupation1 || null,
      occupation1Years: body.occupation1Years || null,
      occupation2: body.occupation2 || null,
      occupation2Years: body.occupation2Years || null,
      occupation3: body.occupation3 || null,
      occupation3Years: body.occupation3Years || null,
      baseAvgWage: body.baseAvgWage ? parseFloat(body.baseAvgWage) : null,
      basisNote: body.basisNote || null,
      hasCommuteCoef: body.hasCommuteCoef ?? null,
      changeRate: body.changeRate ? parseFloat(body.changeRate) : null,
      finalAvgWage: body.finalAvgWage ? parseFloat(body.finalAvgWage) : null,
      statWageGender: body.statWageGender || null,
      statWageSize: body.statWageSize || null,
      statWageIndustry: body.statWageIndustry || null,
      statWageOccupation: body.statWageOccupation || null,
      statWageQuarter: body.statWageQuarter || null,
      statWageBase: body.statWageBase ? parseFloat(body.statWageBase) : null,
      statWageChangeRate: body.statWageChangeRate ? parseFloat(body.statWageChangeRate) : null,
      statWageFinal: body.statWageFinal ? parseFloat(body.statWageFinal) : null,
      finalSelectedWage: body.finalSelectedWage ? parseFloat(body.finalSelectedWage) : null,
      reviewManagerName: body.reviewManagerName || null,
      reviewResult: body.reviewResult || null,
      reviewDetail: body.reviewDetail || null,
      progressNote: body.progressNote || null,
      claimDate: body.claimDate ? new Date(body.claimDate) : null,
      decisionResultDate: body.decisionResultDate ? new Date(body.decisionResultDate) : null,
      additionalReview: body.additionalReview || null,
      caseId: body.caseId || null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
