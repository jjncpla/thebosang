import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [officeNames, officerNames] = await Promise.all([
      prisma.case.findMany({
        where: { kwcOfficeName: { not: null } },
        select: { kwcOfficeName: true },
        distinct: ["kwcOfficeName"],
        orderBy: { kwcOfficeName: "asc" },
      }),
      prisma.case.findMany({
        where: { kwcOfficerName: { not: null } },
        select: { kwcOfficerName: true },
        distinct: ["kwcOfficerName"],
        orderBy: { kwcOfficerName: "asc" },
      }),
    ]);

    return NextResponse.json({
      kwcOfficeNames: officeNames.map((r) => r.kwcOfficeName!),
      kwcOfficerNames: officerNames.map((r) => r.kwcOfficerName!),
    });
  } catch (err) {
    console.error("[GET /api/cases/filter-options]", err);
    return NextResponse.json({ kwcOfficeNames: [], kwcOfficerNames: [] });
  }
}
