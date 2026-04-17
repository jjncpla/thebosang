export const ROOM_TYPE_LABELS = {
  schedule: "특진 일정방",
  tf_work: "TF 업무방",
  company_notice: "전사 공지방",
} as const;

export type RoomType = keyof typeof ROOM_TYPE_LABELS;
