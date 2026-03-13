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

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// "YYYY-MM-DD ~ YYYY-MM-DD" 형태에서 시작일만 추출
function parseRangeStartDate(val: unknown): Date | null {
  if (!val) return null;
  const s = String(val).trim();
  const match = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) return d;
  }
  return toDate(val);
}

function parsePneumoDisposal(status: string): string | null {
  if (status === "승인") return "승인";
  if (status === "불승인" || status === "수치미달") return "불승인";
  if (status === "반려") return "반려";
  return null;
}

// 고정 컬럼 인덱스 (0-based)
const C = {
  caseNumber:           1,
  name:                 2,
  ssn:                  3,
  phone:                4,
  salesRoute:           5,
  salesManager:         6,
  contractDate:         7,
  caseManager:          8,
  branch:               9,
  subAgent:             10,
  // col[11] 미사용
  isNoticeReceived:     12,
  status:               13,
  receptionDate:        14,
  firstClinic:          15,
  firstExamDate:        16,
  precisionExamDate:    17,
  precisionResult:      18,
  precisionHospital:    19,
  precisionPossibleDate: 20,
  reExamPossibleDate:   21,
  memo:                 22,
} as const;

// ---- POST handler ----

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch (err) {
      console.error("[POST /api/import/pneumoconiosis] JSON parse error. Raw body (first 500):", rawText.slice(0, 500));
      return NextResponse.json({ error: "JSON 파싱 오류: " + String(err) }, { status: 400 });
    }

    const { tfName, branch, rows } = body as {
      tfName: string | null;
      branch: string | null;
      rows: (string | null)[][];
    };

    if (!rows) return NextResponse.json({ error: "rows 필드 필요" }, { status: 400 });

    const today = new Date();
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
          const existing = await prisma.case.findFirst({ where: { caseNumber, caseType: "PNEUMOCONIOSIS" } });
          if (existing) { skipped++; continue; }
        }

        const rawStatus = strVal(row[C.status]) ?? "접수대기";
        const isNoticeReceived = strVal(row[C.isNoticeReceived]) === "수신완료";
        const reExamPossibleDate = parseRangeStartDate(row[C.reExamPossibleDate]);
        const disposalType = parsePneumoDisposal(rawStatus);

        // 수치미달 + reExamPossibleDate <= today 이면 재진행가능
        let status = rawStatus;
        if (
          status === "수치미달" &&
          reExamPossibleDate != null &&
          reExamPossibleDate <= today
        ) {
          status = "재진행가능";
        }

        const newCase = await prisma.case.create({
          data: {
            patientId:     patient.id,
            caseType:      "PNEUMOCONIOSIS",
            caseNumber:    caseNumber ?? null,
            branch:        branch ?? strVal(row[C.branch]),
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
            isNoticeReceived,
            precisionExamDate:    parseRangeStartDate(row[C.precisionExamDate]),
            precisionResult:      strVal(row[C.precisionResult]),
            precisionHospital:    strVal(row[C.precisionHospital]),
            precisionPossibleDate: parseRangeStartDate(row[C.precisionPossibleDate]),
            reExamPossibleDate,
            disposalType,
            disposalDate:         null,
          },
        });

        created++;
      } catch (e) {
        errors.push(`${name}(${ssn}): ${(e as Error).message}`);
      }
    }

    return NextResponse.json({ success: true, created, skipped, errors: errors.slice(0, 20) });
  } catch (err) {
    console.error("[POST /api/import/pneumoconiosis]", err);
    return NextResponse.json({ error: "임포트 오류" }, { status: 500 });
  }
}
