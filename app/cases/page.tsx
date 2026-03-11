"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const STATUS_LABEL: Record<NonNullable<CaseStatus>, string> = {
  RECEIVED:    "접수",
  IN_PROGRESS: "진행중",
  DONE:        "완료",
  HOLD:        "보류",
  CANCEL:      "취하",
};

type BadgeStyle = {
  background: string;
  color: string;
  border: string;
  dotColor: string;
};

function getStatusBadge(status: CaseStatus): { label: string; style: BadgeStyle } {
  const label = (status && STATUS_LABEL[status]) ?? "미지정";
  switch (status) {
    case "RECEIVED":
      return { label, style: { background: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca", dotColor: "#818cf8" } };
    case "IN_PROGRESS":
      return { label, style: { background: "#082f49", color: "#7dd3fc", border: "1px solid #0369a1", dotColor: "#38bdf8" } };
    case "DONE":
      return { label, style: { background: "#052e16", color: "#86efac", border: "1px solid #15803d", dotColor: "#4ade80" } };
    case "HOLD":
      return { label, style: { background: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dotColor: "#fbbf24" } };
    case "CANCEL":
      return { label, style: { background: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dotColor: "#64748b" } };
    default:
      return { label, style: { background: "#1e293b", color: "#64748b", border: "1px solid #334155", dotColor: "#475569" } };
  }
}

/* ═══════════════════════════════════════════════
   메인 페이지
═══════════════════════════════════════════════ */
export default function CasesPage() {
  const [cases,   setCases]   = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const router = useRouter();

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases");
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: Case[] = await res.json();
      setCases(data);
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

  const filtered = cases.filter((c) => {
    const person = c.persons?.[0];
    const searchLower = search.toLowerCase();
    const nameMatch =
      !search ||
      (person?.name || "").toLowerCase().includes(searchLower) ||
      c.title.toLowerCase().includes(searchLower);
    const statusMatch = !filterStatus || c.status === filterStatus;
    return nameMatch && statusMatch;
  });

  const COLUMNS = ["성명", "주민번호", "상병", "진행단계", "담당 TF", "담당자", "최근업데이트"];

  return (
    <div
      style={{
        padding: 24,
        minHeight: "100%",
        background: "#f1f5f9",
        fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
      }}
    >
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>
          CASE MANAGEMENT
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
            사건 목록
          </h1>
          {!loading && !error && (
            <span
              style={{
                background: "#e0e7ff",
                color: "#3730a3",
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: 999,
              }}
            >
              {cases.length}건
            </span>
          )}
        </div>
      </div>

      {/* 필터 바 */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <input
          type="text"
          placeholder="성명 또는 제목 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 13,
            color: "#374151",
            outline: "none",
            width: 200,
            background: "#f9fafb",
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 13,
            color: "#374151",
            outline: "none",
            background: "#f9fafb",
            cursor: "pointer",
          }}
        >
          <option value="">전체 진행단계</option>
          <option value="RECEIVED">접수</option>
          <option value="IN_PROGRESS">진행중</option>
          <option value="DONE">완료</option>
          <option value="HOLD">보류</option>
          <option value="CANCEL">취하</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + 신규 사건
        </button>
      </div>

      {/* 테이블 */}
      <div
        style={{
          background: "white",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: 13,
              borderBottom: "1px solid #fecaca",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            ⚠ {error}
            <button
              onClick={fetchCases}
              style={{
                color: "#2563eb",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                textDecoration: "underline",
              }}
            >
              다시 시도
            </button>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
              {COLUMNS.map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#6b7280",
                    letterSpacing: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 로딩 스켈레톤 */}
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {[60, 90, 100, 55, 70, 70, 75].map((w, j) => (
                    <td key={j} style={{ padding: "14px 16px" }}>
                      <div
                        style={{
                          height: 12,
                          background: "#f1f5f9",
                          borderRadius: 4,
                          width: w,
                          animation: "pulse 1.5s ease-in-out infinite",
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}

            {/* 빈 상태 */}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  style={{
                    padding: "48px 16px",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 14,
                  }}
                >
                  {cases.length === 0 ? "등록된 사건이 없습니다" : "검색 결과가 없습니다"}
                </td>
              </tr>
            )}

            {/* 데이터 행 */}
            {!loading &&
              filtered.map((c) => {
                const { label, style: bs } = getStatusBadge(c.status);
                const person = c.persons?.[0];

                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/cases/${c.id}`)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                  >
                    {/* 성명 */}
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>
                      {person?.name ?? (
                        <span style={{ color: "#d1d5db", fontStyle: "italic" }}>미등록</span>
                      )}
                    </td>
                    {/* 주민번호 */}
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace" }}>
                      -
                    </td>
                    {/* 상병 (title 표시) */}
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "#374151",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.title || "-"}
                    </td>
                    {/* 진행단계 뱃지 */}
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          ...bs,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: bs.dotColor,
                            flexShrink: 0,
                          }}
                        />
                        {label}
                      </span>
                    </td>
                    {/* 담당 TF */}
                    <td style={{ padding: "12px 16px", color: "#9ca3af" }}>-</td>
                    {/* 담당자 */}
                    <td style={{ padding: "12px 16px", color: "#374151" }}>-</td>
                    {/* 최근업데이트 */}
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "#9ca3af",
                        fontFamily: "monospace",
                        fontSize: 12,
                      }}
                    >
                      {formatDate(c.createdAt)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
