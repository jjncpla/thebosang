/**
 * 통합 캘린더 webhook idempotency 헬퍼
 *
 * 사용 패턴:
 * 1) recordWebhookEvent(...) 호출 → 이미 처리된 이벤트면 'duplicate_skipped' 반환
 * 2) 본 처리 실행
 * 3) markWebhookProcessed(...) 또는 markWebhookFailed(...) 호출
 *
 * 핵심:
 * - (source, externalId) unique 제약으로 race condition 방지
 * - rollback / 모니터링을 위해 원본 payload 보존
 * - cron backup-poll에서도 동일 헬퍼 재사용
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type WebhookSource =
  | "telegram"
  | "telegram_special_clinic"
  | "google_calendar"
  | "kwc_calendar"
  | string; // 향후 확장 허용

export type RecordResult =
  | { status: "new"; eventId: string }
  | { status: "duplicate_skipped"; eventId: string };

/**
 * Webhook 이벤트를 WebhookEvent 테이블에 기록한다.
 * - 동일 (source, externalId) 가 이미 존재하면 중복으로 판단하고 skip 반환.
 * - 신규면 신규 record id를 반환.
 *
 * @param source 외부 시스템 식별자
 * @param externalId 외부 시스템의 고유 ID (telegram message_id, gcal event id 등)
 * @param payload 원본 webhook 페이로드 (전체 body 보존 권장)
 * @param eventType 이벤트 분류 (선택)
 */
export async function recordWebhookEvent(
  source: WebhookSource,
  externalId: string,
  payload: unknown,
  eventType?: string,
): Promise<RecordResult> {
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        source,
        externalId,
        eventType: eventType ?? null,
        // 외부 webhook payload는 임의의 JSON. Prisma.InputJsonValue 로 캐스팅.
        payload: payload as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { status: "new", eventId: created.id };
  } catch (e: unknown) {
    // P2002 = Unique constraint violation → 이미 수신된 이벤트
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.webhookEvent.findUnique({
        where: { source_externalId: { source, externalId } },
        select: { id: true },
      });
      return {
        status: "duplicate_skipped",
        eventId: existing?.id ?? "",
      };
    }
    throw e;
  }
}

/**
 * Webhook 이벤트의 처리 완료를 기록.
 * @param processedBy "webhook" | "cron_backup"
 */
export async function markWebhookProcessed(
  source: WebhookSource,
  externalId: string,
  processedBy: "webhook" | "cron_backup",
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { source_externalId: { source, externalId } },
    data: {
      processedAt: new Date(),
      processedBy,
      errorMessage: null,
    },
  });
}

/**
 * Webhook 이벤트의 처리 실패를 기록.
 * - retries 카운트 증가
 * - errorMessage 보존 (재처리 시 디버깅용)
 */
export async function markWebhookFailed(
  source: WebhookSource,
  externalId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { source_externalId: { source, externalId } },
    data: {
      errorMessage: errorMessage.slice(0, 2000), // 너무 긴 에러는 잘라서 저장
      retries: { increment: 1 },
    },
  });
}

/**
 * 미처리 이벤트 목록 (cron backup-poll에서 재시도 대상 조회 등에 사용).
 * - retries < maxRetries
 * - processedAt = null
 */
export async function findUnprocessedEvents(
  source: WebhookSource,
  options: { maxRetries?: number; limit?: number } = {},
) {
  const { maxRetries = 5, limit = 100 } = options;
  return prisma.webhookEvent.findMany({
    where: {
      source,
      processedAt: null,
      retries: { lt: maxRetries },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}
