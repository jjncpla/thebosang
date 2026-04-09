import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const myOnly = searchParams.get("myOnly") === "true";
  const search = searchParams.get("search") ?? "";
  const caseType = searchParams.get("caseType") ?? "";
  const status = searchParams.get("status") ?? "";

  const userId = (session.user as { id?: string }).id ?? "";
  const role = (session.user as { role?: string }).role ?? "";

  // STAFF 권한: 본인 영업담당 사건만 강제 필터
  const isForcedMyOnly = role === "STAFF";
  const salesFilter = (myOnly || isForcedMyOnly) ? { salesManagerId: userId } : {};

  try {
    const cases = await prisma.case.findMany({
      where: {
        ...salesFilter,
        ...(search ? { patient: { name: { contains: search } } } : {}),
        ...(caseType ? { caseType } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        patient: {
          select: {
            name: true,
            ssn: true,
            phone: true,
            address: true,
          },
        },
        salesManager: { select: { name: true } },
        caseManager: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // 이산계정: 주민번호 마스킹
    const result = cases.map((c) => ({
      id: c.id,
      patientId: c.patientId,
      caseType: c.caseType,
      status: c.status,
      patientName: c.patient?.name ?? "",
      ssn:
        role === "이산계정"
          ? (c.patient?.ssn ?? "").replace(/(\d{6})-?(\d{7})/, "$1-*******")
          : (c.patient?.ssn ?? ""),
      phone: c.patient?.phone ?? "",
      address: c.patient?.address ?? "",
      salesManager: c.salesManager?.name ?? "",
      caseManager: c.caseManager?.name ?? "",
      createdAt: c.createdAt,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/cases-view]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}
