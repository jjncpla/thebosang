import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadBlankForm, loadKoreanFont, drawText, parseBirthDate } from "@/lib/pdf/formUtils";

// forms/page.tsx FORM_FIELDS에서 복사한 좌표값
const AGENT_FIELDS: Record<string, { x: number; y: number }> = {
  caseTitle:    { x: 184, y: 664 },
  name:         { x: 193, y: 629 },
  birthDate:    { x: 452, y: 629 },
  address:      { x: 186, y: 599 },
  phone:        { x: 372, y: 574 },
  mgrBranch:    { x: 222, y: 505 },
  mgrLicense:   { x: 470, y: 505 },
  mgrName:      { x: 250, y: 460 },
  mgrJobTitle:  { x: 477, y: 460 },
  mgrAddress:   { x: 186, y: 425 },
  mgrHP:        { x: 227, y: 400 },
  mgrTel:       { x: 342, y: 400 },
  mgrFax:       { x: 450, y: 391 },
  scope:        { x: 271, y: 356 },
  injDate:      { x: 199, y: 315 },
  todayYear:    { x: 340, y: 203 },
  todayMonth:   { x: 412, y: 203 },
  todayDay:     { x: 461, y: 203 },
  ptName:       { x: 367, y: 173 },
  kwc:          { x: 346, y: 140 },
};

const PROXY_FIELDS: Record<string, { x: number; y: number }> = {
  mgrBranch:    { x: 240, y: 657 },
  mgrAddress:   { x: 240, y: 638 },
  mgrTel:       { x: 240, y: 620 },
  mgrFax:       { x: 240, y: 602 },
  mgrLicense:   { x: 295, y: 585 },
  mgrName:      { x: 233, y: 567 },
  todayYear:    { x: 345, y: 280 },
  todayMonth:   { x: 409, y: 280 },
  todayDay:     { x: 468, y: 280 },
  name:         { x: 285, y: 234 },
  ssn:          { x: 285, y: 206 },
  address:      { x: 285, y: 176 },
};

// 노무법인 더보상 고정값
const FIRM_INFO = {
  mgrBranch:   "노무법인 더보상",
  mgrLicense:  "",
  mgrJobTitle: "공인노무사",
  mgrAddress:  "",
  mgrHP:       "",
  mgrTel:      "",
  mgrFax:      "",
  scope:       "산재보험 급여 청구 및 심사·재심사 청구 일체",
  kwc:         "",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { formType } = await req.json();
  // formType: 'agent' | 'proxy'

  if (formType !== "agent" && formType !== "proxy") {
    return NextResponse.json({ error: "지원하지 않는 서식 유형입니다" }, { status: 400 });
  }

  // ObjectionCase → Case → Patient 경로로 조회 (동명이인 방지)
  const objCase = await prisma.objectionCase.findUnique({
    where: { id },
    include: {
      manager: { select: { name: true } },
      case: {
        include: {
          patient: {
            select: { name: true, ssn: true, phone: true, address: true },
          },
        },
      },
    },
  });

  if (!objCase) {
    return NextResponse.json({ error: "사건을 찾을 수 없습니다" }, { status: 404 });
  }

  // Patient: case 관계가 있으면 그 경로, 없으면 이름으로 fallback
  let patient = objCase.case?.patient ?? null;
  if (!patient) {
    patient = await prisma.patient.findFirst({
      where: { name: objCase.patientName },
      select: { name: true, ssn: true, phone: true, address: true },
    });
  }

  // 생년월일 파싱
  const ssnRaw = patient?.ssn ?? "";
  const birth = parseBirthDate(ssnRaw);
  const birthDateStr = birth.Y1
    ? `${birth.Y1}${birth.Y2}${birth.Y3}${birth.Y4}년 ${birth.M1}${birth.M2}월 ${birth.D1}${birth.D2}일`
    : "";

  // 오늘 날짜
  const today = new Date();
  const todayYear = String(today.getFullYear());
  const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
  const todayDay = String(today.getDate()).padStart(2, "0");

  // 배경 PDF 로드
  const bgFileName = formType === "agent" ? "agent_appointment.pdf" : "power_of_attorney.pdf";
  const pdfDoc = await loadBlankForm(bgFileName);
  const font = await loadKoreanFont(pdfDoc);

  const page = pdfDoc.getPages()[0];

  if (formType === "agent") {
    const data: Record<string, string> = {
      caseTitle:   `${objCase.caseType} 건`,
      name:        patient?.name ?? objCase.patientName,
      birthDate:   birthDateStr,
      address:     patient?.address ?? "",
      phone:       patient?.phone ?? "",
      mgrBranch:   FIRM_INFO.mgrBranch,
      mgrLicense:  FIRM_INFO.mgrLicense,
      mgrName:     objCase.manager?.name ?? "",
      mgrJobTitle: FIRM_INFO.mgrJobTitle,
      mgrAddress:  FIRM_INFO.mgrAddress,
      mgrHP:       FIRM_INFO.mgrHP,
      mgrTel:      FIRM_INFO.mgrTel,
      mgrFax:      FIRM_INFO.mgrFax,
      scope:       FIRM_INFO.scope,
      injDate:     "",
      todayYear,
      todayMonth,
      todayDay,
      ptName:      patient?.name ?? objCase.patientName,
      kwc:         FIRM_INFO.kwc,
    };

    for (const [key, coords] of Object.entries(AGENT_FIELDS)) {
      if (data[key]) {
        drawText(page, data[key], coords.x, coords.y, font, 9);
      }
    }
  } else {
    const data: Record<string, string> = {
      mgrBranch:   FIRM_INFO.mgrBranch,
      mgrAddress:  FIRM_INFO.mgrAddress,
      mgrTel:      FIRM_INFO.mgrTel,
      mgrFax:      FIRM_INFO.mgrFax,
      mgrLicense:  FIRM_INFO.mgrLicense,
      mgrName:     objCase.manager?.name ?? "",
      todayYear,
      todayMonth,
      todayDay,
      name:        patient?.name ?? objCase.patientName,
      ssn:         ssnRaw,
      address:     patient?.address ?? "",
    };

    for (const [key, coords] of Object.entries(PROXY_FIELDS)) {
      if (data[key]) {
        drawText(page, data[key], coords.x, coords.y, font, 9);
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  const label = formType === "agent" ? "대리인선임신고서" : "위임장";
  const fileName = `${label}_${patient?.name ?? objCase.patientName}_${todayYear}${todayMonth}${todayDay}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
