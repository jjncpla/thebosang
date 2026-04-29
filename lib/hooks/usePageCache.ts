"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * stale-while-revalidate 캐싱 훅.
 * - 마운트 시 localStorage에서 즉시 데이터 표시 (흐린 화면 없음)
 * - 백그라운드에서 fresh fetch → 갱신
 * - 필터 변경 시 자동 재요청 + 별도 캐시 키
 * - AbortController로 race condition 방지
 *
 * 사용 예:
 * ```ts
 * const { data, loading, refreshing, error, refetch } = usePageCache<Patient[]>({
 *   cacheKey: "patients:" + JSON.stringify(filters),
 *   fetcher: async (signal) => {
 *     const res = await fetch(`/api/patients?${params}`, { signal });
 *     if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
 *     return res.json();
 *   },
 *   initial: [],
 * });
 * ```
 */
export type PageCacheState<T> = {
  data: T;
  loading: boolean;       // 캐시 없을 때 첫 fetch 중
  refreshing: boolean;    // 캐시 표시 중 백그라운드 갱신 중
  error: string | null;
  refetch: () => Promise<void>;
};

const CACHE_PREFIX = "tbss:page-cache:v1:";
const MAX_CACHE_BYTES = 4 * 1024 * 1024; // localStorage 5MB 한도, 안전 여유

export function usePageCache<T>({
  cacheKey,
  fetcher,
  initial,
  enabled = true,
}: {
  cacheKey: string;
  fetcher: (signal: AbortSignal) => Promise<T>;
  initial: T;
  enabled?: boolean;
}): PageCacheState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fullKey = CACHE_PREFIX + cacheKey;

  const refetch = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 캐시 즉시 표시
    let hadCache = false;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(fullKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setData(parsed);
          hadCache = true;
        }
      } catch { /* ignore */ }
    }

    if (hadCache) {
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetcher(controller.signal);
      setData(result);
      // 캐시 저장 (용량 초과 무시)
      if (typeof window !== "undefined") {
        try {
          const json = JSON.stringify(result);
          if (json.length <= MAX_CACHE_BYTES) {
            window.localStorage.setItem(fullKey, json);
          }
        } catch { /* quota exceeded → ignore */ }
      }
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fullKey, fetcher, enabled]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  return { data, loading, refreshing, error, refetch };
}
