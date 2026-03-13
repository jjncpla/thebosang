import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// ---- Helpers ----

const STATUS_MAP: Record<string, string> = {
  "재특진": "재특진예정",
  "재특진 완료": "재특진완료",
  "특진 중": "특진중",
  "접수보류": "보류",
  "포프TF": "접수완료",
  "국가장애": "접수완료",
};

function normalizeStatus(val: unknown): { status: string; isDisabilityRegistered: boolean } {
  if (!val) return { status: "접수대기", isDisabilityRegistered: false };
  const s = String(val).trim();
  const isDisabilityRegistered = s === "국가장애";
  const mapped = STATUS_MAP[s] ?? s;
  return { status: mapped, isDisabilityRegistered };
}

function normalizeName(val: unknown): string {
  if (!val) return "";
  return String(val).replace(/\d+$/, "").trim();
}

function parseDisposal(val: unknown): { disposalType: string | null; gradeType: string | null; grade: number | null } {
  if (!val) return { disposalType: null, gradeType: null, grade: null };
  if (typeof val === "number") return { disposalType: null, gradeType: null, grade: null };
  const v = String(val).trim();
  if (!v || v === "null") return { disposalType: null, gradeType: null, grade: null };
  if (v === "부지급") return { disposalType: "불승인", gradeType: null, grade: null };
  const gradeTypeMatch = v.match(/^(가중|조정|준용)\s*(\d+)급/);
  if (gradeTypeMatch) return { disposalType: "승인", gradeType: gradeTypeMatch[1], grade: parseInt(gradeTypeMatch[2]) };
  const gradeMatch = v.match(/^(\d+)급/);
  if (gradeMatch) return { disposalType: "승인", gradeType: "일반", grade: parseInt(gradeMatch[1]) };
  return { disposalType: null, gradeType: null, grade: null };
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    try {
      const date = XLSX.SSF.parse_date_code(val);
      if (date) return new Date(date.y, date.m - 1, date.d);
    } catch { return null; }
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function colIdx(header: unknown[], ...terms: string[]): number {
  return header.findIndex(h => h && terms.every(t => String(h).includes(t)));
}

function strVal(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (s === "" || s.startsWith("=")) return null;
  return s;
}

type SheetResult = { created: number; skipped: number; errors: string[]; totalRows: number };

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if ((rows[i] as unknown[]).some(c => c === "연번" || c === "성명" || c === "재해자명")) {
      return i;
    }
  }
  return -1;
}

// ---- Sheet processors ----

async function processHearingLoss(
  ws: XLSX.WorkSheet,
  tfName: string | null,
  branchOverride: string | null,
  offset: number,
  limit: number,
): Promise<SheetResult> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };

  const header = rows[headerRowIdx] as unknown[];
  const prevHeader = headerRowIdx > 0 ? (rows[headerRowIdx - 1] as unknown[]) : [];

  let exam1DateCol = -1;
  const firstSpecialGroupStart = prevHeader.findIndex(h => h && String(h).includes("최초 특진"));
  if (firstSpecialGroupStart !== -1) {
    for (let i = firstSpecialGroupStart; i < header.length; i++) {
      if (header[i] === "1차 특진") { exam1DateCol = i; break; }
    }
  }

  const C = {
    caseNumber:    header.indexOf("연번"),
    name:          header.indexOf("성명"),
    ssn:           header.indexOf("주민번호"),
    phone:         header.indexOf("연락처"),
    salesManager:  colIdx(header, "영업", "담당"),
    caseManager:   colIdx(header, "접수", "담당"),
    contractDate:  colIdx(header, "약정"),
    salesRoute:    colIdx(header, "영업", "경로"),
    branch:        header.indexOf("지사"),
    subAgent:      colIdx(header, "소속"),
    isOneStop:     header.indexOf("원스톱"),
    status:        header.indexOf("진행상황"),
    receptionDate: header.indexOf("접수일자"),
    memo:          header.indexOf("비고"),
    firstClinic:   header.indexOf("초진병원"),
    firstExamDate: colIdx(header, "1차 초진"),
    firstExamRight: header.indexOf("우측"),
    firstExamLeft:  header.indexOf("좌측"),
    specialClinic: header.indexOf("특진병원"),
    exam1Date:     exam1DateCol,
    reExamClinic:  header.indexOf("재특진병원"),
    expertOrg:     header.indexOf("전문조사기관"),
    expertDate:    colIdx(header, "전문조사", "일정"),
    disposal:      header.indexOf("처분결과"),
    disposalDate:  header.indexOf("처분일자"),
  };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  const allDataRows = rows.slice(headerRowIdx + 1);
  const totalRows = allDataRows.length;

  for (const rawRow of allDataRows.slice(offset, offset + limit)) {
    const row = rawRow as unknown[];
    const name = normalizeName(row[C.name]);
    const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
    const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;
    if (!name || !ssn) continue;
    if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

    try {
      let patient = await prisma.patient.findFirst({ where: { ssn } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name, ssn, phone: strVal(row[C.phone]) },
        });
      }

      if (caseNumber) {
        const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "HEARING_LOSS" } });
        if (existing) { skipped++; continue; }
      }

      const { status, isDisabilityRegistered } = normalizeStatus(row[C.status]);
      const { disposalType, gradeType, grade } = parseDisposal(row[C.disposal]);

      const newCase = await prisma.case.create({
        data: {
          patientId:     patient.id,
          caseType:      "HEARING_LOSS",
          caseNumber:    caseNumber ?? null,
          branch:        branchOverride ?? strVal(row[C.branch]),
          tfName:        tfName ?? null,
          subAgent:      strVal(row[C.subAgent]),
          salesManager:  strVal(row[C.salesManager]),
          caseManager:   strVal(row[C.caseManager]),
          salesRoute:    strVal(row[C.salesRoute]),
          contractDate:  toDate(row[C.contractDate]),
          receptionDate: toDate(row[C.receptionDate]),
          isOneStop:     row[C.isOneStop] === true || row[C.isOneStop] === "O" || row[C.isOneStop] === "o",
          memo:          strVal(row[C.memo]),
        },
      });

      await prisma.hearingLossDetail.create({
        data: {
          caseId:                newCase.id,
          status,
          isDisabilityRegistered,
          firstClinic:           strVal(row[C.firstClinic]),
          firstExamDate:         toDate(row[C.firstExamDate]),
          firstExamRight:        row[C.firstExamRight] ? parseFloat(String(row[C.firstExamRight])) || null : null,
          firstExamLeft:         row[C.firstExamLeft]  ? parseFloat(String(row[C.firstExamLeft]))  || null : null,
          specialClinic:         strVal(row[C.specialClinic]),
          exam1Date:             C.exam1Date !== -1 ? toDate(row[C.exam1Date]) : null,
          reExamClinic:          strVal(row[C.reExamClinic]),
          expertOrg:             strVal(row[C.expertOrg]),
          expertDate:            toDate(row[C.expertDate]),
          disposalType,
          gradeType,
          grade,
          disposalDecidedAt:     toDate(row[C.disposalDate]),
        },
      });

      created++;
    } catch (e) {
      errors.push(`${name}(${ssn}): ${(e as Error).message}`);
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), totalRows };
}

async function processPneumoconiosis(
  ws: XLSX.WorkSheet,
  tfName: string | null,
  branchOverride: string | null,
  offset: number,
  limit: number,
): Promise<SheetResult> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };

  const header = rows[headerRowIdx] as unknown[];

  const C = {
    caseNumber:           header.indexOf("연번"),
    name:                 header.indexOf("성명"),
    ssn:                  header.indexOf("주민번호"),
    phone:                header.indexOf("연락처"),
    salesManager:         colIdx(header, "영업", "담당"),
    caseManager:          colIdx(header, "접수", "담당"),
    contractDate:         colIdx(header, "약정"),
    salesRoute:           colIdx(header, "영업", "경로"),
    branch:               header.indexOf("지사"),
    subAgent:             colIdx(header, "소속"),
    status:               header.indexOf("진행상황"),
    receptionDate:        header.indexOf("접수일자"),
    memo:                 header.indexOf("비고"),
    noticeReceivedDate:   colIdx(header, "진폐정밀", "통지"),
    firstClinic:          header.indexOf("초진병원"),
    firstExamDate:        header.indexOf("초진일자"),
    precisionExamDate:    header.indexOf("진폐정밀실시일"),
    precisionResult:      header.indexOf("정밀결과"),
    precisionHospital:    header.indexOf("진폐정밀병원"),
    precisionPossibleDate: header.indexOf("진폐정밀가능일자"),
    reExamPossibleDate:   header.indexOf("재진행가능일자"),
    disposal:             header.indexOf("처분결과"),
    disposalDate:         header.indexOf("처분일자"),
  };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  const allDataRows = rows.slice(headerRowIdx + 1);
  const totalRows = allDataRows.length;

  for (const rawRow of allDataRows.slice(offset, offset + limit)) {
    const row = rawRow as unknown[];
    const name = normalizeName(row[C.name]);
    const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
    const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;
    if (!name || !ssn) continue;
    if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

    try {
      let patient = await prisma.patient.findFirst({ where: { ssn } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name, ssn, phone: strVal(row[C.phone]) },
        });
      }

      if (caseNumber) {
        const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "PNEUMOCONIOSIS" } });
        if (existing) { skipped++; continue; }
      }

      const { status } = normalizeStatus(row[C.status]);
      const { disposalType } = parseDisposal(row[C.disposal]);

      const newCase = await prisma.case.create({
        data: {
          patientId:     patient.id,
          caseType:      "PNEUMOCONIOSIS",
          caseNumber:    caseNumber ?? null,
          branch:        branchOverride ?? strVal(row[C.branch]),
          tfName:        tfName ?? null,
          subAgent:      strVal(row[C.subAgent]),
          salesManager:  strVal(row[C.salesManager]),
          caseManager:   strVal(row[C.caseManager]),
          salesRoute:    strVal(row[C.salesRoute]),
          contractDate:  toDate(row[C.contractDate]),
          receptionDate: toDate(row[C.receptionDate]),
          memo:          strVal(row[C.memo]),
        },
      });

      await prisma.pneumoconiosisDetail.create({
        data: {
          caseId:               newCase.id,
          status,
          firstClinic:          strVal(row[C.firstClinic]),
          firstExamDate:        toDate(row[C.firstExamDate]),
          noticeReceivedDate:   toDate(row[C.noticeReceivedDate]),
          precisionExamDate:    toDate(row[C.precisionExamDate]),
          precisionResult:      strVal(row[C.precisionResult]),
          precisionHospital:    strVal(row[C.precisionHospital]),
          precisionPossibleDate: toDate(row[C.precisionPossibleDate]),
          reExamPossibleDate:   toDate(row[C.reExamPossibleDate]),
          disposalType,
          disposalDate:         toDate(row[C.disposalDate]),
        },
      });

      created++;
    } catch (e) {
      errors.push(`${name}(${ssn}): ${(e as Error).message}`);
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), totalRows };
}

async function processCopd(
  ws: XLSX.WorkSheet,
  tfName: string | null,
  branchOverride: string | null,
  offset: number,
  limit: number,
): Promise<SheetResult> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };

  const header = rows[headerRowIdx] as unknown[];

  const C = {
    caseNumber:        header.findIndex(h => h === "연번"),
    name:              header.indexOf("성명"),
    ssn:               header.indexOf("주민번호"),
    phone:             header.indexOf("연락처"),
    salesManager:      colIdx(header, "영업", "담당"),
    caseManager:       colIdx(header, "접수", "담당"),
    contractDate:      colIdx(header, "약정"),
    salesRoute:        colIdx(header, "영업", "경로"),
    branch:            header.indexOf("지사"),
    subAgent:          colIdx(header, "소속"),
    status:            header.indexOf("진행상황"),
    receptionDate:     header.findIndex((h: unknown, i: number) => h === "접수일자" && i > 10),
    memo:              header.lastIndexOf("비고"),
    firstClinic:       header.indexOf("초진병원"),
    firstExamDate:     header.indexOf("초진일자"),
    specialClinic:     header.indexOf("특진병원"),
    exam1Date:         header.indexOf("1차특진"),
    exam2Date:         header.indexOf("2차특진"),
    examResult:        header.indexOf("특진결과"),
    expertOrgDate:     colIdx(header, "직업환경"),
    reExamPossibleDate: header.lastIndexOf("재진행가능일"),
    disposal:          header.indexOf("처분결과"),
    disposalDate:      header.indexOf("처분일자"),
  };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  const allDataRows = rows.slice(headerRowIdx + 1);
  const totalRows = allDataRows.length;

  for (const rawRow of allDataRows.slice(offset, offset + limit)) {
    const row = rawRow as unknown[];
    const name = normalizeName(row[C.name]);
    const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
    const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;
    if (!name || !ssn) continue;
    if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

    try {
      let patient = await prisma.patient.findFirst({ where: { ssn } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name, ssn, phone: strVal(row[C.phone]) },
        });
      }

      if (caseNumber) {
        const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "COPD" } });
        if (existing) { skipped++; continue; }
      }

      const { status } = normalizeStatus(row[C.status]);
      const { disposalType } = parseDisposal(row[C.disposal]);

      const newCase = await prisma.case.create({
        data: {
          patientId:     patient.id,
          caseType:      "COPD",
          caseNumber:    caseNumber ?? null,
          branch:        branchOverride ?? strVal(row[C.branch]),
          tfName:        tfName ?? null,
          subAgent:      strVal(row[C.subAgent]),
          salesManager:  strVal(row[C.salesManager]),
          caseManager:   strVal(row[C.caseManager]),
          salesRoute:    strVal(row[C.salesRoute]),
          contractDate:  toDate(row[C.contractDate]),
          receptionDate: toDate(row[C.receptionDate]),
          memo:          strVal(row[C.memo]),
        },
      });

      await prisma.copdDetail.create({
        data: {
          caseId:            newCase.id,
          status,
          firstClinic:       strVal(row[C.firstClinic]),
          firstExamDate:     toDate(row[C.firstExamDate]),
          specialClinic:     strVal(row[C.specialClinic]),
          exam1Date:         toDate(row[C.exam1Date]),
          exam2Date:         toDate(row[C.exam2Date]),
          examResult:        strVal(row[C.examResult]),
          expertOrgDate:     toDate(row[C.expertOrgDate]),
          reExamPossibleDate: toDate(row[C.reExamPossibleDate]),
          disposalType,
          disposalDate:      toDate(row[C.disposalDate]),
        },
      });

      created++;
    } catch (e) {
      errors.push(`${name}(${ssn}): ${(e as Error).message}`);
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), totalRows };
}

async function processOccupationalCancer(
  ws: XLSX.WorkSheet,
  tfName: string | null,
  branchOverride: string | null,
  offset: number,
  limit: number,
): Promise<SheetResult> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };

  const header = rows[headerRowIdx] as unknown[];

  const C = {
    caseNumber:           header.indexOf("연번"),
    name:                 header.findIndex((h: unknown) => h === "재해자명" || h === "성명"),
    ssn:                  header.indexOf("주민번호"),
    phone:                header.indexOf("연락처"),
    salesManager:         colIdx(header, "영업", "담당"),
    caseManager:          header.findIndex((h: unknown) => h === "접수자" || (typeof h === "string" && h.includes("접수") && h.includes("담당"))),
    contractDate:         colIdx(header, "약정"),
    salesRoute:           colIdx(header, "영업", "경로"),
    branch:               header.indexOf("지사"),
    subAgent:             colIdx(header, "소속"),
    status:               header.indexOf("진행상황"),
    receptionDate:        header.indexOf("접수일자"),
    memo:                 header.indexOf("비고"),
    diseaseName:          header.indexOf("상병명"),
    firstDiagnosisDate:   header.indexOf("최초진단일"),
    lastWorkplace:        header.indexOf("최종사업장"),
    disposal:             header.indexOf("처분결과"),
    disposalDate:         header.indexOf("처분일자"),
    treatmentPeriod:      header.indexOf("요양기간"),
    holidayBenefitPeriod: header.findIndex((h: unknown) => typeof h === "string" && h.includes("휴업급여")),
    paymentStatus:        header.indexOf("지급현황"),
  };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  const allDataRows = rows.slice(headerRowIdx + 1);
  const totalRows = allDataRows.length;

  for (const rawRow of allDataRows.slice(offset, offset + limit)) {
    const row = rawRow as unknown[];
    const name = normalizeName(row[C.name]);
    const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
    const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;
    if (!name || !ssn) continue;
    if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

    try {
      let patient = await prisma.patient.findFirst({ where: { ssn } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name, ssn, phone: strVal(row[C.phone]) },
        });
      }

      if (caseNumber) {
        const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "OCCUPATIONAL_CANCER" } });
        if (existing) { skipped++; continue; }
      }

      const { status } = normalizeStatus(row[C.status]);
      const { disposalType } = parseDisposal(row[C.disposal]);

      const newCase = await prisma.case.create({
        data: {
          patientId:     patient.id,
          caseType:      "OCCUPATIONAL_CANCER",
          caseNumber:    caseNumber ?? null,
          branch:        branchOverride ?? strVal(row[C.branch]),
          tfName:        tfName ?? null,
          subAgent:      strVal(row[C.subAgent]),
          salesManager:  strVal(row[C.salesManager]),
          caseManager:   strVal(row[C.caseManager]),
          salesRoute:    strVal(row[C.salesRoute]),
          contractDate:  toDate(row[C.contractDate]),
          receptionDate: toDate(row[C.receptionDate]),
          memo:          strVal(row[C.memo]),
        },
      });

      await prisma.occupationalCancerDetail.create({
        data: {
          caseId:               newCase.id,
          status,
          diseaseName:          strVal(row[C.diseaseName]),
          firstDiagnosisDate:   toDate(row[C.firstDiagnosisDate]),
          lastWorkplace:        strVal(row[C.lastWorkplace]),
          disposalType,
          disposalDate:         toDate(row[C.disposalDate]),
          treatmentPeriod:      strVal(row[C.treatmentPeriod]),
          holidayBenefitPeriod: strVal(row[C.holidayBenefitPeriod]),
          paymentStatus:        strVal(row[C.paymentStatus]),
        },
      });

      created++;
    } catch (e) {
      errors.push(`${name}(${ssn}): ${(e as Error).message}`);
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), totalRows };
}

async function processBereaved(
  ws: XLSX.WorkSheet,
  tfName: string | null,
  branchOverride: string | null,
  offset: number,
  limit: number,
): Promise<SheetResult> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };

  const header = rows[headerRowIdx] as unknown[];

  const C = {
    caseNumber:           header.indexOf("연번"),
    name:                 header.findIndex((h: unknown) => h === "재해자명" || h === "성명"),
    ssn:                  header.indexOf("주민번호"),
    phone:                header.indexOf("연락처"),
    salesManager:         colIdx(header, "영업", "담당"),
    caseManager:          header.findIndex((h: unknown) => h === "접수자" || (typeof h === "string" && h.includes("접수") && h.includes("담당"))),
    contractDate:         colIdx(header, "약정"),
    salesRoute:           colIdx(header, "영업", "경로"),
    branch:               header.indexOf("지사"),
    subAgent:             colIdx(header, "소속"),
    status:               header.indexOf("진행상황"),
    receptionDate:        header.indexOf("접수일자"),
    memo:                 header.indexOf("비고"),
    diseaseName:          header.indexOf("상병명"),
    firstDiagnosisDate:   header.indexOf("최초진단일"),
    lastWorkplace:        header.indexOf("최종사업장"),
    disposal:             header.indexOf("처분결과"),
    disposalDate:         header.indexOf("처분일자"),
    treatmentPeriod:      header.indexOf("요양기간"),
    holidayBenefitPeriod: header.findIndex((h: unknown) => typeof h === "string" && h.includes("휴업급여")),
    paymentStatus:        header.indexOf("지급현황"),
  };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  const allDataRows = rows.slice(headerRowIdx + 1);
  const totalRows = allDataRows.length;

  for (const rawRow of allDataRows.slice(offset, offset + limit)) {
    const row = rawRow as unknown[];
    const name = normalizeName(row[C.name]);
    const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
    const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;
    if (!name || !ssn) continue;
    if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

    try {
      let patient = await prisma.patient.findFirst({ where: { ssn } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name, ssn, phone: strVal(row[C.phone]) },
        });
      }

      if (caseNumber) {
        const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "BEREAVED" } });
        if (existing) { skipped++; continue; }
      }

      const { status } = normalizeStatus(row[C.status]);
      const { disposalType } = parseDisposal(row[C.disposal]);

      const newCase = await prisma.case.create({
        data: {
          patientId:     patient.id,
          caseType:      "BEREAVED",
          caseNumber:    caseNumber ?? null,
          branch:        branchOverride ?? strVal(row[C.branch]),
          tfName:        tfName ?? null,
          subAgent:      strVal(row[C.subAgent]),
          salesManager:  strVal(row[C.salesManager]),
          caseManager:   strVal(row[C.caseManager]),
          salesRoute:    strVal(row[C.salesRoute]),
          contractDate:  toDate(row[C.contractDate]),
          receptionDate: toDate(row[C.receptionDate]),
          memo:          strVal(row[C.memo]),
        },
      });

      await prisma.bereavedDetail.create({
        data: {
          caseId:               newCase.id,
          status,
          diseaseName:          strVal(row[C.diseaseName]),
          firstDiagnosisDate:   toDate(row[C.firstDiagnosisDate]),
          lastWorkplace:        strVal(row[C.lastWorkplace]),
          disposalType,
          disposalDate:         toDate(row[C.disposalDate]),
          treatmentPeriod:      strVal(row[C.treatmentPeriod]),
          holidayBenefitPeriod: strVal(row[C.holidayBenefitPeriod]),
          paymentStatus:        strVal(row[C.paymentStatus]),
        },
      });

      created++;
    } catch (e) {
      errors.push(`${name}(${ssn}): ${(e as Error).message}`);
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), totalRows };
}

async function processMusculoskeletal(
  ws: XLSX.WorkSheet,
  tfName: string | null,
  branchOverride: string | null,
  offset: number,
  limit: number,
): Promise<SheetResult> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };

  const header = rows[headerRowIdx] as unknown[];

  const C = {
    caseNumber:            header.indexOf("연번"),
    name:                  header.indexOf("성명"),
    ssn:                   header.indexOf("주민번호"),
    phone:                 header.indexOf("연락처"),
    salesManager:          colIdx(header, "영업", "담당"),
    caseManager:           header.findIndex((h: unknown) => h === "접수자"),
    contractDate:          colIdx(header, "약정"),
    salesRoute:            colIdx(header, "영업", "경로"),
    branch:                header.indexOf("지사"),
    subAgent:              header.findIndex((h: unknown) => h === "대리인"),
    status:                header.indexOf("진행상황"),
    receptionDate:         header.findIndex((h: unknown) => h === "접수일" || h === "접수일자"),
    memo:                  header.findIndex((h: unknown) => typeof h === "string" && (h.includes("비고") || h.includes("불승인사유"))),
    bodyPart:              header.indexOf("부위"),
    diseaseName:           header.indexOf("상병명"),
    occupation:            header.indexOf("직종"),
    workHistory:           header.indexOf("직력"),
    expertType:            colIdx(header, "전문조사/지사조사"),
    expertRequestDate:     colIdx(header, "진찰요구서"),
    expertScheduleDate:    header.findIndex((h: unknown) => typeof h === "string" && h.includes("전문조사") && h.includes("일정")),
    hasMedicalCommittee:   header.findIndex((h: unknown) => h === "질판위"),
    committeeSubmitDate:   header.findIndex((h: unknown) => typeof h === "string" && (h.includes("질판위접수") || h.includes("질판위 접수"))),
    committeeReviewDate:   header.findIndex((h: unknown) => typeof h === "string" && (h.includes("질판위심의") || h.includes("질판위 심의"))),
    disposal:              header.indexOf("처분결과"),
    approvalDate:          header.findIndex((h: unknown) => typeof h === "string" && h.includes("요양") && h.includes("승인") && h.includes("일자")),
    disabilityApprovalDate: header.findIndex((h: unknown) => typeof h === "string" && h.includes("장해승인")),
    hospitalName:          header.indexOf("의료기관명"),
    managingBranch:        header.indexOf("요양관할지사"),
    treatmentStartDate:    header.indexOf("요양시작일"),
    treatmentEndDate:      header.indexOf("요양종결일"),
    claimCycle:            header.indexOf("청구주기"),
  };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  const allDataRows = rows.slice(headerRowIdx + 1);
  const totalRows = allDataRows.length;

  for (const rawRow of allDataRows.slice(offset, offset + limit)) {
    const row = rawRow as unknown[];
    const name = normalizeName(row[C.name]);
    const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
    const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;
    if (!name || !ssn) continue;
    if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

    try {
      let patient = await prisma.patient.findFirst({ where: { ssn } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name, ssn, phone: strVal(row[C.phone]) },
        });
      }

      if (caseNumber) {
        const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "MUSCULOSKELETAL" } });
        if (existing) { skipped++; continue; }
      }

      const { status } = normalizeStatus(row[C.status]);
      const { disposalType } = parseDisposal(row[C.disposal]);

      const newCase = await prisma.case.create({
        data: {
          patientId:     patient.id,
          caseType:      "MUSCULOSKELETAL",
          caseNumber:    caseNumber ?? null,
          branch:        branchOverride ?? strVal(row[C.branch]),
          tfName:        tfName ?? null,
          subAgent:      strVal(row[C.subAgent]),
          salesManager:  strVal(row[C.salesManager]),
          caseManager:   strVal(row[C.caseManager]),
          salesRoute:    strVal(row[C.salesRoute]),
          contractDate:  toDate(row[C.contractDate]),
          receptionDate: toDate(row[C.receptionDate]),
          memo:          strVal(row[C.memo]),
        },
      });

      await prisma.musculoskeletalDetail.create({
        data: {
          caseId:                 newCase.id,
          status,
          bodyPart:               strVal(row[C.bodyPart]),
          diseaseName:            strVal(row[C.diseaseName]),
          occupation:             strVal(row[C.occupation]),
          workHistory:            strVal(row[C.workHistory]),
          expertType:             strVal(row[C.expertType]),
          expertRequestDate:      toDate(row[C.expertRequestDate]),
          expertScheduleDate:     toDate(row[C.expertScheduleDate]),
          hasMedicalCommittee:    !!row[C.hasMedicalCommittee],
          committeeSubmitDate:    toDate(row[C.committeeSubmitDate]),
          committeeReviewDate:    toDate(row[C.committeeReviewDate]),
          disposalType,
          approvalDate:           toDate(row[C.approvalDate]),
          disabilityApprovalDate: toDate(row[C.disabilityApprovalDate]),
          hospitalName:           strVal(row[C.hospitalName]),
          managingBranch:         strVal(row[C.managingBranch]),
          treatmentStartDate:     toDate(row[C.treatmentStartDate]),
          treatmentEndDate:       toDate(row[C.treatmentEndDate]),
          claimCycle:             strVal(row[C.claimCycle]),
        },
      });

      created++;
    } catch (e) {
      errors.push(`${name}(${ssn}): ${(e as Error).message}`);
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), totalRows };
}

async function processOccupationalAccident(
  ws: XLSX.WorkSheet,
  tfName: string | null,
  branchOverride: string | null,
  offset: number,
  limit: number,
): Promise<SheetResult> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) return { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };

  const header = rows[headerRowIdx] as unknown[];

  const C = {
    caseNumber:            header.indexOf("연번"),
    name:                  header.indexOf("성명"),
    ssn:                   header.indexOf("주민번호"),
    phone:                 header.indexOf("연락처"),
    salesManager:          colIdx(header, "영업", "담당"),
    caseManager:           header.findIndex((h: unknown) => h === "접수자"),
    contractDate:          colIdx(header, "약정"),
    salesRoute:            colIdx(header, "영업", "경로"),
    branch:                header.indexOf("지사"),
    subAgent:              header.findIndex((h: unknown) => h === "대리인"),
    status:                header.indexOf("진행상황"),
    receptionDate:         header.findIndex((h: unknown) => h === "접수일" || h === "접수일자"),
    memo:                  header.findIndex((h: unknown) => typeof h === "string" && (h.includes("비고") || h.includes("불승인사유"))),
    caseName:              header.indexOf("사건명"),
    bodyPart:              header.indexOf("부위"),
    diseaseName:           header.indexOf("상병명"),
    occupation:            header.indexOf("직종"),
    workHistory:           header.indexOf("직력"),
    expertType:            colIdx(header, "전문조사/지사조사"),
    expertRequestDate:     colIdx(header, "진찰요구서"),
    expertScheduleDate:    header.findIndex((h: unknown) => typeof h === "string" && h.includes("전문조사") && h.includes("일정")),
    hasMedicalCommittee:   header.findIndex((h: unknown) => h === "질판위"),
    committeeSubmitDate:   header.findIndex((h: unknown) => typeof h === "string" && (h.includes("질판위접수") || h.includes("질판위 접수"))),
    committeeReviewDate:   header.findIndex((h: unknown) => typeof h === "string" && (h.includes("질판위심의") || h.includes("질판위 심의"))),
    disposal:              header.indexOf("처분결과"),
    approvalDate:          header.findIndex((h: unknown) => typeof h === "string" && h.includes("요양") && h.includes("승인") && h.includes("일자")),
    disabilityApprovalDate: header.findIndex((h: unknown) => typeof h === "string" && h.includes("장해승인")),
    hospitalName:          header.indexOf("의료기관명"),
    managingBranch:        header.indexOf("요양관할지사"),
    treatmentStartDate:    header.indexOf("요양시작일"),
    treatmentEndDate:      header.indexOf("요양종결일"),
    claimCycle:            header.indexOf("청구주기"),
  };

  let created = 0, skipped = 0;
  const errors: string[] = [];

  const allDataRows = rows.slice(headerRowIdx + 1);
  const totalRows = allDataRows.length;

  for (const rawRow of allDataRows.slice(offset, offset + limit)) {
    const row = rawRow as unknown[];
    const name = normalizeName(row[C.name]);
    const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
    const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;
    if (!name || !ssn) continue;
    if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

    try {
      let patient = await prisma.patient.findFirst({ where: { ssn } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name, ssn, phone: strVal(row[C.phone]) },
        });
      }

      if (caseNumber) {
        const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "OCCUPATIONAL_ACCIDENT" } });
        if (existing) { skipped++; continue; }
      }

      const { status } = normalizeStatus(row[C.status]);
      const { disposalType } = parseDisposal(row[C.disposal]);

      const newCase = await prisma.case.create({
        data: {
          patientId:     patient.id,
          caseType:      "OCCUPATIONAL_ACCIDENT",
          caseNumber:    caseNumber ?? null,
          branch:        branchOverride ?? strVal(row[C.branch]),
          tfName:        tfName ?? null,
          subAgent:      strVal(row[C.subAgent]),
          salesManager:  strVal(row[C.salesManager]),
          caseManager:   strVal(row[C.caseManager]),
          salesRoute:    strVal(row[C.salesRoute]),
          contractDate:  toDate(row[C.contractDate]),
          receptionDate: toDate(row[C.receptionDate]),
          memo:          strVal(row[C.memo]),
        },
      });

      await prisma.occupationalAccidentDetail.create({
        data: {
          caseId:                 newCase.id,
          status,
          caseName:               strVal(row[C.caseName]),
          bodyPart:               strVal(row[C.bodyPart]),
          diseaseName:            strVal(row[C.diseaseName]),
          occupation:             strVal(row[C.occupation]),
          workHistory:            strVal(row[C.workHistory]),
          expertType:             strVal(row[C.expertType]),
          expertRequestDate:      toDate(row[C.expertRequestDate]),
          expertScheduleDate:     toDate(row[C.expertScheduleDate]),
          hasMedicalCommittee:    !!row[C.hasMedicalCommittee],
          committeeSubmitDate:    toDate(row[C.committeeSubmitDate]),
          committeeReviewDate:    toDate(row[C.committeeReviewDate]),
          disposalType,
          approvalDate:           toDate(row[C.approvalDate]),
          disabilityApprovalDate: toDate(row[C.disabilityApprovalDate]),
          hospitalName:           strVal(row[C.hospitalName]),
          managingBranch:         strVal(row[C.managingBranch]),
          treatmentStartDate:     toDate(row[C.treatmentStartDate]),
          treatmentEndDate:       toDate(row[C.treatmentEndDate]),
          claimCycle:             strVal(row[C.claimCycle]),
        },
      });

      created++;
    } catch (e) {
      errors.push(`${name}(${ssn}): ${(e as Error).message}`);
    }
  }

  return { created, skipped, errors: errors.slice(0, 20), totalRows };
}

// ---- Sheet → caseType 매핑 ----

const SHEET_MATCHERS: Array<{
  match: (name: string) => boolean;
  caseType: string;
  process: (ws: XLSX.WorkSheet, tfName: string | null, branch: string | null, offset: number, limit: number) => Promise<SheetResult>;
}> = [
  {
    match: (n) => n.includes("소음성난청") || n.includes("소음성 난청"),
    caseType: "HEARING_LOSS",
    process: processHearingLoss,
  },
  {
    match: (n) => n.includes("진폐"),
    caseType: "PNEUMOCONIOSIS",
    process: processPneumoconiosis,
  },
  {
    match: (n) => n.toUpperCase().includes("COPD"),
    caseType: "COPD",
    process: processCopd,
  },
  {
    match: (n) => n.includes("직업성 암") || n.includes("직업성암"),
    caseType: "OCCUPATIONAL_CANCER",
    process: processOccupationalCancer,
  },
  {
    match: (n) => n.includes("유족"),
    caseType: "BEREAVED",
    process: processBereaved,
  },
  {
    match: (n) => n.includes("근골격계"),
    caseType: "MUSCULOSKELETAL",
    process: processMusculoskeletal,
  },
  {
    match: (n) => n.includes("업무상 사고") || n.includes("업무상사고"),
    caseType: "OCCUPATIONAL_ACCIDENT",
    process: processOccupationalAccident,
  },
];

// ---- POST handler ----

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일 없음" }, { status: 400 });

    const tfName = formData.get("tfName") as string | null;
    const branch = formData.get("branch") as string | null;
    const targetSheet = formData.get("sheetName") as string | null;
    const offset = parseInt((formData.get("offset") as string) ?? "0") || 0;
    const limit  = parseInt((formData.get("limit")  as string) ?? "100") || 100;

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // 특정 시트만 처리
    if (targetSheet) {
      const matcher = SHEET_MATCHERS.find((m) => m.match(targetSheet));
      if (!matcher) return NextResponse.json({ error: `알 수 없는 시트: ${targetSheet}` }, { status: 400 });
      const ws = wb.Sheets[targetSheet];
      if (!ws) return NextResponse.json({ error: `시트를 찾을 수 없음: ${targetSheet}` }, { status: 400 });
      const result = await matcher.process(ws, tfName, branch, offset, limit);
      return NextResponse.json({ success: true, caseType: matcher.caseType, result });
    }

    // sheetName 없으면 전체 처리 (fallback)
    const results: Record<string, SheetResult> = {};
    for (const sheetName of wb.SheetNames) {
      const matcher = SHEET_MATCHERS.find((m) => m.match(sheetName));
      if (!matcher) continue;
      const ws = wb.Sheets[sheetName];
      const result = await matcher.process(ws, tfName, branch, 0, 999999);
      results[matcher.caseType] = result;
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[POST /api/import/all]", err);
    return NextResponse.json({ error: "임포트 오류" }, { status: 500 });
  }
}
