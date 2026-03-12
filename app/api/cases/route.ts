import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "";
  const caseType = searchParams.get("caseType") ?? "";
  const branch = searchParams.get("branch") ?? "";
  const search = searchParams.get("search") ?? "";

  try {
    const cases = await prisma.case.findMany({
      where: {
        ...(status && { status }),
        ...(caseType && { caseType }),
        ...(branch && { branch }),
        ...(search && {
          patient: {
            OR: [
              { name: { contains: search } },
              { ssn: { contains: search } },
            ],
          },
        }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, name: true, ssn: true, phone: true } },
      },
    });
    return NextResponse.json(cases);
  } catch (err) {
    console.error("[GET /api/cases]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId,
      caseType,
      caseNumber,
      tfName,
      branch,
      subAgent,
      branchManager,
      salesManager,
      caseManager,
      salesRoute,
      contractDate,
      receptionDate,
      isOneStop,
      status,
      memo,
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId 필수" }, { status: 400 });
    }

    const newCase = await prisma.case.create({
      data: {
        patientId,
        caseType: caseType ?? "HEARING_LOSS",
        caseNumber: caseNumber ?? null,
        tfName: tfName ?? null,
        branch: branch ?? null,
        subAgent: subAgent ?? null,
        branchManager: branchManager ?? null,
        salesManager: salesManager ?? null,
        caseManager: caseManager ?? null,
        salesRoute: salesRoute ?? null,
        contractDate: contractDate ? new Date(contractDate) : null,
        receptionDate: receptionDate ? new Date(receptionDate) : null,
        isOneStop: isOneStop ?? false,
        status: status ?? "접수대기",
        memo: memo ?? null,
      },
      include: {
        patient: { select: { id: true, name: true, ssn: true, phone: true } },
      },
    });

    return NextResponse.json(newCase, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cases]", err);
    return NextResponse.json({ error: "생성 오류" }, { status: 500 });
  }
}
