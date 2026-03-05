// lib/mockDb.ts

import { DisabilityClaimData } from '@/types/claim';

const mockCases: Record<string, DisabilityClaimData> = {
  'CASE-2024-001': {
    caseId: 'CASE-2024-001',
    receiptNumber: '',
    worker: {
      name: '홍길동',
      residentId: '800101-1234567',
      birthDate: '1980-01-01',
      address: '서울특별시 강남구 테헤란로 123, 456호',
      phone: '010-1234-5678',
      accidentDate: '2024-03-15',
      workplaceName: '(주)테스트건설',
      workplaceAddress: '경기도 성남시 분당구 판교로 100',
    },
    payment: {
      bankName: '국민은행',
      accountNumber: '123-456-789012',
      accountHolder: '홍길동',
      changeAccount: false,
    },
    confirm: {
      preExistingDisability: false,
      compensationReceived: false,
      preExistingDetail: '',
    },
    transportCost: {
      amount: 45000,
      usedTransport: true,
      transportDetail: '버스·지하철 이용 (자택 → 병원 왕복 3회)',
    },
    prevention: {
      condition: '요추 추간판 탈출증',
      hospital: '서울대학교병원',
      treatmentPeriod: '2024-03-20 ~ 2024-06-30',
    },
    claim: {
      claimantName: '홍길동',
      claimantRelation: '본인',
      agentName: '',
      agentRelation: '',
      phone: '010-1234-5678',
      claimDate: '2024-07-01',
    },
  },
  'CASE-2024-002': {
    caseId: 'CASE-2024-002',
    receiptNumber: '',
    worker: {
      name: '김철수',
      residentId: '750515-1098765',
      birthDate: '1975-05-15',
      address: '부산광역시 해운대구 해운대로 200',
      phone: '010-9876-5432',
      accidentDate: '2023-11-20',
      workplaceName: '(주)한국제조',
      workplaceAddress: '경상남도 창원시 성산구 공단로 50',
    },
    payment: {
      bankName: '신한은행',
      accountNumber: '110-234-567890',
      accountHolder: '김철수',
      changeAccount: true,
    },
    confirm: {
      preExistingDisability: true,
      compensationReceived: false,
      preExistingDetail: '우측 어깨 회전근개 파열 (2020년)',
    },
    transportCost: {
      amount: 0,
      usedTransport: false,
      transportDetail: '',
    },
    prevention: {
      condition: '우측 상완골 골절',
      hospital: '부산대학교병원',
      treatmentPeriod: '2023-11-25 ~ 2024-04-30',
    },
    claim: {
      claimantName: '김영희',
      claimantRelation: '배우자',
      agentName: '김영희',
      agentRelation: '배우자',
      phone: '010-1111-2222',
      claimDate: '2024-05-10',
    },
  },
    'CASE-TEST': {
    caseId: 'CASE-TEST',
    worker: {
      name: '테스트',
      residentId: '900101-1234567',
      birthDate: '1990-01-01',
      address: '서울시 테스트구',
      phone: '010-0000-0000',
      accidentDate: '2024-01-01',
      workplaceName: '테스트회사',
      workplaceAddress: '서울시 테스트로 1'
    },
    payment: {
      bankName: '국민은행',
      accountNumber: '123-456-7890',
      accountHolder: '테스트',
      changeAccount: false
    },
    confirm: {
      preExistingDisability: false,
      compensationReceived: false
    },
    transportCost: {
      amount: 0,
      usedTransport: false
    },
    prevention: {
      condition: '',
      hospital: ''
    },
    claim: {
      claimantName: '테스트',
      phone: '010-0000-0000',
      claimDate: '2024-01-02'
    }
  }
};
console.log('mockCases keys:', Object.keys(mockCases));

export function getCaseById(caseId: string) {
  return mockCases[caseId];
}