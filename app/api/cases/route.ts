import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const caseType = sp.get("caseType") ?? "";
  const tfName = sp.get("tfName") ?? "";
  const search = sp.get("search") ?? "";
  const salesManager = sp.get("salesManager") ?? "";
  const caseManager = sp.get("caseManager") ?? "";
  const salesRoute = sp.get("salesRoute") ?? "";
  const isOneStop = sp.get("isOneStop") ?? "";
  const contractDateFrom = sp.get("contractDate_from") ?? "";
  const contractDateTo = sp.get("contractDate_to") ?? "";
  const receptionDateFrom = sp.get("receptionDate_from") ?? "";
  const receptionDateTo = sp.get("receptionDate_to") ?? "";

  // Build hearingLoss where from hl_ prefixed params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlWhere: Record<string, any> = {};
  let hasHlFilter = false;

  for (const [key, value] of sp.entries()) {
    if (!key.startsWith("hl_") || !value) continue;
    const rest = key.slice(3);

    if (rest.endsWith("_from")) {
      const field = rest.slice(0, -5);
      hlWhere[field] = { ...((hlWhere[field] as object) ?? {}), gte: new Date(value) };
      hasHlFilter = true;
    } else if (rest.endsWith("_to")) {
      const field = rest.slice(0, -3);
      hlWhere[field] = { ...((hlWhere[field] as object) ?? {}), lte: new Date(value) };
      hasHlFilter = true;
    } else if (rest.endsWith("_min")) {
      const field = rest.slice(0, -4);
      hlWhere[field] = { ...((hlWhere[field] as object) ?? {}), gte: Number(value) };
      hasHlFilter = true;
    } else if (rest.endsWith("_max")) {
      const field = rest.slice(0, -4);
      hlWhere[field] = { ...((hlWhere[field] as object) ?? {}), lte: Number(value) };
      hasHlFilter = true;
    } else if (value.includes(",")) {
      hlWhere[rest] = { in: value.split(",").filter(Boolean) };
      hasHlFilter = true;
    } else if (value === "true" || value === "false") {
      hlWhere[rest] = value === "true";
      hasHlFilter = true;
    } else {
      hlWhere[rest] = { contains: value };
      hasHlFilter = true;
    }
  }

  // Build contractDate / receptionDate range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractDateFilter: Record<string, Date> = {};
  if (contractDateFrom) contractDateFilter.gte = new Date(contractDateFrom);
  if (contractDateTo) contractDateFilter.lte = new Date(contractDateTo);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receptionDateFilter: Record<string, Date> = {};
  if (receptionDateFrom) receptionDateFilter.gte = new Date(receptionDateFrom);
  if (receptionDateTo) receptionDateFilter.lte = new Date(receptionDateTo);

  try {
    const cases = await prisma.case.findMany({
      where: {
        ...(caseType && { caseType }),
        ...(tfName && { tfName }),
        ...(salesManager && { salesManager: { contains: salesManager } }),
        ...(caseManager && { caseManager: { contains: caseManager } }),
        ...(salesRoute && { salesRoute: { contains: salesRoute } }),
        ...(isOneStop && { isOneStop: isOneStop === "true" }),
        ...(Object.keys(contractDateFilter).length > 0 && { contractDate: contractDateFilter }),
        ...(Object.keys(receptionDateFilter).length > 0 && { receptionDate: receptionDateFilter }),
        ...(search && {
          patient: {
            OR: [
              { name: { contains: search } },
              { ssn: { contains: search } },
              { phone: { endsWith: search } },
            ],
          },
        }),
        ...(hasHlFilter && { hearingLoss: hlWhere }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, name: true, ssn: true, phone: true } },
        hearingLoss: true,
        copd: { select: { id: true, status: true, reExamPossibleDate: true } },
        pneumoconiosis: { select: { id: true, status: true, reExamPossibleDate: true } },
        musculoskeletal: { select: { status: true } },
        occupationalAccident: { select: { status: true } },
        occupationalCancer: { select: { status: true } },
        bereaved: { select: { status: true } },
      },
    });
    // COPD 수치미달 → 재진행가능 자동 업데이트
    const today = new Date();
    const copdToUpdate = cases
      .filter(c =>
        c.caseType === "COPD" &&
        c.copd?.status === "수치미달" &&
        c.copd?.reExamPossibleDate != null &&
        c.copd.reExamPossibleDate <= today
      )
      .map(c => c.copd!.id);

    if (copdToUpdate.length > 0) {
      await prisma.copdDetail.updateMany({
        where: { id: { in: copdToUpdate } },
        data: { status: "재진행가능" },
      });
    }

    // 진폐 수치미달 → 재진행가능 자동 업데이트
    const pneumoToUpdate = cases
      .filter(c =>
        c.caseType === "PNEUMOCONIOSIS" &&
        c.pneumoconiosis?.status === "수치미달" &&
        c.pneumoconiosis?.reExamPossibleDate != null &&
        c.pneumoconiosis.reExamPossibleDate <= today
      )
      .map(c => c.pneumoconiosis!.id);

    if (pneumoToUpdate.length > 0) {
      await prisma.pneumoconiosisDetail.updateMany({
        where: { id: { in: pneumoToUpdate } },
        data: { status: "재진행가능" },
      });
    }

    const resultCases = (copdToUpdate.length > 0 || pneumoToUpdate.length > 0)
      ? cases.map(c => {
          if (c.copd && copdToUpdate.includes(c.copd.id))
            return { ...c, copd: { ...c.copd, status: "재진행가능" } };
          if (c.pneumoconiosis && pneumoToUpdate.includes(c.pneumoconiosis.id))
            return { ...c, pneumoconiosis: { ...c.pneumoconiosis, status: "재진행가능" } };
          return c;
        })
      : cases;

    return NextResponse.json(resultCases);
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
