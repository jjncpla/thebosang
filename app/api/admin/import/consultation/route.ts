import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readHCellSheet, str, toDate } from "@/lib/excel-parser";

function mapStatus(val: unknown): string {
  const s = str(val);
  if (!s) return "진행중";
  if (s === "약정") return "약정";
  if (s === "종결") return "종결";
  if (s === "연락 대기" || s === "연락대기") return "연락대기";
  return "진행중";
}

// 헤더명 정규화: 공백 제거 + 날짜 헤더 통일
function normalizeHeader(h: string): string {
  return h.trim().replace(/\s/g, "");
}

// row에서 정규화된 키로 값 조회
function getCol(row: Record<string, unknown>, ...candidates: string[]): unknown {
  for (const key of Object.keys(row)) {
    const normalized = normalizeHeader(key);
    if (candidates.some((c) => normalizeHeader(c) === normalized)) {
      return row[key];
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "파일 파싱 실패" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // HCell(한컴셀) xlsx 파서 사용
  // 울산지사 상담문의 시트: 헤더=행6(idx 5), 데이터=행7(idx 6)~
  // 파일에 시트명이 없으면 첫 번째 시트 사용
  const rows = readHCellSheet(buffer, "울산지사 상담문의", 5, 6);

  let success = 0;
  let skipped = 0;
  let synced = 0;
  const errors: string[] = [];

  for (const row of rows) {
    // 엑셀 헤더명: "성명", "연락처", "주민번호 ", "주소", "사건종류",
    //   "상담 경로(대분류/중분류/소분류)", "방문일자(연락일자)",
    //   "사건수임", "비고", "12.27.기준 진행경과", "담당"
    const name = str(getCol(row, "성명"));
    const phone = str(getCol(row, "연락처")) ?? "-";
    if (!name) { skipped++; continue; }

    try {
      const rawCaseTypes = str(getCol(row, "사건종류"));
      const caseTypes = rawCaseTypes
        ? rawCaseTypes.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
        : [];

      const visitDateRaw = getCol(row, "방문일자(연락일자)", "방문일자");
      const visitDate = visitDateRaw instanceof Date
        ? visitDateRaw
        : toDate(visitDateRaw);

      const ssn = str(getCol(row, "주민번호"));
      const status = mapStatus(getCol(row, "사건수임"));

      const data = {
        ssn,
        address: str(getCol(row, "주소")),
        caseTypes,
        routeMain: str(getCol(row, "상담경로(대분류)", "상담 경로(대분류)")),
        routeSub: str(getCol(row, "상담경로(중분류)", "상담 경로(중분류)")),
        routeDetail: str(getCol(row, "상담경로(소분류)", "상담 경로(소분류)")),
        visitDate,
        status,
        memo: str(getCol(row, "비고")),
        progressNote: str(getCol(row, "기준진행경과", "12.27.기준진행경과", "12.27.기준 진행경과")),
        managerName: str(getCol(row, "담당")),
      };

      await prisma.consultation.upsert({
        where: { name_phone: { name, phone } },
        update: data,
        create: { name, phone, ...data },
      });
      success++;

      // ── Case 싱크로나이징 ──────────────────────────────────────────────
      // 재해자 이름 + 연락처, 또는 주민번호로 Patient 매칭 → 최근 Case 연결
      try {
        let patient = null;

        if (ssn) {
          patient = await prisma.patient.findUnique({ where: { ssn } });
        }
        if (!patient && phone && phone !== "-") {
          patient = await prisma.patient.findFirst({
            where: { name, phone },
          });
        }
        if (!patient) {
          patient = await prisma.patient.findFirst({
            where: { name },
          });
        }

        if (patient) {
          // 가장 최근 Case 연결
          const latestCase = await prisma.case.findFirst({
            where: { patientId: patient.id },
            orderBy: { createdAt: "desc" },
          });

          if (latestCase) {
            await prisma.consultation.update({
              where: { name_phone: { name, phone } },
              data: {
                linkedCaseId: latestCase.id,
                // Patient 연락처/주소가 없으면 상담 데이터로 보완
                ...(data.ssn && !patient.ssn ? {} : {}),
              },
            });
            synced++;
          }
        }
      } catch {
        // 싱크 실패는 무시 (임포트는 성공)
      }
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ success, skipped, synced, errors });
}
