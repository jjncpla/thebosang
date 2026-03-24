import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadBlankForm } from "@/lib/pdf/formUtils";

export const runtime = "nodejs";

type FormType =
  | "DISABILITY_CLAIM"
  | "NOISE_WORK_CONFIRM"
  | "AGENT_APPOINTMENT"
  | "POWER_OF_ATTORNEY"
  | "SPECIAL_CLINIC"
  | "EXPERT_CLINIC"
  | "WORK_HISTORY"
  | "INFO_DISCLOSURE"
  | "LABOR_ATTORNEY_RECORD";

const FILE_MAP: Record<FormType, string> = {
  DISABILITY_CLAIM:       "disability_claim.pdf",
  NOISE_WORK_CONFIRM:     "noise_work_confirm.pdf",
  AGENT_APPOINTMENT:      "agent_appointment.pdf",
  POWER_OF_ATTORNEY:      "power_of_attorney.pdf",
  SPECIAL_CLINIC:         "special_clinic.pdf",
  EXPERT_CLINIC:          "expert_clinic.pdf",
  WORK_HISTORY:           "work_history.pdf",
  INFO_DISCLOSURE:        "info_disclosure.pdf",
  LABOR_ATTORNEY_RECORD:  "labor_attorney_record.pdf",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") as FormType | null;
  if (!type || !FILE_MAP[type]) {
    return NextResponse.json({ error: `지원하지 않는 서식: ${type}` }, { status: 400 });
  }

  try {
    const pdfDoc = await loadBlankForm(FILE_MAP[type]);
    const pdfBytes = await pdfDoc.save();

    const fileName = encodeURIComponent(`[공란]${type}.pdf`);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (err) {
    console.error("공란 PDF 로드 오류:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
