"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════
   타입 정의
═══════════════════════════════════════════════ */
type Person = {
  id: number;
  name: string;
  phone: string | null;
};

type CaseStatus =
  | "RECEIVED"
  | "IN_PROGRESS"
  | "DONE"
  | "HOLD"
  | "CANCEL"
  | null;

type Case = {
  id: number;
  title: string;
  status: CaseStatus;
  createdAt: string;
  persons: Person[];
};

/* ═══════════════════════════════════════════════
   유틸
═══════════════════════════════════════════════ */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

type StatusStyle = { dot: string; badge: string; label: string };

// 서버 ENUM → 한글 레이블 변환 테이블
const STATUS_LABEL: Record<NonNullable<CaseStatus>, string> = {
  RECEIVED:    "접수",
  IN_PROGRESS: "진행중",
  DONE:        "완료",
  HOLD:        "보류",
  CANCEL:      "취하",
};

function getStatusStyle(status: CaseStatus): StatusStyle {
  const label = (status && STATUS_LABEL[status]) ?? "미지정";

  switch (label) {
    case "접수": return {
      dot:   "bg-violet-400",
      badge: "bg-violet-950 text-violet-300 ring-1 ring-violet-700",
      label: "접수",
    };
    case "진행중": return {
      dot:   "bg-sky-400",
      badge: "bg-sky-950 text-sky-300 ring-1 ring-sky-700",
      label: "진행중",
    };
    case "완료": return {
      dot:   "bg-emerald-400",
      badge: "bg-emerald-950 text-emerald-300 ring-1 ring-emerald-700",
      label: "완료",
    };
    case "보류": return {
      dot:   "bg-amber-400",
      badge: "bg-amber-950 text-amber-300 ring-1 ring-amber-700",
      label: "보류",
    };
    case "취하": return {
      dot:   "bg-slate-500",
      badge: "bg-slate-800 text-slate-400 ring-1 ring-slate-600",
      label: "취하",
    };
    default: return {
      dot:   "bg-slate-600",
      badge: "bg-slate-800 text-slate-500 ring-1 ring-slate-600",
      label: "미지정",
    };
  }
}

/* ═══════════════════════════════════════════════
   스켈레톤 — 리스트 아이템
═══════════════════════════════════════════════ */
function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-b border-slate-800 animate-pulse">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="h-3 bg-slate-700 rounded w-3/5" />
            <div className="h-4 bg-slate-800 rounded-full w-12" />
          </div>
          <div className="h-2.5 bg-slate-800 rounded w-2/5" />
        </div>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════
   스켈레톤 — 상세 패널
═══════════════════════════════════════════════ */
function DetailSkeleton() {
  return (
    <div className="p-8 animate-pulse space-y-6">
      <div className="h-6 bg-slate-200 rounded w-1/2" />
      <div className="h-4 bg-slate-100 rounded w-1/4" />
      <div className="h-px bg-slate-200 w-full" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 bg-slate-100 rounded w-1/3" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   메인 페이지
═══════════════════════════════════════════════ */
export default function CasesPage() {
  const [cases,        setCases]        = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // fetch 로직을 함수로 분리 → 재시도 버튼에서도 동일하게 호출
  const fetchCases = async () => {
    if (loading) return; // 🔥 추가
      setLoading(true);
  setError(null);
    try {
      const res = await fetch("/api/cases");
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: Case[] = await res.json();
      setCases(data);
      // 기존 선택 유지, 없으면 첫 항목, 목록에서 사라졌으면 첫 항목으로 fallback
      if (data.length > 0) {
        setSelectedCase(prev => {
          if (!prev) return data[0];
          return data.find(c => c.id === prev.id) ?? data[0];
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 상태 변경 (낙관적 업데이트 → 실패 시 롤백) ──
  const updateStatus = async (newStatus: NonNullable<CaseStatus>) => {
  if (!selectedCase || statusUpdating) return;

  setStatusUpdating(true);

    // 낙관적 업데이트: 응답 전에 UI 먼저 반영
    const optimistic = { ...selectedCase, status: newStatus };
    setSelectedCase(optimistic);
    setCases(prev => prev.map(c => c.id === selectedCase.id ? optimistic : c));

    try {
      const res = await fetch(`/api/cases/${selectedCase.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const updated: Case = await res.json();
      // 서버 응답으로 최종 확정
      setSelectedCase(updated);
      setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch {
      // 실패 시 원래 상태로 롤백
      setSelectedCase(selectedCase);
      setCases(prev => prev.map(c => c.id === selectedCase.id ? selectedCase : c));
    } finally {
      setStatusUpdating(false);
    }
  };

  // persons 배열이 없거나 비어있을 경우를 대비한 null-safe 처리
  const mainPerson = selectedCase?.persons?.[0] ?? null;

  return (
    /* 전체 래퍼 — 뷰포트 높이 고정, 스크롤 없음 */
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden">

      {/* ══════════════════════════════════════
          좌측 패널 — 케이스 리스트 (30%)
      ══════════════════════════════════════ */}
      <aside
        className="flex flex-col border-r border-slate-800"
        style={{ width: "30%", minWidth: "280px" }}
      >
        {/* 사이드바 헤더 */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase mb-0.5">
                Case Management
              </p>
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                케이스 목록
              </h1>
            </div>
            {!loading && !error && (
              <span className="flex items-center justify-center w-7 h-7 rounded-full
                               bg-slate-800 text-slate-400 text-xs font-bold tabular-nums">
                {cases.length}
              </span>
            )}
          </div>
        </div>

        {/* 리스트 바디 */}
        <div className="flex-1 overflow-y-auto bg-slate-900 scrollbar-thin
                        scrollbar-track-slate-900 scrollbar-thumb-slate-700">

          {/* 에러 */}
          {error && (
            <div className="m-4 rounded-lg bg-red-950 border border-red-800
                            text-red-400 text-xs px-4 py-3 space-y-2">
              <div>⚠ {error}</div>
              <button
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  fetchCases();
                }}
                className="mt-1 inline-flex items-center gap-1.5 rounded px-2.5 py-1
                           bg-red-900 hover:bg-red-800 text-red-300 text-xs
                           font-semibold transition-colors"
              >
                ↺ 다시 시도
              </button>
            </div>
          )}

          {/* 로딩 */}
          {loading && <ListSkeleton />}

          {/* 데이터 없음 */}
          {!loading && !error && cases.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full
                            gap-2 py-24 text-slate-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5
                     A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0
                     00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5
                     2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0
                     .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504
                     1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="text-sm">데이터 없음</span>
            </div>
          )}

          {/* 케이스 목록 */}
          {!loading && !error && cases.map((c) => {
            const isSelected = selectedCase?.id === c.id;
            const st         = getStatusStyle(c.status);
            const person     = c.persons?.[0];

            return (
              <button
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className={[
                  "w-full text-left px-4 py-4 border-b border-slate-800/60",
                  "transition-all duration-150 group relative",
                  isSelected
                    ? "bg-slate-800 border-l-2 border-l-sky-500"
                    : "hover:bg-slate-800/60 border-l-2 border-l-transparent",
                ].join(" ")}
              >
                {/* 제목 + 상태 뱃지 */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className={[
                    "text-sm font-semibold leading-snug line-clamp-1",
                    isSelected ? "text-slate-100" : "text-slate-300 group-hover:text-slate-100",
                  ].join(" ")}>
                    {c.title || "제목 없음"}
                  </span>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1
                                    rounded-full px-2 py-0.5 text-[10px] font-bold
                                    tracking-wide ${st.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>

                {/* 재해자 + 날짜 */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 group-hover:text-slate-400
                                   transition-colors">
                    {person?.name ? (
                      <>
                        <span className="text-slate-600 mr-1">👤</span>
                        {person.name}
                      </>
                    ) : (
                      <span className="text-slate-700 italic">재해자 미등록</span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-slate-700
                                   group-hover:text-slate-600 transition-colors flex-shrink-0">
                    {formatDate(c.createdAt)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ══════════════════════════════════════
          우측 패널 — 케이스 상세 (70%)
      ══════════════════════════════════════ */}
      <main
        className="flex flex-col bg-slate-50 overflow-y-auto"
        style={{ width: "70%" }}
      >
        {loading ? (
          <DetailSkeleton />
        ) : !selectedCase ? (
          /* 선택 없음 안내 */
          <div className="flex flex-col items-center justify-center h-full
                          gap-3 text-slate-400">
            <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0
                   002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424
                   48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664
                   0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25
                   0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012
                   0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095
                   4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504
                   -1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0
                   1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25
                   zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0
                   3h.008v.008H6.75V18z" />
            </svg>
            <p className="text-sm">케이스를 선택해주세요</p>
          </div>
        ) : (
          /* ── 상세 콘텐츠 ── */
          <div className="flex-1 px-8 py-8 space-y-6 max-w-3xl">

            {/* 상단: ID + 제목 + 상태 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-slate-400 bg-slate-200
                                 px-2 py-0.5 rounded">
                  #{selectedCase.id}
                </span>
                {(() => {
                  const st = getStatusStyle(selectedCase.status);
                  return (
                    <span className={`inline-flex items-center gap-1.5 rounded-full
                                      px-3 py-1 text-xs font-bold tracking-wide
                                      ${st.badge}`}>
                      <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  );
                })()}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 leading-snug tracking-tight">
                {selectedCase.title || "제목 없음"}
              </h2>

              {/* ── 상태 변경 버튼 ── */}
              {(selectedCase.status === "RECEIVED" || selectedCase.status === "IN_PROGRESS") && (
                <div className="mt-4 flex items-center gap-2">
                  {selectedCase.status === "RECEIVED" && (
                    <button
                      disabled={statusUpdating}
                      onClick={() => updateStatus("IN_PROGRESS")}
                      className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2
                                 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900
                                 disabled:text-sky-600 text-white text-sm font-semibold
                                 transition-colors"
                    >
                      {statusUpdating ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83
                            M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83
                            M16.24 7.76l2.83-2.83" />
                        </svg>
                      ) : "→"}
                      진행중으로 변경
                    </button>
                  )}
                  {selectedCase.status === "IN_PROGRESS" && (
                    <button
                      disabled={statusUpdating}
                      onClick={() => updateStatus("DONE")}
                      className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2
                                 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950
                                 disabled:text-emerald-700 text-white text-sm font-semibold
                                 transition-colors"
                    >
                      {statusUpdating ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83
                            M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83
                            M16.24 7.76l2.83-2.83" />
                        </svg>
                      ) : "✓"}
                      완료로 변경
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 구분선 */}
            <hr className="border-slate-200" />

            {/* 기본 정보 카드 */}
            <div className="rounded-2xl bg-white border border-slate-200
                            shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
                <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                  기본 정보
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
                <InfoCell label="케이스 ID">
                  <span className="font-mono text-slate-800">#{selectedCase.id}</span>
                </InfoCell>
                <InfoCell label="상태">
                  {(() => {
                    const st = getStatusStyle(selectedCase.status);
                    return (
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                        <span className="text-slate-800 font-medium">{st.label}</span>
                      </span>
                    );
                  })()}
                </InfoCell>
                <InfoCell label="등록일시" className="border-t border-slate-100">
                  <span className="font-mono text-slate-700 text-sm">
                    {formatDateTime(selectedCase.createdAt)}
                  </span>
                </InfoCell>
                <InfoCell label="등록인원" className="border-t border-slate-100">
                  <span className="text-slate-800 font-medium">
                    {selectedCase.persons?.length ?? 0}명
                  </span>
                </InfoCell>
              </div>
            </div>

            {/* 재해자 정보 카드 */}
            <div className="rounded-2xl bg-white border border-slate-200
                            shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
                <h3 className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                  재해자 정보
                </h3>
              </div>

              {(!selectedCase.persons || selectedCase.persons.length === 0) ? (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">
                  등록된 재해자가 없습니다
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {selectedCase.persons.map((person, idx) => (
                    <li key={person.id}
                        className="flex items-center justify-between px-5 py-4 gap-4">
                      {/* 아바타 + 이름 */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center
                                        justify-center text-sm font-bold text-slate-300
                                        flex-shrink-0 select-none">
                          {person.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {person.name}
                            </span>
                            {idx === 0 && (
                              <span className="flex-shrink-0 text-[10px] font-bold
                                               text-sky-700 bg-sky-50 ring-1 ring-sky-200
                                               px-1.5 py-0.5 rounded-full">
                                주재해자
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">
                            ID: {person.id}
                          </p>
                        </div>
                      </div>

                      {/* 연락처 */}
                      <div className="flex-shrink-0">
                        {person.phone ? (
                          <a href={`tel:${person.phone}`}
                             className="inline-flex items-center gap-1.5 text-sm
                                        font-mono text-slate-700 hover:text-sky-600
                                        transition-colors">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none"
                                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25
                                   0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091
                                   l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97
                                   1.293c-.282.376-.769.542-1.21.38a12.035 12.035
                                   0 01-7.143-7.143c-.162-.441.004-.928.38-1.21
                                   l1.293-.97c.363-.271.527-.734.417-1.173L6.963
                                   3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25
                                   0 002.25 4.5v2.25z" />
                            </svg>
                            {person.phone}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 italic">연락처 없음</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   보조 컴포넌트
═══════════════════════════════════════════════ */
function InfoCell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      <dt className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">
        {label}
      </dt>
      <dd className="text-sm text-slate-700">{children}</dd>
    </div>
  );
}
