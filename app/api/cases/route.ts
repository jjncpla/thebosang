import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const caseType = sp.get("caseType") ?? "";
  const tfName = sp.get("tfName") ?? "";
  const status = sp.get("status") ?? "";
  const search = sp.get("search") ?? "";
  const salesRoute = sp.get("salesRoute") ?? "";
  const isOneStop = sp.get("isOneStop") ?? "";
  const kwcOfficeName = sp.get("kwcOfficeName") ?? "";
  const kwcOfficerName = sp.get("kwcOfficerName") ?? "";
  const salesManagerId = sp.get("salesManagerId") ?? "";
  const caseManagerId = sp.get("caseManagerId") ?? "";
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

  const contractDateFilter: Record<string, Date> = {};
  if (contractDateFrom) contractDateFilter.gte = new Date(contractDateFrom);
  if (contractDateTo) contractDateFilter.lte = new Date(contractDateTo);
  const receptionDateFilter: Record<string, Date> = {};
  if (receptionDateFrom) receptionDateFilter.gte = new Date(receptionDateFrom);
  if (receptionDateTo) receptionDateFilter.lte = new Date(receptionDateTo);

  // 페이지네이션: ?limit=N&paginate=true&cursor=ID (cursor 기반, createdAt desc 정렬)
  // - paginate=true: 응답 형식 = { items, nextCursor, total? }
  // - paginate 없으면: limit이 있어도 단순 배열 반환 (기존 호출자 호환)
  const limitRaw = Number(sp.get("limit") ?? "0");
  const limit = limitRaw > 0 && limitRaw <= 1000 ? limitRaw : 0;
  const paginateMode = sp.get("paginate") === "true";
  const cursor = sp.get("cursor") ?? "";
  const includeCount = sp.get("count") === "true";

  const where = {
    ...(caseType && { caseType }),
    ...(tfName && { tfName }),
    ...(status && { status }),
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
    ...(kwcOfficeName && { kwcOfficeName: { contains: kwcOfficeName } }),
    ...(kwcOfficerName && { kwcOfficerName: { contains: kwcOfficerName } }),
    ...(salesManagerId && { salesManagerId }),
    ...(caseManagerId && { caseManagerId }),
  };

  try {
    const t0 = Date.now();
    const cases = await prisma.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(limit > 0 && { take: limit }),
      ...(limit > 0 && cursor && { skip: 1, cursor: { id: cursor } }),
      // 목록 표시에 필요한 최소 필드만 select (hearingLoss 100+ 필드 → 6개 필드)
      select: {
        id: true,
        patientId: true,
        caseType: true,
        status: true,
        tfName: true,
        branch: true,
        salesRoute: true,
        contractDate: true,
        receptionDate: true,
        isOneStop: true,
        kwcOfficeName: true,
        kwcOfficerName: true,
        createdAt: true,
        patient: { select: { id: true, name: true, ssn: true, phone: true } },
        salesManager: { select: { id: true, name: true } },
        caseManager: { select: { id: true, name: true } },
        // Detail 모델은 목록 표시에 필요한 필드만 select
        hearingLoss: {
          select: {
            firstClinic: true,
            specialClinic: true,
            decisionType: true,
            disabilityGrade: true,
          },
        },
        copd: { select: { caseId: true } },
        pneumoconiosis: { select: { caseId: true } },
        musculoskeletal: { select: { caseId: true } },
        occupationalAccident: { select: { caseId: true } },
        occupationalCancer: { select: { caseId: true } },
        bereaved: { select: { caseId: true } },
      },
    });
    const queryMs = Date.now() - t0;

    const items = cases.map((c) => ({
      ...c,
      salesManager: c.salesManager?.name ?? null,
      caseManager: c.caseManager?.name ?? null,
    }));

    if (paginateMode) {
      // 페이지네이션 모드: { items, nextCursor, total? } 형태
      const nextCursor = limit > 0 && cases.length === limit ? cases[cases.length - 1].id : null;
      const total = includeCount ? await prisma.case.count({ where }) : undefined;
      const headers = new Headers({ "Server-Timing": `db;dur=${queryMs}` });
      return NextResponse.json({ items, nextCursor, ...(total !== undefined && { total }) }, { headers });
    }

    // 하위호환: paginate 미지정 시 단순 배열 반환 (기존 호출자 보호)
    return NextResponse.json(items, { headers: { "Server-Timing": `db;dur=${queryMs}` } });
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
      tfName,
      branch,
      subAgent,
      salesRoute,
      contractDate,
      receptionDate,
      isOneStop,
      memo,
      salesManagerId,
      caseManagerId,
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId 필수" }, { status: 400 });
    }

    const newCase = await prisma.case.create({
      data: {
        patientId,
        caseType: caseType ?? "HEARING_LOSS",
        tfName: tfName ?? null,
        branch: branch ?? null,
        subAgent: subAgent ?? null,
        salesRoute: salesRoute ?? null,
        contractDate: contractDate ? new Date(contractDate) : null,
        receptionDate: receptionDate ? new Date(receptionDate) : null,
        isOneStop: isOneStop ?? false,
        memo: memo ?? null,
        salesManagerId: salesManagerId || null,
        caseManagerId: caseManagerId || null,
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
