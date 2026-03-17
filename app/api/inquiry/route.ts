import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
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
