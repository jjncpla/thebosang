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
};
