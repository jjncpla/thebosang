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
import { generateLaborAttorneyRecord } from "@/lib/pdf/labor-attorney-record";

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
      copd: true,
    },
  });

  if (!caseData) return NextResponse.json({ error: "사건 없음" }, { status: 404 });

  const patient = caseData.patient;
  const manager = caseData.caseManager;
  // COPD 케이스에서도 동일 양식 사용 시 CopdDetail에서 공통 필드를 보충
  // (HL specific 필드 — bankAccount, confirmPriorDisability 등 — 은 null로 남음)
  const copdFallback = caseData.copd
    ? {
        firstClinic: caseData.copd.firstClinic,
        firstExamDate: caseData.copd.firstExamDate,
        specialClinic: caseData.copd.specialClinic ?? null,
        expertClinic: null as string | null, // CopdDetail에는 expertClinic 없음 — 향후 CopdApplication 연계 필요
      }
    : null;
  const detail = (caseData.hearingLoss ?? copdFallback) as (typeof caseData.hearingLoss & {
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
        // COPD 사건은 소음노출 확인서 부적합 — 분진작업 확인서로 안내
        if (caseData.caseType === "COPD") {
          return NextResponse.json(
            {
              error: "COPD 사건은 소음노출 확인서를 사용할 수 없습니다. 분진작업 종사사실 확인서(DUST_WORK_CONFIRM)를 사용하세요.",
              redirect: "DUST_WORK_CONFIRM",
            },
            { status: 400 }
          );
        }
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

        const claimSubject = caseData.caseType === "COPD" ? "장해급여 청구(COPD)" : "장해급여 청구(소음성 난청)";
        drawText(page, claimSubject,                                     184, 664, font, 9);
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
        const claimDetail = caseData.caseType === "COPD"
          ? "COPD 장해급여 청구에 관한 사항 일체"
          : "소음성 난청 장해급여 청구에 관한 사항 일체";
        drawText(page, claimDetail,                                       271, 356, font, 9);
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

        // 특진 사유 (caseType별 분기)
        const specialClinicReason =
          caseData.caseType === "COPD" ? "COPD(특별진찰)" : "소음성 난청(특별진찰)";
        drawText(page, specialClinicReason, 148, 572, font, 9);
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

        // 특진 사유 (caseType별 분기)
        const expertClinicReason =
          caseData.caseType === "COPD"
            ? "COPD(업무관련성 평가)"
            : "소음성 난청(업무관련성 평가)";
        drawText(page, expertClinicReason, 148, 572, font, 9);
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

      case "INFO_DISCLOSURE": {
        const pdfDoc = await loadBlankForm("info_disclosure.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];

        const content = req.nextUrl.searchParams.get("content") ??
          `${patient.name}(${patient.ssn ?? ""})님의 장해 등급 결정 관련 일체의 서류(장해진단서, 자문의 소견서, 특진 및 의무기록자료 일체)`;

        const claimantName = `${patient.name}의 대리인 공인노무사 ${manager?.name ?? ""}`;
        const agentSsn = (manager as any)?.personalId ?? "";
        const FIRM_BIZ_REG_NO = process.env.FIRM_BIZ_REG_NO ?? "391-85-01751";

        drawText(page, claimantName,             108, 711, font, 9);
        drawText(page, agentSsn,                 338, 711, font, 9);
        drawText(page, manager?.officeAddress ?? "", 108, 686, font, 8);
        drawText(page, FIRM_BIZ_REG_NO,          338, 686, font, 9);
        drawText(page, manager?.officeTel ?? "", 108, 649, font, 9);
        drawText(page, manager?.officeFax ?? "", 225, 649, font, 9);
        drawText(page, (manager as any)?.email ?? "", 338, 649, font, 9);

        const lines = content.split("\n");
        lines.forEach((line, i) => {
          drawText(page, line, 108, 561 - i * 12, font, 8);
        });

        drawText(page, today.연도, 384, 321, font, 10);
        drawText(page, today.월자, 430, 321, font, 10);
        drawText(page, today.일자, 470, 321, font, 10);
        drawText(page, `공인노무사 ${manager?.name ?? ""}`, 108, 304, font, 9);
        drawText(page, `근로복지공단 ${caseData.kwcOfficeName ?? ""}지사장 귀하`, 200, 286, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "LABOR_ATTORNEY_RECORD": {
        // 공유 모듈로 위임 (자동 생성/백필과 동일 코드 사용)
        const generated = await generateLaborAttorneyRecord(caseId, {
          contractAmount: req.nextUrl.searchParams.get("contractAmount") ?? undefined,
          advanceAmount:  req.nextUrl.searchParams.get("advanceAmount") ?? undefined,
        });
        if (!generated) {
          return NextResponse.json({ error: "사건 없음" }, { status: 404 });
        }
        pdfBytes = generated;
        break;
      }

      case "THIRD_PARTY_INFO": {
        const pdfDoc = await loadBlankForm("third_party_info.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];

        drawText(page, today.연도, 245, 99,  font, 10);
        drawText(page, today.월자, 287, 99,  font, 10);
        drawText(page, today.일자, 325, 99,  font, 10);
        drawText(page, patient.ssn ?? "", 100, 79, font, 9);
        drawText(page, patient.name ?? "", 250, 79, font, 9);
        drawText(page, "○", 365, 126, font, 10);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "MEDICAL_BENEFIT": {
        const pdfDoc = await loadBlankForm("medical_benefit.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const bf = parseBirthDate(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);
        const lastJob = workHistory[workHistory.length - 1] ?? null;

        drawText(page, patient.name ?? "",     65,  684, font, 9);
        drawText(page, patient.ssn ?? "",      331, 686, font, 9);
        drawText(page, patient.address ?? "",  66,  650, font, 8);
        drawText(page, patient.phone ?? "",    353, 665, font, 9);
        drawText(page, df.연도,   100, 626, font, 9);
        drawText(page, df.월자,   150, 626, font, 9);
        drawText(page, df.일자,   196, 626, font, 9);
        drawText(page, "[√]",    254, 347, font, 9);
        drawText(page, lastJob?.company ?? "",  130, 479, font, 9);
        drawText(page, "",                      106, 436, font, 9);
        drawText(page, today.연도, 236, 86, font, 9);
        drawText(page, today.월자, 280, 86, font, 9);
        drawText(page, today.일자, 310, 86, font, 9);
        drawText(page, patient.name ?? "",       340, 70, font, 9);
        drawText(page, `공인노무사 ${manager?.name ?? ""}`, 340, 54, font, 9);
        drawText(page, `근로복지공단 ${caseData.kwcOfficeName ?? ""}지사장 귀하`, 200, 40, font, 9);

        // 주민번호 13자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        const ssnDigits = (patient.ssn ?? "").replace(/[^0-9]/g, "").padEnd(13, " ").split("");
        drawText(page, ssnDigits[0],  0, 0, font, 9);
        drawText(page, ssnDigits[1],  0, 0, font, 9);
        drawText(page, ssnDigits[2],  0, 0, font, 9);
        drawText(page, ssnDigits[3],  0, 0, font, 9);
        drawText(page, ssnDigits[4],  0, 0, font, 9);
        drawText(page, ssnDigits[5],  0, 0, font, 9);
        drawText(page, ssnDigits[6],  0, 0, font, 9);
        drawText(page, ssnDigits[7],  0, 0, font, 9);
        drawText(page, ssnDigits[8],  0, 0, font, 9);
        drawText(page, ssnDigits[9],  0, 0, font, 9);
        drawText(page, ssnDigits[10], 0, 0, font, 9);
        drawText(page, ssnDigits[11], 0, 0, font, 9);
        drawText(page, ssnDigits[12], 0, 0, font, 9);

        // 재해발생일 8자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        const injDate = detail?.firstExamDate ? new Date(detail.firstExamDate) : null;
        const inj = parseDateFields(injDate);
        drawText(page, inj.y1, 0, 0, font, 9);
        drawText(page, inj.y2, 0, 0, font, 9);
        drawText(page, inj.y3, 0, 0, font, 9);
        drawText(page, inj.y4, 0, 0, font, 9);
        drawText(page, inj.m1, 0, 0, font, 9);
        drawText(page, inj.m2, 0, 0, font, 9);
        drawText(page, inj.d1, 0, 0, font, 9);
        drawText(page, inj.d2, 0, 0, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "SICK_LEAVE_BENEFIT": {
        const pdfDoc = await loadBlankForm("sick_leave_benefit.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const bf = parseBirthDate(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);

        const claimStartYear  = req.nextUrl.searchParams.get("claimStartYear") ?? "";
        const claimStartMonth = req.nextUrl.searchParams.get("claimStartMonth") ?? "";
        const claimStartDay   = req.nextUrl.searchParams.get("claimStartDay") ?? "";
        const claimEndYear    = req.nextUrl.searchParams.get("claimEndYear") ?? "";
        const claimEndMonth   = req.nextUrl.searchParams.get("claimEndMonth") ?? "";
        const claimEndDay     = req.nextUrl.searchParams.get("claimEndDay") ?? "";

        const bankStr = detail ? `${detail.bankName ?? ""} ${detail.bankAccount ?? ""}`.trim() : "";

        drawText(page, patient.name ?? "",    150, 688, font, 9);
        drawText(page, bf.Y3 + bf.Y4,         220, 688, font, 9);
        drawText(page, bf.M1 + bf.M2,         268, 688, font, 9);
        drawText(page, bf.D1 + bf.D2,         308, 688, font, 9);
        drawText(page, df.연도, 130, 640, font, 9);
        drawText(page, df.월자, 175, 640, font, 9);
        drawText(page, df.일자, 210, 640, font, 9);
        drawText(page, bankStr, 95, 583, font, 9);
        drawText(page, detail?.bankAccountHolder ?? "", 380, 583, font, 9);
        drawText(page, claimStartYear,  95,  518, font, 9);
        drawText(page, claimStartMonth, 140, 518, font, 9);
        drawText(page, claimStartDay,   178, 518, font, 9);
        drawText(page, claimEndYear,    260, 518, font, 9);
        drawText(page, claimEndMonth,   305, 518, font, 9);
        drawText(page, claimEndDay,     343, 518, font, 9);
        drawText(page, today.연도, 230, 271, font, 9);
        drawText(page, today.월자, 270, 271, font, 9);
        drawText(page, today.일자, 305, 271, font, 9);
        drawText(page, patient.name ?? "",       195, 255, font, 9);
        drawText(page, patient.phone ?? "",      340, 255, font, 9);
        drawText(page, `공인노무사 ${manager?.name ?? ""}`, 195, 239, font, 9);
        drawText(page, manager?.officeTel ?? "", 340, 239, font, 9);
        drawText(page, `근로복지공단 ${caseData.kwcOfficeName ?? ""}지사장 귀하`, 205, 125, font, 9);

        // 은행명 단독 (좌표 미정 — /forms 에디터에서 지정)
        drawText(page, detail?.bankName ?? "", 0, 0, font, 9);

        // 생년월일 8자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        drawText(page, bf.Y1, 0, 0, font, 9);
        drawText(page, bf.Y2, 0, 0, font, 9);
        drawText(page, bf.Y3, 0, 0, font, 9);
        drawText(page, bf.Y4, 0, 0, font, 9);
        drawText(page, bf.M1, 0, 0, font, 9);
        drawText(page, bf.M2, 0, 0, font, 9);
        drawText(page, bf.D1, 0, 0, font, 9);
        drawText(page, bf.D2, 0, 0, font, 9);

        // 재해발생일 8자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        const injDateSlb = detail?.firstExamDate ? new Date(detail.firstExamDate) : null;
        const injSlb = parseDateFields(injDateSlb);
        drawText(page, injSlb.y1, 0, 0, font, 9);
        drawText(page, injSlb.y2, 0, 0, font, 9);
        drawText(page, injSlb.y3, 0, 0, font, 9);
        drawText(page, injSlb.y4, 0, 0, font, 9);
        drawText(page, injSlb.m1, 0, 0, font, 9);
        drawText(page, injSlb.m2, 0, 0, font, 9);
        drawText(page, injSlb.d1, 0, 0, font, 9);
        drawText(page, injSlb.d2, 0, 0, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "INFO_DISCLOSURE_PROXY": {
        const pdfDoc = await loadBlankForm("info_disclosure_proxy.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const agentSsn = (manager as any)?.personalId ?? "";

        drawText(page, patient.name ?? "",       112, 732, font, 9);
        drawText(page, patient.ssn ?? "",        342, 732, font, 9);
        drawText(page, patient.address ?? "",    112, 698, font, 8);
        drawText(page, `공인노무사 ${manager?.name ?? ""}`, 112, 660, font, 9);
        drawText(page, agentSsn,                 342, 660, font, 9);
        drawText(page, manager?.officeAddress ?? "", 112, 643, font, 8);
        drawText(page, today.연도, 350, 142, font, 10);
        drawText(page, today.월자, 395, 142, font, 10);
        drawText(page, today.일자, 430, 142, font, 10);
        drawText(page, patient.name ?? "",       333, 110, font, 9);

        // 청구인 주민번호 13자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        const claimantDigits = (patient.ssn ?? "").replace(/[^0-9]/g, "").padEnd(13, " ").split("");
        drawText(page, claimantDigits[0],  0, 0, font, 9);
        drawText(page, claimantDigits[1],  0, 0, font, 9);
        drawText(page, claimantDigits[2],  0, 0, font, 9);
        drawText(page, claimantDigits[3],  0, 0, font, 9);
        drawText(page, claimantDigits[4],  0, 0, font, 9);
        drawText(page, claimantDigits[5],  0, 0, font, 9);
        drawText(page, claimantDigits[6],  0, 0, font, 9);
        drawText(page, claimantDigits[7],  0, 0, font, 9);
        drawText(page, claimantDigits[8],  0, 0, font, 9);
        drawText(page, claimantDigits[9],  0, 0, font, 9);
        drawText(page, claimantDigits[10], 0, 0, font, 9);
        drawText(page, claimantDigits[11], 0, 0, font, 9);
        drawText(page, claimantDigits[12], 0, 0, font, 9);

        // 수임인 주민번호 13자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        const agentDigits = agentSsn.replace(/[^0-9]/g, "").padEnd(13, " ").split("");
        drawText(page, agentDigits[0],  0, 0, font, 9);
        drawText(page, agentDigits[1],  0, 0, font, 9);
        drawText(page, agentDigits[2],  0, 0, font, 9);
        drawText(page, agentDigits[3],  0, 0, font, 9);
        drawText(page, agentDigits[4],  0, 0, font, 9);
        drawText(page, agentDigits[5],  0, 0, font, 9);
        drawText(page, agentDigits[6],  0, 0, font, 9);
        drawText(page, agentDigits[7],  0, 0, font, 9);
        drawText(page, agentDigits[8],  0, 0, font, 9);
        drawText(page, agentDigits[9],  0, 0, font, 9);
        drawText(page, agentDigits[10], 0, 0, font, 9);
        drawText(page, agentDigits[11], 0, 0, font, 9);
        drawText(page, agentDigits[12], 0, 0, font, 9);

        // 정보 내용 (좌표 미정 — /forms 에디터에서 지정)
        const infoContent = req.nextUrl.searchParams.get("infoContent") ?? "";
        drawText(page, infoContent, 0, 0, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "PENSION_CHOICE": {
        const pdfDoc = await loadBlankForm("pension_choice.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];

        drawText(page, today.연도, 236, 93, font, 10);
        drawText(page, today.월자, 282, 93, font, 10);
        drawText(page, today.일자, 318, 93, font, 10);
        drawText(page, patient.name ?? "", 310, 78, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "BEREAVED_CLAIM": {
        const pdfDoc = await loadBlankForm("bereaved_claim.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const bf = parseBirthDate(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);
        const lastJob = workHistory[workHistory.length - 1] ?? null;
        const funeralDate = req.nextUrl.searchParams.get("funeralDate") ?? "";
        const bankStr = detail ? `${detail.bankName ?? ""} ${detail.bankAccount ?? ""}`.trim() : "";

        drawText(page, lastJob?.company ?? "",   355, 694, font, 9);
        drawText(page, "",                        437, 684, font, 9);
        drawText(page, `亡 ${patient.name ?? ""}`, 156, 656, font, 9);
        drawText(page, patient.ssn ?? "",         310, 656, font, 9);
        drawText(page, patient.address ?? "",     156, 628, font, 8);
        drawText(page, lastJob?.jobType ?? "",    437, 618, font, 9);
        drawText(page, df.연도, 168, 596, font, 9);
        drawText(page, df.월자, 215, 596, font, 9);
        drawText(page, df.일자, 255, 596, font, 9);
        drawText(page, funeralDate, 430, 466, font, 9);
        drawText(page, bankStr, 150, 356, font, 9);
        drawText(page, detail?.bankAccountHolder ?? "", 390, 356, font, 9);
        drawText(page, today.연도, 160, 131, font, 9);
        drawText(page, today.월자, 200, 131, font, 9);
        drawText(page, today.일자, 235, 131, font, 9);
        drawText(page, patient.name ?? "",       130, 115, font, 9);
        drawText(page, `공인노무사 ${manager?.name ?? ""}`, 130, 99, font, 9);
        drawText(page, `근로복지공단 ${caseData.kwcOfficeName ?? ""}지사장 귀하`, 209, 83, font, 9);

        // 생년월일 8자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        drawText(page, bf.Y1, 0, 0, font, 9);
        drawText(page, bf.Y2, 0, 0, font, 9);
        drawText(page, bf.Y3, 0, 0, font, 9);
        drawText(page, bf.Y4, 0, 0, font, 9);
        drawText(page, bf.M1, 0, 0, font, 9);
        drawText(page, bf.M2, 0, 0, font, 9);
        drawText(page, bf.D1, 0, 0, font, 9);
        drawText(page, bf.D2, 0, 0, font, 9);

        // 재해발생일 8자리 per-digit (좌표 미정 — /forms 에디터에서 지정)
        const injDateBc = detail?.firstExamDate ? new Date(detail.firstExamDate) : null;
        const injBc = parseDateFields(injDateBc);
        drawText(page, injBc.y1, 0, 0, font, 9);
        drawText(page, injBc.y2, 0, 0, font, 9);
        drawText(page, injBc.y3, 0, 0, font, 9);
        drawText(page, injBc.y4, 0, 0, font, 9);
        drawText(page, injBc.m1, 0, 0, font, 9);
        drawText(page, injBc.m2, 0, 0, font, 9);
        drawText(page, injBc.d1, 0, 0, font, 9);
        drawText(page, injBc.d2, 0, 0, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "EX_WORKER_HEALTH_EXAM": {
        const pdfDoc = await loadBlankForm("ex_worker_health_exam.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const lastJob  = workHistory[0] ?? null;
        const firstJob = workHistory[workHistory.length - 1] ?? null;
        const workStart = firstJob ? `${firstJob.startYear}년 ${firstJob.startMonth}월부터` : "";
        const workEnd   = lastJob  ? `${lastJob.endYear}년 ${lastJob.endMonth}월까지` : "";

        drawText(page, patient.name ?? "",     108, 705, font, 9);
        drawText(page, patient.ssn ?? "",      338, 705, font, 9);
        drawText(page, patient.address ?? "",  108, 681, font, 8);
        drawText(page, patient.phone ?? "",    338, 681, font, 9);
        drawText(page, workStart,              108, 626, font, 9);
        drawText(page, workEnd,                200, 626, font, 9);
        drawText(page, lastJob?.company ?? "", 108, 596, font, 9);
        drawText(page, "",                     108, 566, font, 9);
        drawText(page, today.연도, 350, 231, font, 10);
        drawText(page, today.월자, 390, 231, font, 10);
        drawText(page, today.일자, 425, 231, font, 10);
        drawText(page, patient.name ?? "", 300, 201, font, 9);
        drawText(page, `근로복지공단 ${caseData.kwcOfficeName ?? ""}이사장 귀하`, 100, 151, font, 9);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "DUST_WORK_CONFIRM": {
        const pdfDoc = await loadBlankForm("dust_work_confirm.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];

        const fmtStart = (j: WorkHistoryItem) => `${j.startYear}년 ${j.startMonth}월부터`;
        const fmtEnd   = (j: WorkHistoryItem) => `${j.endYear}년 ${j.endMonth}월까지`;

        drawText(page, patient.name ?? "", 108, 766, font, 9);
        drawText(page, patient.ssn ?? "",  108, 746, font, 9);

        const rows: { y: number; ys: number; ye: number }[] = [
          { y: 696, ys: 703, ye: 686 },
          { y: 611, ys: 619, ye: 601 },
          { y: 530, ys: 538, ye: 520 },
          { y: 450, ys: 458, ye: 440 },
          { y: 370, ys: 378, ye: 360 },
        ];

        rows.forEach((r, i) => {
          const j = workHistory[i];
          if (!j) return;
          drawText(page, j.company,    85,  r.y,  font, 8);
          drawText(page, j.jobType,    175, r.y,  font, 8);
          drawText(page, j.department, 265, r.y,  font, 8);
          drawText(page, fmtStart(j),  345, r.ys, font, 8);
          drawText(page, fmtEnd(j),    345, r.ye, font, 8);
        });

        drawText(page, today.연도, 340, 161, font, 10);
        drawText(page, today.월자, 380, 161, font, 10);
        drawText(page, today.일자, 415, 161, font, 10);
        drawText(page, patient.name ?? "", 300, 143, font, 9);

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
