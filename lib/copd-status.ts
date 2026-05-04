// COPD 회차 진행 상태 → Case.status 매핑 룰
// COPD_STATUS (lib/constants/case.ts):
//   접수대기, 접수완료, 특진중, 특진완료, 전문의뢰, 전문완료,
//   승인, 불승인, 수치미달, 재진행가능, 직력미달,
//   반려, 보류, 파기, 이의제기, 종결

import { prisma } from "@/lib/prisma";

type CopdAppLike = {
  applicationDate: Date | string | null;
  examRequestReceivedAt: Date | string | null;
  exam1Date: Date | string | null;
  exam1Fev1Rate: number | null;
  exam2Date: Date | string | null;
  exam2Fev1Rate: number | null;
  exam2Skipped: boolean;
  examResult: string | null;
  expertOrgRequestDate: Date | string | null;
  expertOrgMeetingDate: Date | string | null;
  occReferralDate: Date | string | null;
  occReviewDate: Date | string | null;
  occResult: string | null;
  disposalType: string | null;
  reExamPossibleDate: Date | string | null;
  disabilityClaimDate: Date | string | null;
  disabilityDispositionType: string | null;
  disabilityDispositionDate: Date | string | null;
};

export function deriveCopdStatus(app: CopdAppLike): string {
  // 처분 결과 (장해 단계 포함)
  if (app.disposalType === "승인" && app.disabilityDispositionType === "부지급") return "불승인";
  if (app.disabilityDispositionDate) return "승인";
  if (app.disposalType === "승인") return "승인";
  if (app.disposalType === "부지급") return "불승인";
  if (app.disposalType === "반려") return "반려";
  if (app.disposalType === "보류") return "보류";

  // 질판위 단계 (occResult 입력 후엔 처분으로 넘어가야 함)
  if (app.occResult === "기각") return "이의제기"; // 기각 시 이의제기 경로
  if (app.occReviewDate || app.occReferralDate) return "전문완료";

  // 직업환경연구원 (전문조사)
  if (app.expertOrgMeetingDate) return "전문완료";
  if (app.expertOrgRequestDate) return "전문의뢰";

  // 특진 결과
  if (app.examResult === "수치미달") {
    if (app.reExamPossibleDate) {
      const d = new Date(app.reExamPossibleDate);
      if (d <= new Date()) return "재진행가능";
    }
    return "수치미달";
  }
  if (app.examResult === "기준내") return "특진완료";

  // 특진 진행
  const exam1Done = !!app.exam1Date && app.exam1Fev1Rate !== null;
  const exam2Done = app.exam2Skipped || (!!app.exam2Date && app.exam2Fev1Rate !== null);
  if (exam1Done && exam2Done) return "특진완료";
  if (app.exam1Date) return "특진중";

  // 접수
  if (app.applicationDate || app.examRequestReceivedAt) return "접수완료";

  return "접수대기";
}

// caseId의 모든 회차 중 가장 진행이 많이 된 단계를 산출하여 Case.status 갱신
const STATUS_PRIORITY: Record<string, number> = {
  접수대기: 0,
  접수완료: 1,
  특진중: 2,
  특진완료: 3,
  전문의뢰: 4,
  전문완료: 5,
  수치미달: 6,
  재진행가능: 6,
  이의제기: 7,
  보류: 7,
  반려: 8,
  불승인: 8,
  승인: 10,
  종결: 11,
};

// 회차별 특진/질판위/처분 일정을 SpecialClinicSchedule(캘린더)에 자동 반영 (멱등)
// 식별: caseId + memo prefix "[COPD_AUTO_R{n}_{kind}]" — 자동생성 표식.
//   kind: EXAM_1 / EXAM_2 / EXPERT_ORG / OCC_REVIEW
// (요양급여 청구일 / 진찰요구서 수령일 / 처분일 / 장해처분일은 캘린더에 표시할 만한 일정 아님 — 메모성 정보)
export async function syncCopdCaseEvents(caseId: string): Promise<void> {
  const detail = await prisma.copdDetail.findUnique({
    where: { caseId },
    include: { applications: true },
  });
  if (!detail) return;

  const caseInfo = await prisma.case.findUnique({
    where: { id: caseId },
    select: { tfName: true, patient: { select: { name: true, phone: true } } },
  });
  if (!caseInfo) return;

  // 기존 COPD 자동 일정 삭제 후 재생성 (멱등) — memo 표식 기반
  await prisma.specialClinicSchedule.deleteMany({
    where: {
      caseId,
      memo: { contains: "[COPD_AUTO_" },
    },
  });

  type ScheduleInput = {
    tag: string; // memo 식별자 (R1_EXAM_1 등)
    category: string; // 캘린더 카테고리
    clinicType: string | null;
    examRound: number | null;
    date: Date;
    hospital: string | null;
    title: string | null;
    content: string | null;
    assignedStaff: string | null;
    isPickup: boolean | null;
  };
  const schedules: ScheduleInput[] = [];
  const patientName = caseInfo.patient.name;
  const tfName = caseInfo.tfName ?? "";

  for (const app of detail.applications) {
    const r = app.applicationRound;
    const roundLabel = r === 1 ? "특진" : `재특진${r > 2 ? `(${r - 1})` : ""}`;

    if (app.exam1Date) {
      schedules.push({
        tag: `R${r}_EXAM_1`,
        category: roundLabel === "특진" ? "특진" : "재특진",
        clinicType: roundLabel === "특진" ? "특진" : "재특진",
        examRound: 1,
        date: app.exam1Date,
        hospital: app.exam1Hospital,
        title: null,
        content: [
          app.exam1Fev1Rate !== null ? `1초율 ${app.exam1Fev1Rate}%` : "",
          app.exam1Fev1Volume !== null ? `1초량 ${app.exam1Fev1Volume}L` : "",
          app.exam1Note ?? "",
        ].filter(Boolean).join(" / "),
        assignedStaff: app.exam1Attendee,
        isPickup: app.exam1Pickup,
      });
    }
    if (app.exam2Date && !app.exam2Skipped) {
      schedules.push({
        tag: `R${r}_EXAM_2`,
        category: roundLabel === "특진" ? "특진" : "재특진",
        clinicType: roundLabel === "특진" ? "특진" : "재특진",
        examRound: 2,
        date: app.exam2Date,
        hospital: app.exam2Hospital,
        title: null,
        content: [
          app.exam2Fev1Rate !== null ? `1초율 ${app.exam2Fev1Rate}%` : "",
          app.exam2Fev1Volume !== null ? `1초량 ${app.exam2Fev1Volume}L` : "",
          app.exam2Note ?? "",
        ].filter(Boolean).join(" / "),
        assignedStaff: app.exam2Attendee,
        isPickup: app.exam2Pickup,
      });
    }
    if (app.expertOrgMeetingDate) {
      schedules.push({
        tag: `R${r}_EXPERT_ORG`,
        category: "회의",
        clinicType: null,
        examRound: null,
        date: app.expertOrgMeetingDate,
        hospital: null,
        title: `직업환경연구원 (${r}차) - ${patientName}`,
        content: app.expertOrgResult ?? "",
        assignedStaff: null,
        isPickup: null,
      });
    }
    if (app.occReviewDate) {
      schedules.push({
        tag: `R${r}_OCC_REVIEW`,
        category: "질판위",
        clinicType: null,
        examRound: null,
        date: app.occReviewDate,
        hospital: app.occCommitteeName,
        title: `질판위 심의 (${r}차) - ${patientName}`,
        content: [app.occAttendanceType, app.occResult].filter(Boolean).join(" / "),
        assignedStaff: null,
        isPickup: null,
      });
    }
  }

  if (schedules.length === 0) return;

  await prisma.specialClinicSchedule.createMany({
    data: schedules.map((s) => ({
      caseId,
      diseaseType: "COPD",
      tfName,
      category: s.category,
      clinicType: s.clinicType,
      examRound: s.examRound,
      patientName,
      hospitalName: s.hospital,
      title: s.title,
      content: s.content,
      assignedStaff: s.assignedStaff,
      isPickup: s.isPickup ?? false,
      scheduledDate: s.date,
      isAllDay: true,
      status: "scheduled",
      memo: `[COPD_AUTO_${s.tag}] 자동 동기화`,
    })),
  });
}

export async function syncCopdCaseStatus(caseId: string): Promise<string | null> {
  const detail = await prisma.copdDetail.findUnique({
    where: { caseId },
    include: { applications: true },
  });
  // CopdDetail / 회차가 없는 경우 — Case.status를 한글 default "접수대기"로 보정 (CONSULTING 박제 방지)
  if (!detail || detail.applications.length === 0) {
    const c = await prisma.case.findUnique({ where: { id: caseId }, select: { status: true } });
    if (c && (c.status === "CONSULTING" || !c.status)) {
      await prisma.case.update({ where: { id: caseId }, data: { status: "접수대기" } });
      return "접수대기";
    }
    return null;
  }

  const candidate = detail.applications
    .map(deriveCopdStatus)
    .reduce((best, cur) => {
      const bp = STATUS_PRIORITY[best] ?? -1;
      const cp = STATUS_PRIORITY[cur] ?? -1;
      return cp > bp ? cur : best;
    }, "접수대기");

  await prisma.case.update({
    where: { id: caseId },
    data: { status: candidate },
  });
  return candidate;
}
