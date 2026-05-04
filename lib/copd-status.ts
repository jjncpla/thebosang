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

// 회차별 특진/질판위 일정을 CaseEvent에 자동 반영 (멱등)
// eventSubtype 패턴: COPD_R{round}_{kind}
//   kind: APPLICATION / EXAM_REQUEST / EXAM_1 / EXAM_2 / EXPERT_ORG / OCC_REVIEW / DISPOSAL / DISABILITY
export async function syncCopdCaseEvents(caseId: string): Promise<void> {
  const detail = await prisma.copdDetail.findUnique({
    where: { caseId },
    include: { applications: true },
  });
  if (!detail) return;

  // 기존 COPD 자동 이벤트 모두 삭제 후 재생성 (멱등)
  await prisma.caseEvent.deleteMany({
    where: { caseId, eventSubtype: { startsWith: "COPD_R" } },
  });

  type EventInput = {
    subtype: string;
    type: string;
    date: Date;
    title: string;
    content: string;
  };
  const events: EventInput[] = [];

  for (const app of detail.applications) {
    const r = app.applicationRound;
    const tag = `${r}차`;

    if (app.applicationDate) {
      events.push({
        subtype: `COPD_R${r}_APPLICATION`,
        type: "APPLICATION",
        date: app.applicationDate,
        title: `COPD ${tag} 요양급여 청구`,
        content: app.applicationNote ?? "",
      });
    }
    if (app.examRequestReceivedAt) {
      events.push({
        subtype: `COPD_R${r}_EXAM_REQUEST`,
        type: "EXAM_REQUEST",
        date: app.examRequestReceivedAt,
        title: `COPD ${tag} 진찰요구서 수령`,
        content: "",
      });
    }
    if (app.exam1Date) {
      events.push({
        subtype: `COPD_R${r}_EXAM_1`,
        type: "EXAM",
        date: app.exam1Date,
        title: `COPD ${tag} 1차 특진${app.exam1Hospital ? ` (${app.exam1Hospital})` : ""}`,
        content: [
          app.exam1Fev1Rate !== null ? `1초율 ${app.exam1Fev1Rate}%` : "",
          app.exam1Fev1Volume !== null ? `1초량 ${app.exam1Fev1Volume}L` : "",
          app.exam1Note ?? "",
        ].filter(Boolean).join(" / "),
      });
    }
    if (app.exam2Date && !app.exam2Skipped) {
      events.push({
        subtype: `COPD_R${r}_EXAM_2`,
        type: "EXAM",
        date: app.exam2Date,
        title: `COPD ${tag} 2차 특진${app.exam2Hospital ? ` (${app.exam2Hospital})` : ""}`,
        content: [
          app.exam2Fev1Rate !== null ? `1초율 ${app.exam2Fev1Rate}%` : "",
          app.exam2Fev1Volume !== null ? `1초량 ${app.exam2Fev1Volume}L` : "",
          app.exam2Note ?? "",
        ].filter(Boolean).join(" / "),
      });
    }
    if (app.expertOrgMeetingDate) {
      events.push({
        subtype: `COPD_R${r}_EXPERT_ORG`,
        type: "EXPERT",
        date: app.expertOrgMeetingDate,
        title: `COPD ${tag} 직업환경연구원 개최`,
        content: app.expertOrgResult ?? "",
      });
    }
    if (app.occReviewDate) {
      events.push({
        subtype: `COPD_R${r}_OCC_REVIEW`,
        type: "OCC_COMMITTEE",
        date: app.occReviewDate,
        title: `COPD ${tag} 질판위 심의${app.occCommitteeName ? ` (${app.occCommitteeName})` : ""}`,
        content: [app.occAttendanceType, app.occResult].filter(Boolean).join(" / "),
      });
    }
    if (app.disposalDate) {
      events.push({
        subtype: `COPD_R${r}_DISPOSAL`,
        type: "DISPOSAL",
        date: app.disposalDate,
        title: `COPD ${tag} 요양 처분: ${app.disposalType ?? "-"}`,
        content: app.disposalReason ?? "",
      });
    }
    if (app.disabilityDispositionDate) {
      events.push({
        subtype: `COPD_R${r}_DISABILITY`,
        type: "DISABILITY",
        date: app.disabilityDispositionDate,
        title: `COPD ${tag} 장해 처분: ${app.disabilityDispositionGrade ?? app.disabilityDispositionType ?? "-"}`,
        content: "",
      });
    }
  }

  if (events.length === 0) return;

  await prisma.caseEvent.createMany({
    data: events.map((e) => ({
      caseId,
      eventType: e.type,
      eventSubtype: e.subtype,
      eventDate: e.date,
      title: e.title,
      content: e.content,
      hashtags: ["COPD"],
    })),
  });
}

export async function syncCopdCaseStatus(caseId: string): Promise<string | null> {
  const detail = await prisma.copdDetail.findUnique({
    where: { caseId },
    include: { applications: true },
  });
  if (!detail || detail.applications.length === 0) return null;

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
