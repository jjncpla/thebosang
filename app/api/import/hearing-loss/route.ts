import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

// 클라이언트가 cellDates:true로 파싱 → Date → ISO 문자열로 전달됨
function toDate(val: unknown): Date | null {
  if (!val) return null;
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

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch (err) {
      console.error("[POST /api/import/hearing-loss] JSON parse error. Raw body (first 500):", rawText.slice(0, 500));
      return NextResponse.json({ error: "JSON 파싱 오류: " + String(err) }, { status: 400 });
    }

    const { tfName, branch, header, prevHeader = [], rows } = body as {
      tfName: string | null;
      branch: string | null;
      header: unknown[];
      prevHeader: unknown[];
      rows: unknown[][];
    };

    if (!header || !rows) {
      return NextResponse.json({ error: "header, rows 필드 필요" }, { status: 400 });
    }

    // 최초특진 그룹 기준 exam1Date 컬럼 찾기
    let exam1DateCol = -1;
    const firstSpecialGroupStart = prevHeader.findIndex(h => h && String(h).includes("최초 특진"));
    if (firstSpecialGroupStart !== -1) {
      for (let i = firstSpecialGroupStart; i < header.length; i++) {
        if (header[i] === "1차 특진") { exam1DateCol = i; break; }
      }
    }

    const C = {
      caseNumber:     header.indexOf("연번"),
      name:           header.indexOf("성명"),
      ssn:            header.indexOf("주민번호"),
      phone:          header.indexOf("연락처"),
      salesManager:   colIdx(header, "영업", "담당"),
      caseManager:    colIdx(header, "접수", "담당"),
      contractDate:   colIdx(header, "약정"),
      salesRoute:     colIdx(header, "영업", "경로"),
      branch:         header.indexOf("지사"),
      subAgent:       colIdx(header, "소속"),
      isOneStop:      header.indexOf("원스톱"),
      status:         header.indexOf("진행상황"),
      receptionDate:  header.indexOf("접수일자"),
      memo:           header.indexOf("비고"),
      firstClinic:    header.indexOf("초진병원"),
      firstExamDate:  colIdx(header, "1차 초진"),
      firstExamRight: header.indexOf("우측"),
      firstExamLeft:  header.indexOf("좌측"),
      specialClinic:  header.indexOf("특진병원"),
      exam1Date:      exam1DateCol,
      reExamClinic:   header.indexOf("재특진병원"),
      expertOrg:      header.indexOf("전문조사기관"),
      expertDate:     colIdx(header, "전문조사", "일정"),
      disposal:       header.indexOf("처분결과"),
      disposalDate:   header.indexOf("처분일자"),
    };

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rawRow of rows) {
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

        // caseNumber 필드 제거됨 — ssn+caseType 기준으로 중복 체크
        const existingByPatient = await prisma.case.findFirst({ where: { patientId: patient.id, caseType: "HEARING_LOSS" } });
        if (existingByPatient) { skipped++; continue; }

        const { isDisabilityRegistered } = normalizeStatus(row[C.status]);

        const newCase = await prisma.case.create({
          data: {
            patientId:     patient.id,
            caseType:      "HEARING_LOSS",
            branch:        branch ?? strVal(row[C.branch]),
            tfName:        tfName ?? null,
            subAgent:      strVal(row[C.subAgent]),
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
            isDisabilityRegistered,
            firstClinic:           strVal(row[C.firstClinic]),
            firstExamDate:         toDate(row[C.firstExamDate]),
            firstExamRight:        row[C.firstExamRight] ? parseFloat(String(row[C.firstExamRight])) || null : null,
            firstExamLeft:         row[C.firstExamLeft]  ? parseFloat(String(row[C.firstExamLeft]))  || null : null,
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
