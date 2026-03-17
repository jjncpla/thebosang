import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;

  const type = searchParams.get("type");
  if (type === "myCase") {
    const userId = (session.user as { id?: string }).id;
    const cases = await prisma.case.findMany({
      where: { salesManagerId: userId },
      include: {
        patient: true,
        salesManager: { select: { id: true, name: true } },
        caseManager: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const patientMap = new Map<string, { id: string; name: string; phone: string | null; address: string | null; ssn: string; cases: unknown[] }>();
    for (const c of cases) {
      const pid = c.patient.id;
      if (!patientMap.has(pid)) {
        patientMap.set(pid, { id: c.patient.id, name: c.patient.name, phone: c.patient.phone, address: c.patient.address, ssn: c.patient.ssn, cases: [] });
      }
      patientMap.get(pid)!.cases.push({ id: c.id, caseType: c.caseType, status: c.status, tfName: c.tfName, branch: c.branch, salesManager: c.salesManager, caseManager: c.caseManager });
    }
    return NextResponse.json(Array.from(patientMap.values()));
  }

  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) return NextResponse.json([]);

  // ssn 앞 6자리 검색인지 판단 (6자리 숫자)
  const isSsnPrefix = /^\d{6}$/.test(q);
  const isPhone = /^\d{3,}$/.test(q) && !isSsnPrefix;

  const where = isSsnPrefix
    ? { ssn: { startsWith: q } }
    : isPhone
    ? { phone: { contains: q } }
    : { name: { contains: q, mode: "insensitive" as const } };

  const patients = await prisma.patient.findMany({
    where,
    include: {
      cases: {
        include: {
          salesManager: { select: { id: true, name: true } },
          caseManager: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    take: 30,
  });

  return NextResponse.json(patients);
}
