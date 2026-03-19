export type WorkHistoryItem = {
  company: string;
  department: string;
  jobType: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  noiseExposure: boolean;
  noiseLevel: number | null;
  workHours: string;
  source: string;
};

export type WorkHistoryRawEntry = {
  company: string;
  department: string;
  jobType: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  noiseExposure: boolean;
  noiseLevel: number | null;
  workHours: string;
};

export type WorkHistoryRaw = {
  고용산재: WorkHistoryRawEntry[];
  건보: WorkHistoryRawEntry[];
  소득금액: WorkHistoryRawEntry[];
  연금: WorkHistoryRawEntry[];
  건근공: WorkHistoryRawEntry[];
  일용직: WorkHistoryRawEntry[];
};

// 일용직 직업력 항목
export type WorkHistoryDailyEntry = {
  company: string;       // 대표 사업장명 (또는 "다수")
  jobType: string;       // 직종
  totalDays: number;     // 총 근무일수
  startYear: number;     // 최초 근무 연도
  startMonth: number;    // 최초 근무 월
  convertedMonths: number; // 환산 개월수 (totalDays / 20, 올림)
  source: string;        // 출처 (고용산재, 건근공 등)
  memo: string;          // 비고
};
