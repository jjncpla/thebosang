export const ROOM_TYPE_LABELS = {
  schedule: "특진 일정방",
  tf_work: "TF 업무방",
  company_notice: "전사 공지방",
} as const;

export type RoomType = keyof typeof ROOM_TYPE_LABELS;

// Telegram MCP 학습 자료 — 채팅방 카테고리 라벨.
// tools/telegram-mcp/classify_dialogs.py 의 분류 결과와 동기화.
// 학습 코퍼스 인덱싱·필터 UI 등에서 라벨로 사용.
export const TELEGRAM_CHAT_CATEGORIES = {
  patient_1to1: "재해자 1:1",
  patient_family: "재해자 가족 단톡",
  kosha_officer: "공단 담당자",
  internal_branch: "더보상 지사/권역",
  internal_tf: "TF",
  internal_topic: "토픽방 (질환·업무)",
  external_partner: "외부 협력처",
  personal: "사적/친목/시스템",
  needs_review: "분류 보류",
} as const;

export type TelegramChatCategory = keyof typeof TELEGRAM_CHAT_CATEGORIES;
