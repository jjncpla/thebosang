import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const caseType = searchParams.get("caseType");
  const managerId = searchParams.get("managerId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");
  const tfName = searchParams.get("tfName");
  const branchName = searchParams.get("branchName");
  const tfNames = searchParams.getAll("tfNames"); // 지사 단위 필터링 시 다중 TF 매칭
  const routeMain = searchParams.get("routeMain");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (managerId) where.managerId = managerId;
  if (routeMain) where.routeMain = routeMain;
  if (caseType) where.caseTypes = { has: caseType };

  // 지사 / TF 필터:
  //  - 단일 TF 지정: tfName 일치
  //  - 지사만 지정: branchName 일치 OR 그 지사의 TF 목록 중 하나에 매칭 (둘 중 하나라도 있으면 노출)
  if (tfName) {
    where.tfName = tfName;
  } else if (branchName || tfNames.length > 0) {
    const orClauses: Array<Record<string, unknown>> = [];
    if (branchName) orClauses.push({ branchName });
    if (tfNames.length > 0) orClauses.push({ tfName: { in: tfNames } });
    if (orClauses.length === 1) Object.assign(where, orClauses[0]);
    else where.OR = orClauses;
  }

  if (dateFrom || dateTo) {
    where.visitDate = {};
    if (dateFrom) (where.visitDate as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.visitDate as Record<string, unknown>).lte = new Date(dateTo + "T23:59:59");
  }
  if (search) {
    const searchOr = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
    // 지사 필터의 OR과 검색 OR이 충돌하지 않도록 AND 결합
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  // stats: 지사 / TF 필터가 걸리면 같은 범위 안에서 재집계
  const statsScope: Record<string, unknown> = {};
  if (tfName) {
    statsScope.tfName = tfName;
  } else if (branchName || tfNames.length > 0) {
    const orClauses: Array<Record<string, unknown>> = [];
    if (branchName) orClauses.push({ branchName });
    if (tfNames.length > 0) orClauses.push({ tfName: { in: tfNames } });
    if (orClauses.length === 1) Object.assign(statsScope, orClauses[0]);
    else statsScope.OR = orClauses;
  }

  const [total, items] = await Promise.all([
    prisma.consultation.count({ where }),
    prisma.consultation.findMany({
      where,
      include: { manager: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // stats (지사·TF 필터 적용 후 다시 집계)
  const [totalCount, contractCount, waitingCount, closedCount] = await Promise.all([
    prisma.consultation.count({ where: statsScope }),
    prisma.consultation.count({ where: { ...statsScope, status: "약정" } }),
    prisma.consultation.count({ where: { ...statsScope, status: "연락대기" } }),
    prisma.consultation.count({ where: { ...statsScope, status: "종결" } }),
  ]);

  return NextResponse.json({ items, total, page, pageSize, stats: { total: totalCount, contract: contractCount, waiting: waitingCount, closed: closedCount } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, ssn, address, caseTypes, managerId, managerName, routeMain, routeSub, routeDetail, visitDate, status, memo, progressNote, reminderDate, branchName, tfName } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "성명과 연락처는 필수입니다." }, { status: 400 });
  }

  const item = await prisma.consultation.create({
    data: {
      name,
      phone,
      ssn: ssn || null,
      address: address || null,
      caseTypes: caseTypes || [],
      managerId: managerId || null,
      managerName: managerName || null,
      routeMain: routeMain || null,
      routeSub: routeSub || null,
      routeDetail: routeDetail || null,
      visitDate: visitDate ? new Date(visitDate) : null,
      status: status || "진행중",
      memo: memo || null,
      progressNote: progressNote || null,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      branchName: branchName || null,
      tfName: tfName || null,
    },
    include: { manager: { select: { id: true, name: true } } },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "삭제할 항목을 선택해주세요." }, { status: 400 });
  }

  const result = await prisma.consultation.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ success: true, deleted: result.count });
}
