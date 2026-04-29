/**
 * 신규 자동생성 양식의 spec 빌더 모음.
 *
 * 각 양식은 입력 데이터를 받아 TextFormSpec을 반환.
 * /api/forms/text-pdf 라우트가 template 키로 빌더 선택.
 */
import type { TextFormSpec } from "./text-form-pdf";

export type TextFormTemplate =
  | "WAGE_CORRECTION_CLAIM"
  | "EXAM_CLAIM"
  | "REEXAM_CLAIM"
  | "ADDITIONAL_INJURY_CLAIM"
  | "REQUOTE_REQUEST";

/* ═══════════════════════════════════════════════════════════════
   공통 유틸
   ═══════════════════════════════════════════════════════════════ */
function fmtToday(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function fmtFileDate(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════
   심사청구서 (EXAM_CLAIM)
   ═══════════════════════════════════════════════════════════════ */
export interface ExamClaimData {
  // 청구인
  claimantName: string;
  claimantRRN?: string;
  claimantAddr?: string;
  claimantPhone?: string;
  // 처분청
  decisionAgency?: string;       // "근로복지공단 ○○지역본부장"
  // 원처분
  decisionDate?: string;          // YYYY-MM-DD
  decisionContent?: string;       // 결정 내용 (예: "장해급여 부지급 처분")
  caseNo?: string;                // 사건번호/관리번호
  managementNo?: string;
  diagnosisName?: string;         // 상병명
  // 청구 취지
  purpose?: string;
  // 청구 이유 (자유 텍스트, 줄바꿈 \n 가능)
  reasonText: string;
  // 대리인
  agentName?: string;
  agentLicenseNo?: string;
  // 첨부서류 목록
  attachments?: string[];
}

export function buildExamClaim(d: ExamClaimData): TextFormSpec {
  const purpose =
    d.purpose ??
    `청구인에 대한 ${d.decisionAgency ?? "근로복지공단 지사장"}의 ${d.decisionDate ?? "(처분일)"}자 ${d.decisionContent ?? "(처분내용)"}을 취소한다.`;

  return {
    title: "심사청구서",
    subtitle: "(산업재해보상보험법 제103조)",
    sections: [
      {
        heading: "■ 청구인 인적사항",
        rows: [
          ["성    명", d.claimantName],
          ["주민번호", d.claimantRRN ?? "(입력 필요)"],
          ["주    소", d.claimantAddr ?? "(입력 필요)"],
          ["연락처", d.claimantPhone ?? "(입력 필요)"],
        ],
      },
      {
        heading: "■ 처분청 및 원처분 정보",
        rows: [
          ["처 분 청", d.decisionAgency ?? "(입력 필요)"],
          ["처분일자", d.decisionDate ?? "(입력 필요)"],
          ["처분내용", d.decisionContent ?? "(입력 필요)"],
          ["관리번호", d.managementNo ?? "-"],
          ["상 병 명", d.diagnosisName ?? "-"],
          ["사건번호", d.caseNo ?? "-"],
        ],
      },
      {
        heading: "■ 청구 취지",
        paragraphs: [purpose],
      },
      {
        heading: "■ 청구 이유",
        paragraphs: d.reasonText.split("\n\n").filter(Boolean),
      },
      ...(d.attachments && d.attachments.length > 0
        ? [
            {
              heading: "■ 첨부서류",
              paragraphs: d.attachments.map((a, i) => `${i + 1}. ${a}`),
            },
          ]
        : []),
    ],
    signatureBlock: {
      dateText: fmtToday(),
      rows: [
        ["청 구 인", `${d.claimantName} (인)`],
        ["대 리 인", d.agentName ? `${d.agentName} ${d.agentLicenseNo ? `(공인노무사 ${d.agentLicenseNo})` : ""} (인)` : "노무법인 더보상 (인)"],
      ],
    },
    footnote:
      "※ 본 심사청구서는 결정통지서를 받은 날부터 90일 이내에 근로복지공단에 제출하여야 합니다.",
  };
}

export function examClaimFileName(d: ExamClaimData): string {
  return `심사청구서_${d.claimantName}_${fmtFileDate()}.pdf`;
}

/* ═══════════════════════════════════════════════════════════════
   재심사청구서 (REEXAM_CLAIM)
   ═══════════════════════════════════════════════════════════════ */
export interface ReExamClaimData extends ExamClaimData {
  examDecisionDate?: string;       // 심사 결정일
  examDecisionContent?: string;    // 심사 결정 내용 (예: "기각")
  examCaseNo?: string;              // 심사 사건번호
}

export function buildReExamClaim(d: ReExamClaimData): TextFormSpec {
  const purpose =
    d.purpose ??
    `청구인에 대한 산업재해보상보험재심사위원회의 ${d.examDecisionDate ?? "(심사결정일)"}자 ${d.examDecisionContent ?? "(심사결정 내용)"}을 취소한다.`;

  return {
    title: "재심사청구서",
    subtitle: "(산업재해보상보험법 제106조)",
    sections: [
      {
        heading: "■ 청구인 인적사항",
        rows: [
          ["성    명", d.claimantName],
          ["주민번호", d.claimantRRN ?? "(입력 필요)"],
          ["주    소", d.claimantAddr ?? "(입력 필요)"],
          ["연락처", d.claimantPhone ?? "(입력 필요)"],
        ],
      },
      {
        heading: "■ 원처분 및 심사 결정 정보",
        rows: [
          ["원처분청", d.decisionAgency ?? "(입력 필요)"],
          ["원처분일자", d.decisionDate ?? "(입력 필요)"],
          ["원처분내용", d.decisionContent ?? "(입력 필요)"],
          ["심사 결정일", d.examDecisionDate ?? "(입력 필요)"],
          ["심사 결정내용", d.examDecisionContent ?? "(입력 필요)"],
          ["심사 사건번호", d.examCaseNo ?? "-"],
          ["관리번호", d.managementNo ?? "-"],
          ["상 병 명", d.diagnosisName ?? "-"],
        ],
      },
      {
        heading: "■ 청구 취지",
        paragraphs: [purpose],
      },
      {
        heading: "■ 청구 이유",
        paragraphs: d.reasonText.split("\n\n").filter(Boolean),
      },
      ...(d.attachments && d.attachments.length > 0
        ? [
            {
              heading: "■ 첨부서류",
              paragraphs: d.attachments.map((a, i) => `${i + 1}. ${a}`),
            },
          ]
        : []),
    ],
    signatureBlock: {
      dateText: fmtToday(),
      rows: [
        ["청 구 인", `${d.claimantName} (인)`],
        ["대 리 인", d.agentName ? `${d.agentName} ${d.agentLicenseNo ? `(공인노무사 ${d.agentLicenseNo})` : ""} (인)` : "노무법인 더보상 (인)"],
      ],
    },
    footnote:
      "※ 본 재심사청구서는 심사결정서 정본을 받은 날부터 60일 이내에 산업재해보상보험재심사위원회에 제출하여야 합니다.",
  };
}

export function reExamClaimFileName(d: ReExamClaimData): string {
  return `재심사청구서_${d.claimantName}_${fmtFileDate()}.pdf`;
}

/* ═══════════════════════════════════════════════════════════════
   추가상병 신청서 (ADDITIONAL_INJURY_CLAIM)
   ═══════════════════════════════════════════════════════════════ */
export interface AdditionalInjuryData {
  claimantName: string;
  claimantRRN?: string;
  claimantAddr?: string;
  claimantPhone?: string;
  managementNo?: string;
  originalDiagnosis?: string;       // 기존 인정 상병
  additionalDiagnosis: string;       // 추가 상병명
  diagnosisDate?: string;            // 추가 상병 진단일
  diagnosisHospital?: string;        // 진단 의료기관
  reasonText: string;                // 추가 상병 청구 사유
  agentName?: string;
  agentLicenseNo?: string;
}

export function buildAdditionalInjury(d: AdditionalInjuryData): TextFormSpec {
  return {
    title: "추가상병 신청서",
    subtitle: "(산업재해보상보험법 시행규칙 제20조)",
    sections: [
      {
        heading: "■ 신청인 인적사항",
        rows: [
          ["성    명", d.claimantName],
          ["주민번호", d.claimantRRN ?? "(입력 필요)"],
          ["주    소", d.claimantAddr ?? "(입력 필요)"],
          ["연락처", d.claimantPhone ?? "(입력 필요)"],
          ["관리번호", d.managementNo ?? "-"],
        ],
      },
      {
        heading: "■ 상병 정보",
        rows: [
          ["기존 인정 상병", d.originalDiagnosis ?? "-"],
          ["추가 상병명", d.additionalDiagnosis],
          ["진 단 일", d.diagnosisDate ?? "(입력 필요)"],
          ["진단 의료기관", d.diagnosisHospital ?? "(입력 필요)"],
        ],
      },
      {
        heading: "■ 신청 사유",
        paragraphs: d.reasonText.split("\n\n").filter(Boolean),
      },
    ],
    signatureBlock: {
      dateText: fmtToday(),
      rows: [
        ["신 청 인", `${d.claimantName} (인)`],
        ["대 리 인", d.agentName ? `${d.agentName} (인)` : "노무법인 더보상 (인)"],
      ],
    },
    footnote: "※ 본 신청서는 진단일로부터 빠른 시일 내에 근로복지공단에 제출하여야 합니다.",
  };
}

export function additionalInjuryFileName(d: AdditionalInjuryData): string {
  return `추가상병신청서_${d.claimantName}_${fmtFileDate()}.pdf`;
}

/* ═══════════════════════════════════════════════════════════════
   재요양 신청서 (REQUOTE_REQUEST)
   ═══════════════════════════════════════════════════════════════ */
export interface RequoteRequestData {
  claimantName: string;
  claimantRRN?: string;
  claimantAddr?: string;
  claimantPhone?: string;
  managementNo?: string;
  originalDiagnosis?: string;
  treatmentEndDate?: string;          // 종전 요양 종료일
  reAggravationDate?: string;          // 재발/악화일
  diagnosisHospital?: string;          // 재요양 진단 의료기관
  reasonText: string;
  agentName?: string;
  agentLicenseNo?: string;
}

export function buildRequoteRequest(d: RequoteRequestData): TextFormSpec {
  return {
    title: "재요양 신청서",
    subtitle: "(산업재해보상보험법 제51조)",
    sections: [
      {
        heading: "■ 신청인 인적사항",
        rows: [
          ["성    명", d.claimantName],
          ["주민번호", d.claimantRRN ?? "(입력 필요)"],
          ["주    소", d.claimantAddr ?? "(입력 필요)"],
          ["연락처", d.claimantPhone ?? "(입력 필요)"],
          ["관리번호", d.managementNo ?? "-"],
        ],
      },
      {
        heading: "■ 종전 요양 정보",
        rows: [
          ["기존 인정 상병", d.originalDiagnosis ?? "-"],
          ["요양 종료일", d.treatmentEndDate ?? "(입력 필요)"],
          ["재발/악화일", d.reAggravationDate ?? "(입력 필요)"],
          ["진단 의료기관", d.diagnosisHospital ?? "(입력 필요)"],
        ],
      },
      {
        heading: "■ 재요양 신청 사유",
        paragraphs: d.reasonText.split("\n\n").filter(Boolean),
      },
    ],
    signatureBlock: {
      dateText: fmtToday(),
      rows: [
        ["신 청 인", `${d.claimantName} (인)`],
        ["대 리 인", d.agentName ? `${d.agentName} (인)` : "노무법인 더보상 (인)"],
      ],
    },
    footnote: "※ 재요양은 종전 요양 종료 후 증상이 재발하거나 악화된 경우에 신청 가능합니다.",
  };
}

export function requoteRequestFileName(d: RequoteRequestData): string {
  return `재요양신청서_${d.claimantName}_${fmtFileDate()}.pdf`;
}

/* ═══════════════════════════════════════════════════════════════
   라우터: template 키로 spec + filename 반환
   ═══════════════════════════════════════════════════════════════ */
export function buildSpecByTemplate(
  template: TextFormTemplate,
  data: Record<string, unknown>
): { spec: TextFormSpec; fileName: string } {
  switch (template) {
    case "EXAM_CLAIM": {
      const d = data as unknown as ExamClaimData;
      return { spec: buildExamClaim(d), fileName: examClaimFileName(d) };
    }
    case "REEXAM_CLAIM": {
      const d = data as unknown as ReExamClaimData;
      return { spec: buildReExamClaim(d), fileName: reExamClaimFileName(d) };
    }
    case "ADDITIONAL_INJURY_CLAIM": {
      const d = data as unknown as AdditionalInjuryData;
      return { spec: buildAdditionalInjury(d), fileName: additionalInjuryFileName(d) };
    }
    case "REQUOTE_REQUEST": {
      const d = data as unknown as RequoteRequestData;
      return { spec: buildRequoteRequest(d), fileName: requoteRequestFileName(d) };
    }
    case "WAGE_CORRECTION_CLAIM":
      throw new Error(
        "WAGE_CORRECTION_CLAIM은 AvgWageNotice 기반 별도 라우트(/api/avg-wage/[id]/correction-pdf) 사용"
      );
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}
