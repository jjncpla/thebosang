import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCopdCaseStatus, syncCopdCaseEvents } from "@/lib/copd-status";
import { syncFromCopdDecision } from "@/lib/case-sync";

const parseDate = (v: unknown) => (v ? new Date(v as string) : null);
const parseNumber = (v: unknown) =>
  v !== undefined && v !== null && v !== "" ? Number(v) : null;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string; appId: string }> }
) {
  const { appId } = await params;
  try {
    const app = await prisma.copdApplication.findUnique({ where: { id: appId } });
    if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(app);
  } catch (err) {
    console.error("[GET copd/applications/:id]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; appId: string }> }
) {
  const { caseId, appId } = await params;
  try {
    const body = await req.json();

    const data = {
      // 요양급여
      applicationDate: parseDate(body.applicationDate),
      applicationNote: body.applicationNote ?? null,
      examRequestReceivedAt: parseDate(body.examRequestReceivedAt),
      // 1차 특진
      exam1Hospital: body.exam1Hospital ?? null,
      exam1Date: parseDate(body.exam1Date),
      exam1Fev1Rate: parseNumber(body.exam1Fev1Rate),
      exam1Fev1Volume: parseNumber(body.exam1Fev1Volume),
      exam1Note: body.exam1Note ?? null,
      exam1Attendee: body.exam1Attendee ?? null,
      exam1Pickup: typeof body.exam1Pickup === "boolean" ? body.exam1Pickup : null,
      // 2차 특진
      exam2Hospital: body.exam2Hospital ?? null,
      exam2Date: parseDate(body.exam2Date),
      exam2Fev1Rate: parseNumber(body.exam2Fev1Rate),
      exam2Fev1Volume: parseNumber(body.exam2Fev1Volume),
      exam2Note: body.exam2Note ?? null,
      exam2Skipped: !!body.exam2Skipped,
      exam2Attendee: body.exam2Attendee ?? null,
      exam2Pickup: typeof body.exam2Pickup === "boolean" ? body.exam2Pickup : null,
      examResult: body.examResult ?? null,
      // 직업환경연구원
      expertOrgRequestDate: parseDate(body.expertOrgRequestDate),
      expertOrgMeetingDate: parseDate(body.expertOrgMeetingDate),
      expertOrgResult: body.expertOrgResult ?? null,
      expertOrgMemo: body.expertOrgMemo ?? null,
      // 질판위
      occCommitteeName: body.occCommitteeName ?? null,
      occReferralDate: parseDate(body.occReferralDate),
      occReviewDate: parseDate(body.occReviewDate),
      occAttendanceType: body.occAttendanceType ?? null,
      occAttendanceNote: body.occAttendanceNote ?? null,
      occResult: body.occResult ?? null,
      // 처분
      disposalType: body.disposalType ?? null,
      disposalDate: parseDate(body.disposalDate),
      disposalNoticeReceivedAt: parseDate(body.disposalNoticeReceivedAt),
      disposalReason: body.disposalReason ?? null,
      // 재진행
      reExamPossibleDate: parseDate(body.reExamPossibleDate),
      // 장해
      disabilityClaimDate: parseDate(body.disabilityClaimDate),
      disabilityGradeType: body.disabilityGradeType ?? null,
      disabilityDispositionType: body.disabilityDispositionType ?? null,
      disabilityDispositionGrade: body.disabilityDispositionGrade ?? null,
      disabilityDispositionDate: parseDate(body.disabilityDispositionDate),
      disabilityDispositionNoticeDate: parseDate(body.disabilityDispositionNoticeDate),
      memo: body.memo ?? null,
    };

    // 재진행 가능일 자동 계산: 마지막 특진일(2차 우선, 없으면 1차) + 1년
    // UTC 기준으로 처리 — KST/UTC 경계 자정 부근 입력에서 1일 어긋남 방지
    // (윤년: 2024-02-29 → 2025-03-01로 자동 조정. Date 표준 동작)
    if (!data.reExamPossibleDate && data.examResult === "수치미달") {
      const lastExam = data.exam2Date ?? data.exam1Date;
      if (lastExam) {
        const d = new Date(lastExam);
        d.setUTCFullYear(d.getUTCFullYear() + 1);
        data.reExamPossibleDate = d;
      }
    }

    const updated = await prisma.copdApplication.update({
      where: { id: appId },
      data,
    });

    // D2: 처분일 입력 + 수령일 빈칸 시 Todo 자동 생성 (자동 추정 X — 천차만별)
    if (data.disposalType && data.disposalDate && !data.disposalNoticeReceivedAt) {
      try {
        const c = await prisma.case.findUnique({
          where: { id: caseId },
          select: { caseManagerId: true, patient: { select: { name: true } } },
        });
        const memoTag = `[COPD_R${updated.applicationRound}_NOTICE_TODO]`;
        const exists = await prisma.todo.findFirst({
          where: { caseId, memo: { contains: memoTag } },
        });
        if (!exists) {
          await prisma.todo.create({
            data: {
              title: `[수령일 입력] ${c?.patient?.name ?? ""} R${updated.applicationRound} 결정통지 수령일 — 90일 이의제기 D-day 정확화 필요`,
              type: "COPD_NOTICE_RECEIVED",
              caseId,
              patientName: c?.patient?.name ?? null,
              assignedTo: c?.caseManagerId ?? null,
              isDone: false,
              memo: `${memoTag} 처분일 ${new Date(data.disposalDate).toISOString().slice(0, 10)} 입력됨. 수령일 입력 후 본 Todo 완료 처리.`,
            },
          });
        }
      } catch (todoErr) {
        console.error("[copd PUT] D2 todo error:", todoErr);
      }
    }

    // 마지막 회차 기준으로 Case.status 자동 동기화 + 캘린더 이벤트 갱신 + 처분검토 자동 인입
    const newStatus = await syncCopdCaseStatus(caseId);
    await syncCopdCaseEvents(caseId);
    await syncFromCopdDecision(caseId);

    return NextResponse.json({ ...updated, _caseStatus: newStatus });
  } catch (err) {
    console.error("[PUT copd/applications/:id]", err);
    const msg = err instanceof Error ? err.message : "저장 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string; appId: string }> }
) {
  const { caseId, appId } = await params;
  try {
    await prisma.copdApplication.delete({ where: { id: appId } });
    await syncCopdCaseStatus(caseId);
    await syncCopdCaseEvents(caseId);
    await syncFromCopdDecision(caseId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE copd/applications/:id]", err);
    const msg = err instanceof Error ? err.message : "삭제 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
