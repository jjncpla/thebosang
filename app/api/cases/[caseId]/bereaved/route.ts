import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Case의 BereavedDetail 조회 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { caseId } = await params;
  const detail = await prisma.bereavedDetail.findUnique({ where: { caseId } });
  return NextResponse.json({ detail });
}

/** BereavedDetail upsert (Case는 이미 존재해야 함) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { caseId } = await params;
  const body = await req.json();

  // 허용 필드만
  const fields = [
    "originCaseType", "diseaseName", "firstDiagnosisDate", "lastWorkplace",
    "disposalType", "disposalDate", "treatmentPeriod", "holidayBenefitPeriod",
    "paymentStatus", "memo",
  ] as const;
  const data: Record<string, unknown> = {};
  for (const k of fields) {
    if (k in body) {
      const v = body[k];
      if ((k === "firstDiagnosisDate" || k === "disposalDate") && v) {
        const d = new Date(v as string);
        data[k] = isNaN(d.getTime()) ? null : d;
      } else {
        data[k] = v === "" ? null : v;
      }
    }
  }

  const caseExists = await prisma.case.findUnique({ where: { id: caseId } });
  if (!caseExists) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const detail = await prisma.bereavedDetail.upsert({
    where: { caseId },
    create: { caseId, ...data },
    update: data,
  });
  return NextResponse.json({ detail });
}
