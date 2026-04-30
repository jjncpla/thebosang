import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Case의 OccupationalCancerDetail 조회 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { caseId } = await params;
  try {
    const detail = await prisma.occupationalCancerDetail.findUnique({ where: { caseId } });
    return NextResponse.json({ detail });
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/occupational-cancer]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

/** OccupationalCancerDetail upsert (Case는 이미 존재해야 함) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { caseId } = await params;
  try {
    const body = await req.json();

    const dateFields = new Set(["firstDiagnosisDate", "disposalDate"]);

    const fields = [
      "diseaseName",
      "firstDiagnosisDate",
      "lastWorkplace",
      "disposalType",
      "disposalDate",
      "treatmentPeriod",
      "holidayBenefitPeriod",
      "paymentStatus",
      "memo",
      // 신규 필드 (P5)
      "cancerType",
      "occupation",
      "exposureSubstance",
      "exposurePeriod",
      "concurrentDiseases",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const k of fields) {
      if (k in body) {
        const v = body[k];
        if (dateFields.has(k)) {
          if (!v) {
            data[k] = null;
          } else {
            const d = new Date(v as string);
            data[k] = isNaN(d.getTime()) ? null : d;
          }
        } else if (k === "concurrentDiseases") {
          data[k] = v ?? null;
        } else {
          data[k] = v === "" ? null : v;
        }
      }
    }

    const caseExists = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseExists) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const detail = await prisma.occupationalCancerDetail.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
    });
    return NextResponse.json({ detail });
  } catch (err) {
    console.error("[PATCH /api/cases/[caseId]/occupational-cancer]", err);
    const msg = err instanceof Error ? err.message : "저장 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
