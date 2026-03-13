import { CASE_STATUS, DISPOSAL_TYPE, GRADE_TYPE } from "./case";
import { ALL_STAFF } from "./staff";
import { FIRST_CLINICS_HEARING, SPECIAL_CLINICS_HEARING, EXPERT_ORGS } from "./hospitals";

export type FilterFieldType =
  | "select"
  | "multi_select"
  | "text"
  | "boolean"
  | "number_range"
  | "date_single_or_range";

export type FilterField = {
  field: string;
  table: "case" | "hearingLoss";
  label: string;
  type: FilterFieldType;
  options?: readonly string[];
};

export const COMMON_FILTERS: FilterField[] = [
  { field: "status", table: "hearingLoss", label: "진행상황", type: "multi_select", options: CASE_STATUS },
  { field: "salesManager", table: "case", label: "영업 담당자", type: "select", options: ALL_STAFF },
  { field: "salesRoute", table: "case", label: "영업 경로", type: "text" },
  { field: "isOneStop", table: "case", label: "원스톱", type: "boolean" },
  { field: "contractDate", table: "case", label: "약정일자", type: "date_single_or_range" },
  { field: "receptionDate", table: "case", label: "접수일자", type: "date_single_or_range" },
];

export const HEARING_LOSS_FILTERS: FilterField[] = [
  { field: "disposalType", table: "hearingLoss", label: "처분결과", type: "multi_select", options: DISPOSAL_TYPE },
  { field: "gradeType", table: "hearingLoss", label: "장해등급 유형", type: "multi_select", options: GRADE_TYPE },
  { field: "grade", table: "hearingLoss", label: "장해등급", type: "number_range" },
  { field: "disposalReceivedAt", table: "hearingLoss", label: "처분수신일", type: "date_single_or_range" },
  { field: "specialClinic", table: "hearingLoss", label: "특진병원", type: "select", options: SPECIAL_CLINICS_HEARING },
  { field: "firstClinic", table: "hearingLoss", label: "초진병원", type: "select", options: FIRST_CLINICS_HEARING },
  { field: "expertOrg", table: "hearingLoss", label: "전문조사기관", type: "select", options: EXPERT_ORGS },
  { field: "airRight1", table: "hearingLoss", label: "기도 우측(최초)", type: "number_range" },
  { field: "airLeft1", table: "hearingLoss", label: "기도 좌측(최초)", type: "number_range" },
];

export const FILTER_DEFINITIONS_BY_TYPE: Record<string, FilterField[]> = {
  HEARING_LOSS: [...COMMON_FILTERS, ...HEARING_LOSS_FILTERS],
};
