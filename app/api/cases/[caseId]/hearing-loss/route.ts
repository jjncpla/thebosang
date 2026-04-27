import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFromHearingLossDecision } from "@/lib/case-sync";

// 특진일정 → SpecialClinicSchedule 싱크
// clinicType별 필드 정의 (회차별 pickup)
const EXAM_SCHEDULE_FIELDS = [
  // [clinicType, examRound, dateField, attendeeField, pickupField(회차별)]
  ...([1,2,3,4,5] as const).map(r => [`특진`, r, `specialExam${r}Date`, `specialExam${r}Attendee`, `specialExam${r}Pickup`] as const),
  ...([1,2,3] as const).map(r => [`재특진`, r, `reSpecialExam${r}Date`, `reSpecialExam${r}Attendee`, `reSpecialExam${r}Pickup`] as const),
  ...([1,2,3] as const).map(r => [`재재특진`, r, `re2SpecialExam${r}Date`, `re2SpecialExam${r}Attendee`, `re2SpecialExam${r}Pickup`] as const),
] as [string, number, string, string, string][];

async function syncSpecialExamSchedules(caseId: string, detail: Record<string, unknown>) {
  // Case + Patient 정보 조회
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { tfName: true, patient: { select: { name: true } } },
  });
  if (!caseData) return;

  const patientName = caseData.patient?.name ?? "";
  const tfName = caseData.tfName ?? "";

  for (const [clinicType, examRound, dateField, attendeeField, pickupField] of EXAM_SCHEDULE_FIELDS) {
    const dateVal = detail[dateField];
    const attendee = typeof detail[attendeeField] === "string" ? detail[attendeeField] as string : null;
    const isPickup = typeof detail[pickupField] === "boolean" ? detail[pickupField] as boolean : null;

    if (!dateVal || typeof dateVal !== "string") {
      // 날짜가 지워진 경우 → scheduled 상태의 레코드 삭제
      await prisma.specialClinicSchedule.deleteMany({
        where: { caseId, clinicType, examRound, status: "scheduled" },
      });
      continue;
    }

    const d = new Date(dateVal);
    if (isNaN(d.getTime())) continue;

    const scheduledHour = d.getUTCHours();
    const scheduledMinute = d.getUTCMinutes();

    // 기존 레코드 찾기: caseId로 먼저, 없으면 patientName+tfName으로 fallback
    // (텔레그램 웹훅이 caseId 없이 먼저 생성한 경우 중복 방지)
    let existing = await prisma.specialClinicSchedule.findFirst({
      where: { caseId, clinicType, examRound },
    });
    if (!existing && patientName && tfName) {
      existing = await prisma.specialClinicSchedule.findFirst({
        where: { patientName, tfName, clinicType, examRound, caseId: null },
      });
    }

    if (existing) {
      await prisma.specialClinicSchedule.update({
        where: { id: existing.id },
        data: {
          caseId,
          scheduledDate: d,
          scheduledHour,
          scheduledMinute,
          isAllDay: false,
          patientName,
          tfName,
          assignedStaff: attendee,
          ...(isPickup !== null ? { isPickup } : {}),
        },
      });
    } else {
      await prisma.specialClinicSchedule.create({
        data: {
          caseId,
          clinicType,
          examRound,
          category: "특진",
          scheduledDate: d,
          scheduledHour,
          scheduledMinute,
          isAllDay: false,
          status: "scheduled",
          patientName,
          tfName,
          assignedStaff: attendee,
          isPickup: isPickup ?? false,
        },
      });
    }
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const detail = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } },
    });
    return NextResponse.json(detail);
  } catch (err) {
    console.error("[GET /api/cases/[caseId]/hearing-loss]", err);
    return NextResponse.json({ error: "조회 오류" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  try {
    const body = await req.json();
    // exams 및 메타 필드는 별도 처리
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { exams, id, caseId: _cId, createdAt, updatedAt, ...rawData } = body;

    // 숫자 타입 필드 강제 변환 (UI에서 string으로 올 수 있음)
    const FLOAT_FIELDS = ["firstExamRight","firstExamLeft","firstExamSpeech"];
    const INT_FIELDS = ["lumpSumAmount","avgWage"];
    const data: Record<string, unknown> = { ...rawData };
    for (const f of FLOAT_FIELDS) {
      if (data[f] !== null && data[f] !== undefined && data[f] !== "") {
        const n = parseFloat(String(data[f]));
        data[f] = isNaN(n) ? null : n;
      } else if (data[f] === "") {
        data[f] = null;
      }
    }
    for (const f of INT_FIELDS) {
      if (data[f] !== null && data[f] !== undefined && data[f] !== "") {
        const n = parseInt(String(data[f]), 10);
        data[f] = isNaN(n) ? null : n;
      } else if (data[f] === "") {
        data[f] = null;
      }
    }

    // 날짜 문자열 정규화 + 유효성 검사 (Prisma DateTime 필드)
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string") {
        let iso = v;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))          iso = v + ":00.000Z";
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) iso = v + ".000Z";
        else if (/^\d{4}-\d{2}-\d{2}$/.test(v))                    iso = v + "T00:00:00.000Z";
        else continue;
        // Date 생성 시 유효하지 않은 날짜(예: 2월 34일) → null 처리
        const d = new Date(iso);
        data[k] = isNaN(d.getTime()) ? null : iso;
      }
    }

    // 기존 데이터 조회 (결정수령일 / 처분결과 변경 감지용)
    const existingDetail = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      select: { decisionReceivedAt: true, decisionType: true },
    });

    const detail = await prisma.hearingLossDetail.upsert({
      where: { caseId },
      create: { caseId, ...data },
      update: data,
      include: { exams: { orderBy: [{ examSet: "asc" }, { examRound: "asc" }] } },
    });

    // 결정수령일이 새로 입력된 경우 → Case.status DECISION_RECEIVED
    if (detail.decisionReceivedAt && !existingDetail?.decisionReceivedAt) {
      await prisma.case.update({
        where: { id: caseId },
        data: { status: "DECISION_RECEIVED" },
      });
    }

    // 처분결과(decisionType) 변경 또는 신규 설정 시 → ObjectionReview + Case 싱크
    if (detail.decisionType && detail.decisionType !== existingDetail?.decisionType) {
      await syncFromHearingLossDecision(caseId, detail.decisionType, detail.decisionReceivedAt);
    }

    // 특진일정 → 통합캘린더(SpecialClinicSchedule) 싱크
    await syncSpecialExamSchedules(caseId, detail);

    return NextResponse.json(detail);
  } catch (err) {
    console.error("[PUT /api/cases/[caseId]/hearing-loss]", err);
    const msg = err instanceof Error ? err.message : "저장 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params;
  const body = await req.json();

  // lastNoiseWorkEndDate is now on Case model — update there
  if (body.lastNoiseWorkEndDate !== undefined) {
    const updated = await prisma.case.update({
      where: { id: caseId },
      data: { lastNoiseWorkEndDate: body.lastNoiseWorkEndDate ? new Date(body.lastNoiseWorkEndDate) : null },
    });
    return NextResponse.json({ success: true, updated });
  }

  // General HearingLossDetail field patch
  const { id: _id, caseId: _cId, createdAt: _ca, updatedAt: _ua, exams: _ex, ...fields } = body;
  if (Object.keys(fields).length > 0) {
    // 기존 처분결과 조회 (변경 감지)
    const prev = await prisma.hearingLossDetail.findUnique({
      where: { caseId },
      select: { decisionType: true },
    });
    const updated = await prisma.hearingLossDetail.upsert({
      where: { caseId },
      create: { caseId, ...fields },
      update: fields,
    });
    // 처분결과가 바뀌었으면 싱크
    if (updated.decisionType && updated.decisionType !== prev?.decisionType) {
      await syncFromHearingLossDecision(caseId, updated.decisionType, updated.decisionReceivedAt);
    }
    return NextResponse.json({ success: true, updated });
  }

  return NextResponse.json({ success: true });
}
