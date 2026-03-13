import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---- Helpers ----

function normalizeName(val: unknown): string {
  if (!val) return "";
  return String(val).replace(/\d+$/, "").trim();
}

function strVal(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

// 클라이언트가 cellDates:true로 파싱 → ISO 문자열로 전달됨
function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function normalizeCopdStatus(val: unknown): string {
  if (!val) return "접수대기";
  return String(val).trim() || "접수대기";
}

function parseCopdDisposal(val: unknown): string | null {
  if (!val) return null;
  const v = String(val).trim();
  if (v.includes("부지급")) return "불승인";
  if (v.includes("승인")) return "승인";
  if (/\d+급/.test(v)) return "승인";
  return null;
}

function parseCopdDisposalDate(val: unknown): Date | null {
  if (!val) return null;
  const v = String(val).trim();
  const m = v.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(m[1]);
  return isNaN(d.getTime()) ? null : d;
}

function parseExamResult(val: unknown): {
  exam1Rate: number | null;
  exam1Volume: number | null;
  exam2Rate: number | null;
  exam2Volume: number | null;
  examMemo: string | null;
} {
  const empty = { exam1Rate: null, exam1Volume: null, exam2Rate: null, exam2Volume: null, examMemo: null };
  if (!val) return empty;

  const text = String(val);
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  let exam1Rate: number | null = null;
  let exam1Volume: number | null = null;
  let exam2Rate: number | null = null;
  let exam2Volume: number | null = null;
  const memos: string[] = [];

  for (const line of lines) {
    const rateMatch = line.match(/율\s*(\d+(?:\.\d+)?)/);
    const volumeMatch = line.match(/량\s*(\d+(?:\.\d+)?)/);
    const memoMatch = line.match(/특이사항\s*[:：]\s*(.+)/);
    const isReExam = line.includes("(재)") || line.includes("재)");

    if (rateMatch || volumeMatch) {
      if (isReExam) {
        if (rateMatch && exam2Rate === null) exam2Rate = parseFloat(rateMatch[1]);
        if (volumeMatch && exam2Volume === null) exam2Volume = parseFloat(volumeMatch[1]);
      } else {
        if (rateMatch && exam1Rate === null) exam1Rate = parseFloat(rateMatch[1]);
        if (volumeMatch && exam1Volume === null) exam1Volume = parseFloat(volumeMatch[1]);
      }
    }
    if (memoMatch) memos.push(memoMatch[1].trim());
  }

  return {
    exam1Rate,
    exam1Volume,
    exam2Rate,
    exam2Volume,
    examMemo: memos.length > 0 ? memos.join(" / ") : null,
  };
}

function calcReExamPossibleDate(
  status: string,
  exam1Date: Date | null,
  exam2Date: Date | null,
): Date | null {
  if (status !== "수치미달") return null;
  const lastExamDate = exam2Date ?? exam1Date;
  if (!lastExamDate) return null;
  const d = new Date(lastExamDate);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

// 고정 컬럼 인덱스 (0-based)
const C = {
  caseNumber:   2,
  name:         3,
  ssn:          4,
  phone:        5,
  salesManager: 6,
  salesRoute:   7,
  contractDate: 8,
  caseManager:  9,
  branch:       10,
  subAgent:     11,
  status:       13,
  receptionDate: 14,
  isOneStop:    15,
  disposal:     16,
  firstClinic:  19,
  firstExamDate: 20,
  specialClinic: 21,
  exam1Date:    22,
  exam2Date:    23,
  examResult:   24,
  expertOrgDate: 25,
  memo:         28,
} as const;

// ---- POST handler ----

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch (err) {
      console.error("[POST /api/import/copd] JSON parse error. Raw body (first 500):", rawText.slice(0, 500));
      return NextResponse.json({ error: "JSON 파싱 오류: " + String(err) }, { status: 400 });
    }

    const { tfName, branch, rows } = body as {
      tfName: string | null;
      branch: string | null;
      rows: (string | null)[][];
    };

    if (!rows) return NextResponse.json({ error: "rows 필드 필요" }, { status: 400 });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
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

        const status = normalizeCopdStatus(row[C.status]);
        const disposalType = parseCopdDisposal(row[C.disposal]);
        const disposalDate = parseCopdDisposalDate(row[C.disposal]);
        const exam1Date = toDate(row[C.exam1Date]);
        const exam2Date = toDate(row[C.exam2Date]);
        const { exam1Rate, exam1Volume, exam2Rate, exam2Volume, examMemo } = parseExamResult(row[C.examResult]);
        const reExamPossibleDate = calcReExamPossibleDate(status, exam1Date, exam2Date);

        const newCase = await prisma.case.create({
          data: {
            patientId:     patient.id,
            caseType:      "COPD",
            caseNumber:    caseNumber ?? null,
            branch:        branch ?? strVal(row[C.branch]),
            tfName:        tfName ?? null,
            subAgent:      strVal(row[C.subAgent]),
            salesManager:  strVal(row[C.salesManager]),
            caseManager:   strVal(row[C.caseManager]),
            salesRoute:    strVal(row[C.salesRoute]),
            contractDate:  toDate(row[C.contractDate]),
            receptionDate: toDate(row[C.receptionDate]),
            isOneStop:     row[C.isOneStop] === "O" || row[C.isOneStop] === "o",
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
            exam1Date,
            exam1Rate,
            exam1Volume,
            exam2Date,
            exam2Rate,
            exam2Volume,
            examMemo,
            expertOrgDate:     toDate(row[C.expertOrgDate]),
            disposalType,
            disposalDate,
            reExamPossibleDate,
          },
        });

        created++;
      } catch (e) {
        errors.push(`${name}(${ssn}): ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ success: true, created, skipped, errors: errors.slice(0, 20) });
  } catch (err) {
    console.error("[POST /api/import/copd]", err);
    return NextResponse.json({ error: "임포트 오류" }, { status: 500 });
  }
}
