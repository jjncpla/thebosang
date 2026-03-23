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
        const T = (text: string, x: number, y: number, size = 9) => drawText(page, text, x, y, font, size);

        const jf = parseJumin(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);

        T(patient.name, 175, 686);
        T(jf["1"], 203, 664); T(jf["2"], 218, 664); T(jf["3"], 233, 664);
        T(jf["4"], 248, 664); T(jf["5"], 263, 664); T(jf["6"], 278, 664);
        T(jf["7"], 390, 664);
        T(patient.address ?? "", 115, 638, 8);
        T("√", 406, 613); // 퇴직 체크
        T("√", 195, 484); // 근로자 체크
        T((caseData as { workplaceName?: string | null }).workplaceName ?? "", 175, 450, 8);
        T(df.y1, 206, 560); T(df.y2, 218, 560); T(df.y3, 230, 560); T(df.y4, 242, 560);
        T(df.m1, 258, 560); T(df.m2, 270, 560);
        T(df.d1, 310, 560); T(df.d2, 322, 560);

        const lastJob = workHistory[workHistory.length - 1];
        T(lastJob?.jobType ?? "", 430, 563, 8);

        const noiseJobs = workHistory.filter((w) => w.noiseExposure);
        const rowYs = [315, 285, 252, 220, 188];
        noiseJobs.slice(0, 5).forEach((job, i) => {
          const ry = rowYs[i];
          T(job.company, 155, ry, 7);
          T(fmtPeriod(job), 260, ry, 7);
          T(job.jobType ?? "", 345, ry, 7);
        });

        T(today.연도, 215, 136); T(today.월자, 270, 136); T(today.일자, 320, 136);
        T(patient.name, 250, 110); T(patient.phone ?? "", 415, 110);
        T(manager?.name ?? "", 250, 98); T(manager?.officeTel ?? "", 415, 98);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "AGENT_APPOINTMENT": {
        const pdfDoc = await loadBlankForm("agent_appointment.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const T = (text: string, x: number, y: number, size = 9) => drawText(page, text, x, y, font, size);

        const bf = parseBirthDate(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);

        T("장해급여 청구(소음성 난청)", 175, 656);
        T(patient.name, 175, 621);
        T(`${bf.Y1}${bf.Y2}${bf.Y3}${bf.Y4}.${bf.M1}${bf.M2}.${bf.D1}${bf.D2}`, 400, 621);
        T(patient.address ?? "", 175, 581, 8);
        T(patient.phone ?? "", 350, 565);
        T("√", 175, 539); // 근로자 체크
        T(`노무법인 더보상 ${manager?.branchName ?? ""}`, 175, 507);
        T(manager?.licenseNo ?? "", 450, 491);
        T(`공인노무사 ${manager?.name ?? ""}`, 175, 454);
        T(manager?.jobTitle ?? "", 430, 454);
        T(manager?.officeAddress ?? "", 175, 414, 8);
        T(manager?.officeTel ?? "", 230, 391, 8);
        T(manager?.officeTel ?? "", 335, 391, 8);
        T(manager?.officeFax ?? "", 450, 391, 8);
        T("소음성 난청 장해급여 청구에 관한 사항 일체", 175, 354);
        T(`${df.연도}.${df.월자}.${df.일자}`, 175, 310);
        T(today.연도, 355, 195); T(today.월자, 405, 195); T(today.일자, 450, 195);
        T(patient.name, 340, 163);
        T(caseData.kwcOfficeName ?? "", 270, 131);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "POWER_OF_ATTORNEY": {
        const pdfDoc = await loadBlankForm("power_of_attorney.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const T = (text: string, x: number, y: number, size = 9) => drawText(page, text, x, y, font, size);

        T(`노무법인 더보상 ${manager?.branchName ?? ""}`, 220, 649, 10);
        T(manager?.officeAddress ?? "", 220, 630);
        T(manager?.officeTel ?? "", 220, 612);
        T(manager?.officeFax ?? "", 220, 595);
        T(`제 ${manager?.licenseNo ?? ""}호`, 270, 577);
        T(`공인노무사 ${manager?.name ?? ""}`, 220, 559);
        T(today.연도, 355, 273, 10); T(today.월자, 403, 273, 10); T(today.일자, 460, 273, 10);
        T(patient.name, 230, 226, 10);
        T(patient.ssn ?? "", 230, 197);
        T(patient.address ?? "", 230, 169);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "SPECIAL_CLINIC": {
        const pdfDoc = await loadBlankForm("special_clinic.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const T = (text: string, x: number, y: number, size = 9) => drawText(page, text, x, y, font, size);

        const jf = parseJumin(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);
        const clinicName = detail?.specialClinic ?? "";
        const clinicAddr = getHospitalRegion(clinicName);
        const mgrPhone = (manager as { phone?: string | null } | null)?.phone ?? manager?.officeTel ?? "";

        T(patient.name, 100, 686);
        T(jf["1"], 195, 671); T(jf["2"], 208, 671); T(jf["3"], 221, 671);
        T(jf["4"], 234, 671); T(jf["5"], 247, 671); T(jf["6"], 260, 671);
        T(jf["7"], 278, 671);
        T(df.y1, 415, 671); T(df.y2, 428, 671); T(df.y3, 441, 671); T(df.y4, 454, 671);
        T(df.m1, 470, 671); T(df.m2, 483, 671);
        T(df.d1, 522, 671); T(df.d2, 535, 671);
        T(patient.address ?? "", 100, 647, 8);
        T(patient.phone ?? "", 440, 647);
        T("소음성 난청(특별진찰)", 145, 580);
        T(`- 대리인 Tel: ${manager?.officeTel ?? ""}  Fax: ${manager?.officeFax ?? ""}`, 145, 568, 8);
        T(clinicName, 145, 518);
        if (clinicAddr) T(clinicAddr, 290, 518, 8);
        T("√", 512, 518); // 첫 번째 행 체크
        T(today.연도, 335, 187); T(today.월자, 368, 187); T(today.일자, 400, 187);
        T(patient.name, 145, 175); T(patient.phone ?? "", 460, 175);
        T(manager?.name ?? "", 145, 157);
        T(manager?.officeTel ?? "", 360, 157);
        T(mgrPhone, 480, 157);
        T(caseData.kwcOfficeName ?? "", 165, 60);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "EXPERT_CLINIC": {
        const pdfDoc = await loadBlankForm("expert_clinic.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const page = pdfDoc.getPages()[0];
        const T = (text: string, x: number, y: number, size = 9) => drawText(page, text, x, y, font, size);

        const jf = parseJumin(patient.ssn ?? "");
        const df = parseDateFields(detail?.firstExamDate ? new Date(detail.firstExamDate) : null);
        const clinicName = detail?.expertClinic ?? "";
        const clinicAddr = getHospitalRegion(clinicName);
        const mgrPhone = (manager as { phone?: string | null } | null)?.phone ?? manager?.officeTel ?? "";

        T(patient.name, 100, 686);
        T(jf["1"], 195, 671); T(jf["2"], 208, 671); T(jf["3"], 221, 671);
        T(jf["4"], 234, 671); T(jf["5"], 247, 671); T(jf["6"], 260, 671);
        T(jf["7"], 278, 671);
        T(df.y1, 415, 671); T(df.y2, 428, 671); T(df.y3, 441, 671); T(df.y4, 454, 671);
        T(df.m1, 470, 671); T(df.m2, 483, 671);
        T(df.d1, 522, 671); T(df.d2, 535, 671);
        T(patient.address ?? "", 100, 647, 8);
        T(patient.phone ?? "", 440, 647);
        T("소음성 난청(업무관련성 평가)", 145, 580);
        T(`- 대리인 H.P: ${mgrPhone}  Tel: ${manager?.officeTel ?? ""}`, 145, 568, 8);
        T(`  Fax: ${manager?.officeFax ?? ""}`, 145, 558, 8);
        T(clinicName, 145, 518);
        if (clinicAddr) T(clinicAddr, 290, 518, 8);
        T("√", 512, 518);
        T(today.연도, 335, 187); T(today.월자, 368, 187); T(today.일자, 400, 187);
        T(patient.name, 145, 175); T(patient.phone ?? "", 460, 175);
        T(manager?.name ?? "", 145, 157);
        T(manager?.officeTel ?? "", 360, 157);
        T(mgrPhone, 480, 157);
        T(caseData.kwcOfficeName ?? "", 165, 60);

        pdfBytes = await pdfDoc.save();
        break;
      }

      case "WORK_HISTORY": {
        const pdfDoc = await loadBlankForm("work_history.pdf");
        const font = await loadKoreanFont(pdfDoc);
        const pages = pdfDoc.getPages();

        // 페이지 1: 인적사항 + 문1~4
        const p1 = pages[0];
        const T1 = (text: string, x: number, y: number, size = 9) => drawText(p1, text, x, y, font, size);
        T1(patient.name, 156, 632);
        T1(patient.phone ?? "", 156, 604);
        T1(patient.address ?? "", 156, 576, 8);

        // 페이지 2: 문5~9 + 사업장근무력 테이블
        if (pages.length > 1) {
          const p2 = pages[1];
          const T2 = (text: string, x: number, y: number, size = 9) => drawText(p2, text, x, y, font, size);

          // 상단 테이블 첫 행 (allJobs[0])
          if (workHistory[0]) {
            const j = workHistory[0];
            const months = calcMonths(j);
            const yrs = Math.floor(months / 12); const mths = months % 12;
            T2("1", 98, 623, 8);
            T2(fmtPeriod(j), 145, 623, 7);
            T2(`${j.company}(${j.jobType ?? ""})`, 225, 623, 7);
            T2(`${yrs}년 ${mths}개월`, 383, 623, 7);
            if (j.source?.includes("건강")) T2("√", 414, 623, 7);
            if (j.source?.includes("연금")) T2("√", 440, 623, 7);
            if (j.source?.includes("고용")) T2("√", 465, 623, 7);
            if (j.source?.includes("소득")) T2("√", 490, 623, 7);
          }

          const totalMonths = workHistory.reduce((acc, j) => acc + calcMonths(j), 0);
          const totalYrs = Math.floor(totalMonths / 12);
          const totalMths = totalMonths % 12;
          T2(`${totalYrs}년 ${totalMths}개월`, 430, 595, 8);
        }

        // 페이지 3: 문10~13 + 서명
        if (pages.length > 2) {
          const p3 = pages[2];
          const T3 = (text: string, x: number, y: number, size = 9) => drawText(p3, text, x, y, font, size);
          T3(today.연도, 222, 302); T3(today.월자, 276, 302); T3(today.일자, 318, 302);
          T3(patient.name, 185, 257); T3(patient.phone ?? "", 440, 257);
          T3(manager?.name ?? "", 185, 214); T3(manager?.officeTel ?? "", 440, 214);
        }

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
