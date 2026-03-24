import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import specialHospitalsData from "@/data/special_hospitals.json";
import {
  parseBirthDate,
  parseDateFields,
  parseJumin,
  loadKoreanFont,
  loadBlankForm,
  drawText,
} from "@/lib/pdf/formUtils";

export const runtime = "nodejs";

type SpecialHospital = { hospital: string; region: string };
const SPECIAL_HOSPITALS = specialHospitalsData as SpecialHospital[];

function getHospitalRegion(name: string | null): string {
  if (!name) return "";
  return SPECIAL_HOSPITALS.find((h) => h.hospital === name)?.region ?? "";
}

type WorkHistoryItem = {
  company: string;
  department: string;
  jobType: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  noiseExposure: boolean;
  noiseLevel: number | null;
  workHours: string;
  source: string;
};

function calcMonths(j: WorkHistoryItem): number {
  return Math.max(0, (j.endYear - j.startYear) * 12 + (j.endMonth - j.startMonth));
}

function fmtPeriod(j: WorkHistoryItem): string {
  return `${j.startYear}.${String(j.startMonth).padStart(2, "0")}~${j.endYear}.${String(j.endMonth).padStart(2, "0")}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caseId } = await params;
  const type = req.nextUrl.searchParams.get("type") ?? "";

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      caseManager: true,
      hearingLoss: { include: { exams: true } },
    },
  });

  if (!caseData) return NextResponse.json({ error: "사건 없음" }, { status: 404 });

  const patient = caseData.patient;
  const manager = caseData.caseManager;
  const detail = caseData.hearingLoss as (typeof caseData.hearingLoss & {
    bankName?: string | null;
    bankAccount?: string | null;
    bankAccountHolder?: string | null;
    bankAccountType?: string | null;
    confirmPriorDisability?: boolean | null;
    confirmPriorCompensation?: boolean | null;
    receiptDate?: string | null;
    receiptAmount?: string | null;
    receiptPayer?: string | null;
    transferCost?: string | null;
    transferCostDetail?: string | null;
    complicationPart?: string | null;
    complicationHospital?: string | null;
  }) | null;
  const workHistory = (caseData.workHistory as WorkHistoryItem[] | null) ?? [];
  const today = parseDateFields(new Date());

  let pdfBytes: Uint8Array;

  try {
    switch (type) {
      case "DISABILITY_CLAIM": {
        const pdfDoc = await loadBlankForm("disability_claim.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const T = (text: string, x: number, y: number, size = 9) => drawText(page, text, x, y, font, size);

        const bf = parseBirthDate(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);

        T(patient.name, 157, 670);
        T(bf.Y1, 286, 671); T(bf.Y2, 303, 671); T(bf.Y3, 320, 671); T(bf.Y4, 337, 671);
        T(bf.M1, 368, 671); T(bf.M2, 385, 671);
        T(bf.D1, 415, 671); T(bf.D2, 433, 671);
        T(df.y1, 103, 639); T(df.y2, 120, 639); T(df.y3, 137, 639); T(df.y4, 153, 639);
        T(df.m1, 185, 639); T(df.m2, 202, 639);
        T(df.d1, 233, 639); T(df.d2, 250, 639);
        T(today.연도, 392, 340); T(today.월자, 440, 340); T(today.일자, 473, 340);
        T(patient.name, 325, 328);
        T(patient.phone ?? '', 465, 327);
        T(`공인노무사 ${manager?.name ?? ''}`, 325, 313);
        T(manager?.officeTel ?? '', 483, 313);
        T(caseData.kwcOfficeName ?? '', 299, 93);

        // 수령계좌 변경여부
        T(detail?.bankAccount ? '√' : '', 287, 619);
        T(!detail?.bankAccount ? '√' : '', 362, 619);
        T(detail?.bankName ?? '', 189, 600);
        T(detail?.bankAccount ?? '', 169, 581);
        T(detail?.bankAccountHolder ?? '', 470, 581);
        T(detail?.bankAccountType !== '전용계좌' ? '√' : '', 120, 561);
        T(detail?.bankAccountType === '전용계좌' ? '√' : '', 222, 562);

        // 확인사항 ①
        T(detail?.confirmPriorDisability === true ? '√' : '', 434, 539);
        T(detail?.confirmPriorDisability !== true ? '√' : '', 483, 539);

        // 확인사항 ②
        T(detail?.confirmPriorCompensation === true ? '√' : '', 428, 509);
        T(detail?.confirmPriorCompensation !== true ? '√' : '', 469, 509);

        // 수령내역
        T(detail?.receiptDate ?? '', 127, 464, 8);
        T(detail?.receiptAmount ?? '', 209, 465, 8);
        T(detail?.receiptPayer ?? '', 297, 466, 8);

        // 이송비
        T(detail?.transferCost ?? '', 183, 440);
        T(detail?.transferCostDetail ?? '', 317, 440, 8);

        // 합병증
        T(detail?.complicationPart ?? '', 207, 396, 8);
        T(detail?.complicationHospital ?? '', 453, 396, 8);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "NOISE_WORK_CONFIRM": {
        const pdfDoc = await loadBlankForm("noise_work_confirm.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const jf = parseJumin(patient.ssn ?? "");
        const noiseJobs = workHistory.filter((w) => w.noiseExposure);

        drawText(page, patient.name ?? "",    270, 693, font, 9);
        drawText(page, jf["1"]  ?? "",        278, 670, font, 9);
        drawText(page, jf["2"]  ?? "",        295, 670, font, 9);
        drawText(page, jf["3"]  ?? "",        312, 670, font, 9);
        drawText(page, jf["4"]  ?? "",        329, 670, font, 9);
        drawText(page, jf["5"]  ?? "",        346, 670, font, 9);
        drawText(page, jf["6"]  ?? "",        363, 670, font, 9);
        drawText(page, jf["7"]  ?? "",        389, 670, font, 9);
        drawText(page, jf["8"]  ?? "",        406, 670, font, 9);
        drawText(page, jf["9"]  ?? "",        422, 670, font, 9);
        drawText(page, jf["10"] ?? "",        440, 670, font, 9);
        drawText(page, jf["11"] ?? "",        456, 670, font, 9);
        drawText(page, jf["12"] ?? "",        474, 670, font, 9);
        drawText(page, jf["13"] ?? "",        491, 670, font, 9);
        drawText(page, patient.address ?? "", 164, 645, font, 8);
        // 재직/퇴직 체크 (기본: 퇴직)
        drawText(page, "",  316, 620, font, 9);  // 재직
        drawText(page, "√", 401, 620, font, 9);  // 퇴직
        drawText(page, today.연도, 204, 143, font, 9);
        drawText(page, today.월자, 275, 143, font, 9);
        drawText(page, today.일자, 331, 143, font, 9);
        drawText(page, patient.name ?? "",      268, 118, font, 9);
        drawText(page, patient.phone ?? "",     431, 118, font, 9);
        drawText(page, manager?.name ?? "",     268, 106, font, 9);
        drawText(page, manager?.officeTel ?? "",431, 106, font, 9);
        // 별지사용 (소음직력 5개 초과 시 자동)
        drawText(page, noiseJobs.length > 5 ? "√" : "", 367, 374, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "AGENT_APPOINTMENT": {
        const pdfDoc = await loadBlankForm("agent_appointment.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const bf = parseBirthDate(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ?? null);

        drawText(page, "장해급여 청구(소음성 난청)",                    184, 664, font, 9);
        drawText(page, patient.name ?? "",                              193, 629, font, 9);
        drawText(page, `${bf.Y1}${bf.Y2}${bf.Y3}${bf.Y4}.${bf.M1}${bf.M2}.${bf.D1}${bf.D2}`, 452, 629, font, 9);
        drawText(page, patient.address ?? "",                           186, 599, font, 8);
        drawText(page, patient.phone ?? "",                             372, 574, font, 9);
        drawText(page, `노무법인 더보상 ${manager?.branchName ?? ""}`,  222, 505, font, 9);
        drawText(page, manager?.licenseNo ?? "",                        470, 505, font, 9);
        drawText(page, `공인노무사 ${manager?.name ?? ""}`,             250, 460, font, 9);
        drawText(page, manager?.jobTitle ?? "",                         477, 460, font, 9);
        drawText(page, manager?.officeAddress ?? "",                    186, 425, font, 8);
        drawText(page, manager?.officeTel ?? "",                        227, 400, font, 9);
        drawText(page, manager?.officeTel ?? "",                        342, 400, font, 9);
        drawText(page, manager?.officeFax ?? "",                        450, 391, font, 9);
        drawText(page, "소음성 난청 장해급여 청구에 관한 사항 일체",    271, 356, font, 9);
        drawText(page, `${df.연도}.${df.월자}.${df.일자}`,             199, 315, font, 9);
        drawText(page, today.연도, 340, 203, font, 9);
        drawText(page, today.월자, 412, 203, font, 9);
        drawText(page, today.일자, 461, 203, font, 9);
        drawText(page, patient.name ?? "", 367, 173, font, 9);
        drawText(page, caseData.kwcOfficeName ?? "", 346, 140, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "POWER_OF_ATTORNEY": {
        const pdfDoc = await loadBlankForm("power_of_attorney.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];

        drawText(page, `노무법인 더보상 ${manager?.branchName ?? ""}`, 240, 657, font, 9);
        drawText(page, manager?.officeAddress ?? "", 240, 638, font, 8);
        drawText(page, manager?.officeTel ?? "",     240, 620, font, 9);
        drawText(page, manager?.officeFax ?? "",     240, 602, font, 9);
        drawText(page, `제 ${manager?.licenseNo ?? ""}호`, 295, 585, font, 9);
        drawText(page, `공인노무사 ${manager?.name ?? ""}`, 233, 567, font, 9);
        drawText(page, today.연도, 345, 280, font, 10);
        drawText(page, today.월자, 409, 280, font, 10);
        drawText(page, today.일자, 468, 280, font, 10);
        drawText(page, patient.name ?? "",  285, 234, font, 10);
        drawText(page, patient.ssn ?? "",   285, 206, font, 9);
        drawText(page, patient.address ?? "", 285, 176, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "SPECIAL_CLINIC": {
        const pdfDoc = await loadBlankForm("special_clinic.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const jf = parseJumin(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ?? null);

        drawText(page, patient.name ?? "", 93, 676, font, 9);
        // 주민번호 1~7 (좌표 확정)
        drawText(page, jf["1"] ?? "", 173, 676, font, 9);
        drawText(page, jf["2"] ?? "", 190, 676, font, 9);
        drawText(page, jf["3"] ?? "", 206, 676, font, 9);
        drawText(page, jf["4"] ?? "", 223, 676, font, 9);
        drawText(page, jf["5"] ?? "", 240, 676, font, 9);
        drawText(page, jf["6"] ?? "", 257, 676, font, 9);
        drawText(page, jf["7"] ?? "", 276, 676, font, 9);
        // 주민번호 8~13 (좌표 미정 — 추후 반영)

        // 재해일
        drawText(page, df.y1, 399, 676, font, 9);
        drawText(page, df.y2, 416, 676, font, 9);
        drawText(page, df.y3, 432, 676, font, 9);
        drawText(page, df.y4, 450, 676, font, 9);
        drawText(page, df.m1, 474, 676, font, 9);
        drawText(page, df.m2, 491, 676, font, 9);
        drawText(page, df.d1, 515, 676, font, 9);
        drawText(page, df.d2, 533, 676, font, 9);

        drawText(page, patient.address ?? "", 148, 642, font, 8);
        drawText(page, patient.phone ?? "",   465, 640, font, 9);

        // 특진 사유 (고정 텍스트)
        drawText(page, "소음성 난청(특별진찰)", 148, 572, font, 9);
        drawText(page, `- 대리인 Tel: ${manager?.officeTel ?? ""}  Fax: ${manager?.officeFax ?? ""}`, 148, 560, font, 8);

        // 특진의료기관 1행
        drawText(page, detail?.specialClinic ?? "", 171, 524, font, 9);
        drawText(page, "√", 530, 524, font, 9);  // 1행 체크

        drawText(page, today.연도, 338, 195, font, 9);
        drawText(page, today.월자, 385, 195, font, 9);
        drawText(page, today.일자, 418, 195, font, 9);
        drawText(page, patient.name ?? "",       174, 182, font, 9);
        drawText(page, patient.phone ?? "",      503, 182, font, 9);
        drawText(page, manager?.name ?? "",      174, 165, font, 9);
        drawText(page, manager?.officeTel ?? "", 503, 164, font, 9);
        drawText(page, caseData.kwcOfficeName ?? "", 133, 69, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "EXPERT_CLINIC": {
        const pdfDoc = await loadBlankForm("expert_clinic.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const jf = parseJumin(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ?? null);

        drawText(page, patient.name ?? "", 93, 676, font, 9);
        // 주민번호 1~7 (좌표 확정)
        drawText(page, jf["1"] ?? "", 173, 676, font, 9);
        drawText(page, jf["2"] ?? "", 190, 676, font, 9);
        drawText(page, jf["3"] ?? "", 206, 676, font, 9);
        drawText(page, jf["4"] ?? "", 223, 676, font, 9);
        drawText(page, jf["5"] ?? "", 240, 676, font, 9);
        drawText(page, jf["6"] ?? "", 257, 676, font, 9);
        drawText(page, jf["7"] ?? "", 276, 676, font, 9);
        // 주민번호 8~13 (좌표 미정 — 추후 반영)

        // 재해일
        drawText(page, df.y1, 399, 676, font, 9);
        drawText(page, df.y2, 416, 676, font, 9);
        drawText(page, df.y3, 432, 676, font, 9);
        drawText(page, df.y4, 450, 676, font, 9);
        drawText(page, df.m1, 474, 676, font, 9);
        drawText(page, df.m2, 491, 676, font, 9);
        drawText(page, df.d1, 515, 676, font, 9);
        drawText(page, df.d2, 533, 676, font, 9);

        drawText(page, patient.address ?? "", 148, 642, font, 8);
        drawText(page, patient.phone ?? "",   465, 640, font, 9);

        // 특진 사유
        drawText(page, "소음성 난청(업무관련성 평가)", 148, 572, font, 9);
        drawText(page, `- 대리인 H.P: ${manager?.officeTel ?? ""}  Tel: ${manager?.officeTel ?? ""}  Fax: ${manager?.officeFax ?? ""}`, 148, 560, font, 8);

        // 전문조사기관
        drawText(page, detail?.expertClinic ?? "", 171, 524, font, 9);
        drawText(page, "√", 530, 524, font, 9);  // 1행 체크

        drawText(page, today.연도, 338, 195, font, 9);
        drawText(page, today.월자, 385, 195, font, 9);
        drawText(page, today.일자, 418, 195, font, 9);
        drawText(page, patient.name ?? "",       174, 182, font, 9);
        drawText(page, patient.phone ?? "",      503, 182, font, 9);
        drawText(page, manager?.name ?? "",      174, 165, font, 9);
        drawText(page, manager?.officeTel ?? "", 503, 164, font, 9);
        drawText(page, caseData.kwcOfficeName ?? "", 133, 69, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "WORK_HISTORY": {
        const pdfDoc = await loadBlankForm("work_history.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const allJobs = workHistory;

        // 1페이지
        const page1 = pdfDoc.getPages()[0];
        drawText(page1, patient.name ?? "",    172, 638, font, 9);
        drawText(page1, patient.phone ?? "",   174, 609, font, 9);
        drawText(page1, patient.address ?? "", 174, 582, font, 8);

        // 2페이지 — 사업장 근무력 조사표
        const page2 = pdfDoc.getPages()[1];

        // 총 근무기간 계산
        const totalMonths = allJobs.reduce((acc: number, j) => {
          return acc + (j.endYear - j.startYear) * 12 + ((j.endMonth ?? 0) - (j.startMonth ?? 0));
        }, 0);
        const totalYears = Math.floor(totalMonths / 12);
        const totalRem = totalMonths % 12;
        drawText(page2, `총 약 ${totalYears}년 ${totalRem}개월`, 109, 687, font, 8);

        // 3페이지
        const page3 = pdfDoc.getPages()[2];
        drawText(page3, today.연도, 219, 309, font, 9);
        drawText(page3, today.월자, 282, 308, font, 9);
        drawText(page3, today.일자, 329, 308, font, 9);
        drawText(page3, patient.name ?? "",       283, 267, font, 9);
        drawText(page3, patient.phone ?? "",      485, 267, font, 9);
        drawText(page3, `공인노무사 ${manager?.name ?? ""}`, 283, 222, font, 9);
        drawText(page3, manager?.officeTel ?? "", 485, 222, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      default:
        return NextResponse.json({ error: `지원하지 않는 서식: ${type}` }, { status: 400 });
    }
  } catch (err) {
    console.error("PDF 생성 오류:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const fileName = encodeURIComponent(`${type}-${patient.name}-${today.연도}${today.월자}${today.일자}.pdf`);
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
