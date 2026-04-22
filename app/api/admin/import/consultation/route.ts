import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readConsultationSheet, str, toDate } from "@/lib/excel-parser";

function mapStatus(val: unknown): string {
  const s = str(val);
  if (!s) return "진행중";
  if (s === "약정") return "약정";
  if (s === "종결") return "종결";
  if (s === "연락 대기" || s === "연락대기") return "연락대기";
  return "진행중";
}

// 공백·괄호 등을 제거한 정규화 키
function nk(h: string): string {
  return h.trim().replace(/\s/g, "").replace(/[()（）]/g, "");
}

// row에서 후보 컬럼명 중 하나라도 매칭되면 반환
function getCol(row: Record<string, unknown>, ...candidates: string[]): unknown {
  const normalizedCandidates = candidates.map(nk);
  for (const key of Object.keys(row)) {
    if (normalizedCandidates.includes(nk(key))) return row[key];
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

  // 자동 감지: 헤더 행 위치·파일 형식(HCell/일반) 자동 탐지
  // 시트 힌트: 울산지사 파일이면 해당 시트를 우선 사용, 아니면 첫 번째 시트
  const rows = readConsultationSheet(buffer, ["울산지사 상담문의", "복지관 상담문의"]);

  let success = 0;
  let skipped = 0;
  let synced = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(getCol(row, "성명"));
    const phone = str(getCol(row, "연락처")) ?? "-";
    if (!name) { skipped++; continue; }

    try {
      const rawCaseTypes = str(getCol(row, "사건종류"));
      const caseTypes = rawCaseTypes
        ? rawCaseTypes.split(/[,，、\/]/).map((s) => s.trim()).filter(Boolean)
        : [];

      // 날짜: '방문일자(연락일자)', '방문일자', '상담일자' 모두 허용
      const visitDateRaw = getCol(row, "방문일자(연락일자)", "방문일자", "상담일자");
      const visitDate = visitDateRaw instanceof Date
        ? visitDateRaw
        : toDate(visitDateRaw);

      const ssn = str(getCol(row, "주민번호"));
      const status = mapStatus(getCol(row, "사건수임"));

      const data = {
        ssn,
        address: str(getCol(row, "주소")),
        caseTypes,
        // 상담 경로: 대분류 없으면 단일 '상담 경로' 컬럼을 대분류로 사용
        routeMain: str(
          getCol(row, "상담경로(대분류)", "상담 경로(대분류)") ??
          getCol(row, "상담경로", "상담 경로")
        ),
        routeSub: str(getCol(row, "상담경로(중분류)", "상담 경로(중분류)")),
        routeDetail: str(getCol(row, "상담경로(소분류)", "상담 경로(소분류)")),
        visitDate,
        status,
        // 비고: '비고', '상담내용' 모두 허용
        memo: str(getCol(row, "비고", "상담내용", "상담내용(비고)")),
        // 기준진행경과: '기준진행경과', '12.27.기준 진행경과', '비고(매월마지막주갱신)' 허용
        progressNote: str(
          getCol(row, "기준진행경과", "12.27.기준진행경과", "12.27.기준 진행경과") ??
          getCol(row, "비고(매월마지막주갱신)", "비고 (매 월 마지막주 갱신)")
        ),
        // 담당: '담당', '담당자' 모두 허용
        managerName: str(getCol(row, "담당", "담당자")),
      };

      await prisma.consultation.upsert({
        where: { name_phone: { name, phone } },
        update: data,
        create: { name, phone, ...data },
      });
      success++;

      // ── Case 싱크로나이징 ──────────────────────────────────────────────
      try {
        let patient = null;
        if (ssn) {
          patient = await prisma.patient.findUnique({ where: { ssn } });
        }
        if (!patient && phone && phone !== "-") {
          patient = await prisma.patient.findFirst({ where: { name, phone } });
        }
        if (!patient) {
          patient = await prisma.patient.findFirst({ where: { name } });
        }
        if (patient) {
          const latestCase = await prisma.case.findFirst({
            where: { patientId: patient.id },
            orderBy: { createdAt: "desc" },
          });
          if (latestCase) {
            await prisma.consultation.update({
              where: { name_phone: { name, phone } },
              data: { linkedCaseId: latestCase.id },
            });
            synced++;
          }
        }
      } catch {
        // 싱크 실패는 무시
      }
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ success, skipped, synced, errors });
}
