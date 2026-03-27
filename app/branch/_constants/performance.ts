export const CASE_TYPES = [
  { id: 'pneumoconiosis',     label: '진폐최초' },
  { id: 'copd',               label: 'COPD' },
  { id: 'hearingLoss',        label: '소음성난청' },
  { id: 'wageCorrection',     label: '평균임금정정' },
  { id: 'disabilityPayment',  label: '진/사미장' },
  { id: 'litigation',         label: '병형소송' },
  { id: 'musculoskeletal',    label: '근골격계' },
  { id: 'cerebrovascular',    label: '뇌심혈관계' },
  { id: 'occupationalCancer', label: '직업성암' },
  { id: 'accident',           label: '사고/출퇴근' },
  { id: 'project',            label: '프로젝트' },
  { id: 'other',              label: '기타' },
] as const

export type CaseTypeId = typeof CASE_TYPES[number]['id']

export const BRANCH_STAFF_MAP: Record<string, string[]> = {
  '울산지사': ['김경록', '허흔', '조홍래', '김지수', '김슬기', '문유빈', '박규리', '김영은'],
}

export const QUARTER_MONTHS: Record<number, [number, number, number]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
}
