import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일 없음" }, { status: 400 });

    const tfName = formData.get("tfName") as string | null;
    const branch = formData.get("branch") as string | null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheetName = wb.SheetNames.find(n => n.includes("소음성난청") || n.includes("소음성 난청"));
    if (!sheetName) return NextResponse.json({ error: "소음성난청 시트를 찾을 수 없습니다" }, { status: 400 });

    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // 헤더 행 찾기
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      if ((rows[i] as unknown[]).some(c => c === "연번" || c === "성명")) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) return NextResponse.json({ error: "헤더 행을 찾을 수 없습니다" }, { status: 400 });

    const header = rows[headerRowIdx] as unknown[];
    const prevHeader = headerRowIdx > 0 ? rows[headerRowIdx - 1] as unknown[] : [];

    // 최초특진 그룹 기준 exam1Date 컬럼 찾기
    let exam1DateCol = -1;
    const firstSpecialGroupStart = prevHeader.findIndex(h => h && String(h).includes("최초 특진"));
    if (firstSpecialGroupStart !== -1) {
      for (let i = firstSpecialGroupStart; i < header.length; i++) {
        if (header[i] === "1차 특진") { exam1DateCol = i; break; }
      }
    }

    const C = {
      caseNumber:   header.indexOf("연번"),
      name:         header.indexOf("성명"),
      ssn:          header.indexOf("주민번호"),
      phone:        header.indexOf("연락처"),
      salesManager: colIdx(header, "영업", "담당"),
      caseManager:  colIdx(header, "접수", "담당"),
      contractDate: colIdx(header, "약정"),
      salesRoute:   colIdx(header, "영업 경로"),
      branch:       header.indexOf("지사"),
      subAgent:     colIdx(header, "소속"),
      isOneStop:    header.indexOf("원스톱"),
      status:       header.indexOf("진행상황"),
      receptionDate: header.indexOf("접수일자"),
      memo:         header.indexOf("비고"),
      firstClinic:  header.indexOf("초진병원"),
      firstExamDate: colIdx(header, "1차 초진"),
      firstExamRight: header.indexOf("우측"),
      firstExamLeft:  header.indexOf("좌측"),
      specialClinic: header.indexOf("특진병원"),
      exam1Date:    exam1DateCol,
      reExamClinic: header.indexOf("재특진병원"),
      expertOrg:    header.indexOf("전문조사기관"),
      expertDate:   colIdx(header, "전문조사 일정"),
      disposal:     header.indexOf("처분결과"),
      disposalDate: header.indexOf("처분일자"),
    };

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rawRow of rows.slice(headerRowIdx + 1)) {
      const row = rawRow as unknown[];
      const name = normalizeName(row[C.name]);
      const ssn = row[C.ssn] ? String(row[C.ssn]).trim() : null;
      const caseNumber = row[C.caseNumber] ? String(row[C.caseNumber]).trim() : null;

      if (!name || !ssn) continue;
      if (ssn.startsWith("=") || ssn.startsWith("#")) continue;

      try {
        // Patient upsert (주민번호 기준)
        let patient = await prisma.patient.findFirst({ where: { ssn } });
        if (!patient) {
          patient = await prisma.patient.create({
            data: {
              name,
              ssn,
              phone: row[C.phone] ? String(row[C.phone]).trim() : null,
            },
          });
        }

        // Case 중복 체크 (caseNumber 기준)
        if (caseNumber) {
          const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "HEARING_LOSS" } });
          if (existing) { skipped++; continue; }
        }

        const { status, isDisabilityRegistered } = normalizeStatus(row[C.status]);
        const { disposalType, gradeType, grade } = parseDisposal(row[C.disposal]);

        const newCase = await prisma.case.create({
          data: {
            patientId: patient.id,
            caseType: "HEARING_LOSS",
            caseNumber: caseNumber ?? null,
            branch: branch ?? (row[C.branch] ? String(row[C.branch]).trim() : null),
            tfName: tfName ?? null,
            subAgent: row[C.subAgent] ? String(row[C.subAgent]).trim() : null,
            salesManager: row[C.salesManager] ? String(row[C.salesManager]).trim() : null,
            caseManager: row[C.caseManager] ? String(row[C.caseManager]).trim() : null,
            salesRoute: row[C.salesRoute] ? String(row[C.salesRoute]).trim() : null,
            contractDate: toDate(row[C.contractDate]),
            receptionDate: toDate(row[C.receptionDate]),
            isOneStop: row[C.isOneStop] === true || row[C.isOneStop] === "O" || row[C.isOneStop] === "o",
            memo: row[C.memo] ? String(row[C.memo]).trim() : null,
          },
        });

        await prisma.hearingLossDetail.create({
          data: {
            caseId: newCase.id,
            status,
            isDisabilityRegistered,
            firstClinic: row[C.firstClinic] ? String(row[C.firstClinic]).trim() : null,
            firstExamDate: toDate(row[C.firstExamDate]),
            firstExamRight: row[C.firstExamRight] ? parseFloat(String(row[C.firstExamRight])) || null : null,
            firstExamLeft: row[C.firstExamLeft] ? parseFloat(String(row[C.firstExamLeft])) || null : null,
            specialClinic: row[C.specialClinic] ? String(row[C.specialClinic]).trim() : null,
            exam1Date: C.exam1Date !== -1 ? toDate(row[C.exam1Date]) : null,
            reExamClinic: row[C.reExamClinic] ? String(row[C.reExamClinic]).trim() : null,
            expertOrg: row[C.expertOrg] ? String(row[C.expertOrg]).trim() : null,
            expertDate: toDate(row[C.expertDate]),
            disposalType,
            gradeType,
            grade,
            disposalDecidedAt: toDate(row[C.disposalDate]),
          },
        });

        created++;
      } catch (e) {
        errors.push(`${name}(${ssn}): ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ success: true, created, skipped, errors: errors.slice(0, 20) });
  } catch (err) {
    console.error("[POST /api/import/hearing-loss]", err);
    return NextResponse.json({ error: "임포트 오류" }, { status: 500 });
  }
}
