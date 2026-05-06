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
  | "REQUOTE_REQUEST"
  | "COPD_FACT_CONFIRM"
  | "COPD_INJURY_REPORT"
  | "COPD_INJURY_INCIDENT";

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
   COPD 사실관계 확인서 (COPD_FACT_CONFIRM)
   ═══════════════════════════════════════════════════════════════ */
export interface CopdFactConfirmData {
  // 재해자
  workerName: string;
  workerBirth?: string;       // YYYY-MM-DD
  injuryDate?: string;        // 재해일자 (보통 진단일/초진일)
  workplaceName?: string;
  // 확인자 (대리인 기준)
  confirmerName: string;
  confirmerAddr?: string;
  confirmerPhone?: string;
  confirmerEtc?: string;       // 기타 연락처
  // 관계 (체크 1개)
  relation: "본인" | "대리인" | "사업장" | "동료근로자" | "가족";
  agentLicenseType?: string;   // 대리인일 때 자격 (예: "공인노무사")
  // 본문 (확인 내용 — 자유 텍스트)
  contentText?: string;
}

export function buildCopdFactConfirm(d: CopdFactConfirmData): TextFormSpec {
  const checkbox = (label: CopdFactConfirmData["relation"]) =>
    `${d.relation === label ? "■" : "□"} ${label}${
      label === "대리인" && d.relation === "대리인" && d.agentLicenseType
        ? ` (자격: ${d.agentLicenseType})`
        : ""
    }`;

  const introText =
    "위 확인자는 재해자가 제출한 요양(유족)급여신청서와 관련하여 산업재해보상보험법상 " +
    "「업무상재해 판단에 관한 사항」에 대한 확인을 요청하여 아래 질문 사항에 임의 기재합니다.";

  const procedureText =
    "[업무처리절차]\n" +
    "① 요양급여신청서 접수\n" +
    "❷ 사실관계 및 업무내용 확인 등 기본조사 (현재 진행 단계)\n" +
    "③ 유해물질 노출 등 조사\n" +
    "④ 재해조사서 작성\n" +
    "⑤ 업무상질병판정위원회 심의\n" +
    "⑥ 최종 결정";

  const guideText =
    "[작성방법 안내]\n" +
    "• 본 확인서는 재해자의 업무상재해 판단을 위한 기본조사 자료로 사용됩니다.\n" +
    "• 사실에 근거하여 정확하게 작성하여 주시기 바랍니다.\n" +
    "• 임의 기재한 내용에 대해서는 사실확인 후 별도 문의가 있을 수 있습니다.";

  return {
    title: "사실관계 확인서",
    subtitle: "(COPD 요양급여 청구 관련)",
    sections: [
      {
        heading: "■ 재해자 인적사항",
        rows: [
          ["성    명", d.workerName],
          ["생년월일", d.workerBirth ?? "(입력 필요)"],
          ["재해일자", d.injuryDate ?? "(입력 필요)"],
          ["사업장명", d.workplaceName ?? "(입력 필요)"],
        ],
      },
      {
        heading: "■ 확인자 인적사항",
        rows: [
          ["성    명", d.confirmerName],
          ["주    소", d.confirmerAddr ?? "-"],
          ["휴 대 폰", d.confirmerPhone ?? "-"],
          ["기타 연락처", d.confirmerEtc ?? "-"],
        ],
      },
      {
        heading: "■ 재해자와의 관계",
        paragraphs: [
          [
            checkbox("본인"),
            checkbox("대리인"),
            checkbox("사업장"),
            checkbox("동료근로자"),
            checkbox("가족"),
          ].join("   "),
        ],
      },
      {
        paragraphs: [introText],
      },
      {
        heading: "■ 업무처리절차",
        paragraphs: [procedureText],
      },
      {
        heading: "■ 작성방법 안내",
        paragraphs: [guideText],
      },
      ...(d.contentText
        ? [
            {
              heading: "■ 확인 내용",
              paragraphs: d.contentText.split("\n\n").filter(Boolean),
            },
          ]
        : []),
    ],
    signatureBlock: {
      dateText: fmtToday(),
      rows: [["확 인 자", `${d.confirmerName} (인)`]],
    },
    footnote:
      "※ 본 확인서의 기재 내용은 산재 업무상재해 판단의 기초자료로 사용됩니다.",
  };
}

export function copdFactConfirmFileName(d: CopdFactConfirmData): string {
  return `COPD_사실관계확인서_${d.workerName}_${fmtFileDate()}.pdf`;
}

/* ═══════════════════════════════════════════════════════════════
   COPD 재해경위서 — 분진작업 + COPD 병력 조사 (COPD_INJURY_REPORT)
   ═══════════════════════════════════════════════════════════════ */
export interface CopdDustWorkItem {
  workplace: string;       // 사업장명
  period?: string;         // 근무기간 (예: "1995.03~2010.12")
  jobDescription?: string; // 수행업무
  dustHours?: string;       // 분진노출 작업시간
}

export interface CopdInjuryReportData {
  // 1. 최종 분진사업장 기초조사
  workerName: string;
  workerBirth?: string;
  age?: number | string;
  hireDate?: string;
  height?: string;
  weight?: string;
  position?: string;        // 직위
  workplaceName?: string;
  totalCareer?: string;     // 직종 총경력
  currentDept?: string;     // 현재부서
  chargeYears?: string;     // 담당기간
  jobType?: string;         // 직종
  dustWorkHours?: string;   // 분진노출 작업시간
  workType?: string;        // 근로형태
  workHoursPerDay?: string; // 일 근무시간
  workDaysPerMonth?: string; // 월 근무일수
  offDaysPerMonth?: string;
  workEnv?: string;          // 작업환경
  workTools?: string;        // 작업도구
  workMethod?: string;       // 작업방법
  maskUse?: string;          // 마스크 착용 여부
  ventilation?: string;      // 환기시설
  healthCheck?: string;      // 건강검진 이력

  // 2. 고향 및 거주 이력
  hometown?: string;          // 문 1
  residenceBeforeHire?: string;
  militaryPeriod?: string;    // 문 2

  // 3. 최종 분진사업장 세부내용
  riskFactors?: string;       // 문 3
  diseaseCause?: string;      // 문 4
  pastAccident?: string;      // 문 5

  // 4. 직업력 (분진 노출 이력)
  dustJobs: CopdDustWorkItem[];   // 문 6
  postRetirement?: string;         // 문 7

  // 5. COPD 병력
  coughStartDate?: string;     // 문 8
  diagnosisDate?: string;      // 문 9 — 진단일
  diagnosisHospital?: string;  // 문 9 — 의료기관
  smokingStatus: "비해당" | "과거 흡연" | "흡연 중" | string;  // 문 10
  smokingPacks?: string;
  smokingYears?: string;
  exSmokingYears?: string;
  familyHistory?: string;       // 문 11

  // 6. 기타
  etcNote?: string;             // 문 12
  truthConfirm?: string;        // 문 13 — 답변 사실 확인 진술

  // 작성자
  authorName?: string;          // 작성자 (보통 청구인 본인)
  workplaceConfirmerName?: string;
}

export function buildCopdInjuryReport(d: CopdInjuryReportData): TextFormSpec {
  const dustJobsText =
    d.dustJobs.length === 0
      ? "(없음)"
      : d.dustJobs
          .map(
            (j, i) =>
              `${i + 1}. ${j.workplace} | ${j.period ?? "-"} | ${j.jobDescription ?? "-"} | 분진노출시간: ${j.dustHours ?? "-"}`
          )
          .join("\n");

  const smokingText =
    d.smokingStatus === "비해당"
      ? "비해당"
      : d.smokingStatus === "과거 흡연"
        ? `과거 흡연 (${d.smokingPacks ?? "-"}개피/일 × ${d.exSmokingYears ?? "-"}년 흡연 후 금연)`
        : d.smokingStatus === "흡연 중"
          ? `흡연 중 (${d.smokingPacks ?? "-"}개피/일 × ${d.smokingYears ?? "-"}년)`
          : d.smokingStatus;

  return {
    title: "재해경위서",
    subtitle: "(분진작업 종사 및 COPD 병력 조사)",
    sections: [
      {
        heading: "1. 최종 분진사업장 기초 조사",
        rows: [
          ["성    명", d.workerName],
          ["생년월일", d.workerBirth ?? "-"],
          ["연    령", String(d.age ?? "-")],
          ["입 사 일", d.hireDate ?? "-"],
          ["키 / 몸무게", `${d.height ?? "-"} / ${d.weight ?? "-"}`],
          ["직    위", d.position ?? "-"],
          ["사업장명", d.workplaceName ?? "-"],
          ["직종 총경력", d.totalCareer ?? "-"],
          ["현재 부서", d.currentDept ?? "-"],
          ["담당기간", d.chargeYears ?? "-"],
          ["직    종", d.jobType ?? "-"],
          ["분진노출 작업시간", d.dustWorkHours ?? "-"],
          ["근로형태", d.workType ?? "-"],
          ["일 근무시간", d.workHoursPerDay ?? "-"],
          ["월 근무일수", d.workDaysPerMonth ?? "-"],
          ["월 휴무일수", d.offDaysPerMonth ?? "-"],
          ["작업환경", d.workEnv ?? "-"],
          ["작업도구", d.workTools ?? "-"],
          ["작업방법", d.workMethod ?? "-"],
          ["마스크 착용", d.maskUse ?? "-"],
          ["환기시설", d.ventilation ?? "-"],
          ["건강검진 이력", d.healthCheck ?? "-"],
        ],
      },
      {
        heading: "2. 고향 및 취업 이전까지의 거주 이력",
        rows: [
          ["문 1. 고향 / 거주지", `${d.hometown ?? "-"} / 취업 이전: ${d.residenceBeforeHire ?? "-"}`],
          ["문 2. 군 복무기간", d.militaryPeriod ?? "-"],
        ],
      },
      {
        heading: "3. 최종 분진사업장 세부내용 조사",
        rows: [
          ["문 3. 위험요소", d.riskFactors ?? "-"],
          ["문 4. 발병 원인 (본인 견해)", d.diseaseCause ?? "-"],
          ["문 5. 산재사고 경험", d.pastAccident ?? "-"],
        ],
      },
      {
        heading: "4. 최종 분진사업장 이전/이후 직업력 조사",
        paragraphs: [
          "문 6. 분진노출 사업장 이력",
          dustJobsText,
          "",
          `문 7. 최종 사업장 퇴직 이후: ${d.postRetirement ?? "-"}`,
        ],
      },
      {
        heading: "5. COPD 병력 조사",
        rows: [
          ["문 8. 기침 시작 시점", d.coughStartDate ?? "-"],
          ["문 9. 진단일 / 의료기관", `${d.diagnosisDate ?? "-"} / ${d.diagnosisHospital ?? "-"}`],
          ["문 10. 흡연 이력", smokingText],
          ["문 11. 가족력", d.familyHistory ?? "-"],
        ],
      },
      {
        heading: "6. 기타 조사",
        rows: [
          ["문 12. 기타 진술", d.etcNote ?? "-"],
          ["문 13. 답변 사실 확인", d.truthConfirm ?? "본인은 위 답변이 사실임을 확인합니다."],
        ],
      },
    ],
    signatureBlock: {
      dateText: fmtToday(),
      rows: [
        ["작 성 자", `${d.authorName ?? d.workerName} (인)`],
        ["사업장 확인자", d.workplaceConfirmerName ? `${d.workplaceConfirmerName} (인)` : "-"],
      ],
    },
    footnote:
      "※ 본 재해경위서는 COPD 요양급여 청구 관련 분진작업 노출 및 병력 확인 자료로 사용됩니다.",
  };
}

export function copdInjuryReportFileName(d: CopdInjuryReportData): string {
  return `COPD_재해경위서_${d.workerName}_${fmtFileDate()}.pdf`;
}

/* ═══════════════════════════════════════════════════════════════
   COPD 재해발생경위서 (COPD_INJURY_INCIDENT)
   ═══════════════════════════════════════════════════════════════ */
export interface CopdInjuryIncidentDustJob {
  seq: number;                  // 연번
  period?: string;              // 기간
  workplace: string;            // 사업장
  jobType?: string;             // 직종
  duration?: string;            // 근무기간
  dataHealth?: boolean;         // 건강
  dataPension?: boolean;        // 연금
  dataEmployment?: boolean;     // 고용
  dataIncome?: boolean;         // 소득
  dataStatement?: boolean;      // 진술
}

export interface CopdInjuryIncidentData {
  // I. 개요
  workerName: string;
  workerSsn?: string;
  workerAddr?: string;
  workplaceName?: string;

  // II. 분진직력
  dustJobs: CopdInjuryIncidentDustJob[];
  specialNote?: string;            // 특이사항
  totalDuration?: string;           // 총 근무기간

  // 재해발생경위 본문 (사용자 편집 — 템플릿 기본값 제공)
  incidentNarrative?: string;

  // III. 의학적 소견
  medicalOpinion?: string;          // 의료기관 진단 결과 인용

  // IV. 청구인의 견해
  claimantView?: string;

  // V. 결어
  conclusion?: string;

  // 작성 (대리인)
  agentName?: string;
  agentLicenseNo?: string;
  agentOfficeName?: string;        // 노무법인명
}

export function buildCopdInjuryIncident(d: CopdInjuryIncidentData): TextFormSpec {
  const dustJobsLines =
    d.dustJobs.length === 0
      ? ["(없음)"]
      : d.dustJobs.map((j) => {
          const data = [
            j.dataHealth ? "건강" : null,
            j.dataPension ? "연금" : null,
            j.dataEmployment ? "고용" : null,
            j.dataIncome ? "소득" : null,
            j.dataStatement ? "진술" : null,
          ]
            .filter(Boolean)
            .join("·");
          return `${j.seq}. ${j.period ?? "-"} | ${j.workplace} | ${j.jobType ?? "-"} | ${j.duration ?? "-"} | 자료: ${data || "-"}`;
        });

  const defaultIncident =
    "피재근로자는 위 분진사업장에서 장기간 근무하며 분진(석탄·암석·금속·용접흄 등)에 지속적으로 노출되었고, " +
    "이에 따라 만성폐쇄성폐질환(COPD)이 발병한 것으로 추정됩니다. " +
    "구체적 작업환경, 분진 노출 강도 및 빈도, 보호구 미비 실태 등은 첨부한 재해경위서에 상술하였습니다.";

  const defaultClaimantView =
    "청구인은 위와 같이 분진작업 사업장에서 다년간 종사하며 발병한 COPD가 " +
    "산업재해보상보험법상 업무상 질병에 해당함을 주장합니다. 의학적 소견 및 직업력에 비추어 " +
    "업무와 질병 사이에 상당인과관계가 인정된다고 판단됩니다.";

  const defaultConclusion =
    "이상과 같은 사유로 피재근로자의 COPD에 대하여 업무상질병으로 인정하여 주시기 바랍니다.";

  return {
    title: "재해발생경위서",
    subtitle: "(COPD 요양급여 청구)",
    sections: [
      {
        heading: "I. 개요",
        rows: [
          ["피재근로자 성명", d.workerName],
          ["주민등록번호", d.workerSsn ?? "-"],
          ["주    소", d.workerAddr ?? "-"],
          ["사업장명", d.workplaceName ?? "-"],
        ],
      },
      {
        heading: "II. 피재자의 분진직력 및 재해발생경위",
        paragraphs: [
          "1. 피재자의 분진직력",
          ...dustJobsLines,
          "",
          `※ 특이사항: ${d.specialNote ?? "-"}`,
          `※ 총 근무기간: ${d.totalDuration ?? "-"}`,
          "",
          "2. 재해발생경위",
          d.incidentNarrative ?? defaultIncident,
        ],
      },
      {
        heading: "III. 피재자에 대한 의학적 소견",
        paragraphs: [d.medicalOpinion ?? "(의료기관 진단 결과 — 입력 필요)"],
      },
      {
        heading: "IV. 청구인의 견해",
        paragraphs: [d.claimantView ?? defaultClaimantView],
      },
      {
        heading: "V. 결어",
        paragraphs: [d.conclusion ?? defaultConclusion],
      },
    ],
    signatureBlock: {
      dateText: fmtToday(),
      rows: [
        ["청 구 인", `${d.workerName} (인)`],
        [
          "대 리 인",
          d.agentName
            ? `${d.agentOfficeName ?? "노무법인 더보상"} 공인노무사 ${d.agentName}${
                d.agentLicenseNo ? ` (제 ${d.agentLicenseNo}호)` : ""
              } (인)`
            : "노무법인 더보상 (인)",
        ],
      ],
    },
    footnote:
      "※ 본 재해발생경위서는 산업재해보상보험법상 COPD 업무상질병 인정 신청 자료입니다.",
  };
}

export function copdInjuryIncidentFileName(d: CopdInjuryIncidentData): string {
  return `COPD_재해발생경위서_${d.workerName}_${fmtFileDate()}.pdf`;
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
    case "COPD_FACT_CONFIRM": {
      const d = data as unknown as CopdFactConfirmData;
      return { spec: buildCopdFactConfirm(d), fileName: copdFactConfirmFileName(d) };
    }
    case "COPD_INJURY_REPORT": {
      const d = data as unknown as CopdInjuryReportData;
      return { spec: buildCopdInjuryReport(d), fileName: copdInjuryReportFileName(d) };
    }
    case "COPD_INJURY_INCIDENT": {
      const d = data as unknown as CopdInjuryIncidentData;
      return { spec: buildCopdInjuryIncident(d), fileName: copdInjuryIncidentFileName(d) };
    }
    case "WAGE_CORRECTION_CLAIM":
      throw new Error(
        "WAGE_CORRECTION_CLAIM은 AvgWageNotice 기반 별도 라우트(/api/avg-wage/[id]/correction-pdf) 사용"
      );
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}
