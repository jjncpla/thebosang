// types/claim.ts

export interface Worker {
  name: string;
  residentId: string;        // 주민등록번호
  birthDate: string;         // YYYY-MM-DD
  address: string;
  phone: string;
  accidentDate: string;      // YYYY-MM-DD
  workplaceName: string;     // 사업장명
  workplaceAddress: string;
}

export interface Payment {
  bankName: string;          // 은행명
  accountNumber: string;     // 계좌번호
  accountHolder: string;     // 예금주
  changeAccount: boolean;    // 계좌 변경 여부
}

export interface Confirm {
  preExistingDisability: boolean;    // 기존 장해 여부
  compensationReceived: boolean;     // 보상 수령 여부
  preExistingDetail?: string;        // 기존 장해 상세 내용
}

export interface TransportCost {
  amount: number;            // 교통비 금액
  usedTransport: boolean;    // 교통비 청구 여부
  transportDetail?: string;  // 교통 수단 및 내용
}

export interface Prevention {
  condition: string;         // 합병증 예방관리 상병
  hospital: string;          // 의료기관명
  treatmentPeriod?: string;  // 치료기간
}

export interface Claim {
  claimantName: string;      // 청구인 성명
  claimantRelation?: string; // 청구인과 재해자 관계 (본인/유족 등)
  agentName?: string;        // 대리인 성명
  agentRelation?: string;    // 대리인과의 관계
  phone: string;             // 연락처
  claimDate: string;         // 청구일 YYYY-MM-DD
}

export interface DisabilityClaimData {
  caseId: string;
  receiptNumber?: string;    // 접수번호 (공단 기재)
  worker: Worker;
  payment: Payment;
  confirm: Confirm;
  transportCost: TransportCost;
  prevention: Prevention;
  claim: Claim;
}

// 템플릿 렌더링 함수 시그니처
export type TemplateData = DisabilityClaimData & {
  [key: string]: unknown;
};