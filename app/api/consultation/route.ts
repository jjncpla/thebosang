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
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (managerId) where.managerId = managerId;
  if (caseType) where.caseTypes = { has: caseType };
  if (dateFrom || dateTo) {
    where.visitDate = {};
    if (dateFrom) (where.visitDate as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) (where.visitDate as Record<string, unknown>).lte = new Date(dateTo + "T23:59:59");
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
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

  // stats
  const [totalCount, contractCount, waitingCount, closedCount] = await Promise.all([
    prisma.consultation.count(),
    prisma.consultation.count({ where: { status: "약정" } }),
    prisma.consultation.count({ where: { status: "연락대기" } }),
    prisma.consultation.count({ where: { status: "종결" } }),
  ]);

  return NextResponse.json({ items, total, page, pageSize, stats: { total: totalCount, contract: contractCount, waiting: waitingCount, closed: closedCount } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, phone, ssn, address, caseTypes, managerId, routeMain, routeSub, routeDetail, visitDate, status, memo, progressNote, reminderDate, branchName, tfName } = body;

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
