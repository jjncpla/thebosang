"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";

type PatientListItem = {
  id: string;
  name: string;
  ssn: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  _count: { cases: number };
  cases: { id: string; caseType: string; status: string }[];
};

function maskSsn(ssn: string): string {
  if (!ssn) return "-";
  return ssn.length > 8 ? ssn.slice(0, 8) + "******" : ssn;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CASE_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  HEARING_LOSS:         { bg: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  COPD:                 { bg: "#fdf4ff", color: "#7e22ce", border: "1px solid #e9d5ff" },
  PNEUMOCONIOSIS:       { bg: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" },
  MUSCULOSKELETAL:      { bg: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" },
  OCCUPATIONAL_ACCIDENT:{ bg: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  OCCUPATIONAL_CANCER:  { bg: "#fdf2f8", color: "#be185d", border: "1px solid #fbcfe8" },
  BEREAVED:             { bg: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" },
  OTHER:                { bg: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb" },
};

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (submittedSearch) params.set("search", submittedSearch);
      const res = await fetch(`/api/patients?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: PatientListItem[] = await res.json();
      setPatients(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [submittedSearch]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const handleSearch = () => setSubmittedSearch(search);

  const COLUMNS = ["연번", "성명", "주민번호", "연락처", "사건수", "상병", "등록일"];

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>PATIENT LIST</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>재해자 목록</h1>
            {!loading && !error && (
              <span style={{ background: "#e0e7ff", color: "#3730a3", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
                {patients.length}명
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push("/cases/new")}
          style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + 재해자 등록
        </button>
      </div>

      {/* Search */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <input
          type="text"
          placeholder="이름, 주민번호, 전화번호 뒷 4자리 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", outline: "none", width: 300, background: "#f9fafb" }}
        />
        <button
          onClick={handleSearch}
          style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          검색
        </button>
        {submittedSearch && (
          <button
            onClick={() => { setSearch(""); setSubmittedSearch(""); }}
            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
          >
            초기화
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {error && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", fontSize: 13, borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10 }}>
            ⚠ {error}
            <button onClick={fetchPatients} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>다시 시도</button>
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
              {COLUMNS.map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {COLUMNS.map((_, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}>
                    <div style={{ height: 12, background: "#f1f5f9", borderRadius: 4, width: 60 + (j % 3) * 20 }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && patients.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  {submittedSearch ? "검색 결과가 없습니다" : "등록된 재해자가 없습니다"}
                </td>
              </tr>
            )}
            {!loading && patients.map((p, idx) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/patients/${p.id}${p.cases[0] ? `?tab=${p.cases[0].caseType}` : ""}`)}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{p.name}</td>
                <td style={{ padding: "12px 16px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{maskSsn(p.ssn)}</td>
                <td style={{ padding: "12px 16px", color: "#374151" }}>{p.phone ?? "-"}</td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <span style={{ background: p._count.cases > 0 ? "#e0e7ff" : "#f1f5f9", color: p._count.cases > 0 ? "#3730a3" : "#9ca3af", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
                    {p._count.cases}건
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {p.cases.length === 0 ? (
                      <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>
                    ) : (
                      // 중복 caseType 제거
                      [...new Map(p.cases.map((c) => [c.caseType, c])).values()].map((c) => {
                        const col = CASE_TYPE_COLORS[c.caseType] ?? { bg: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb" };
                        return (
                          <span key={c.caseType} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: col.bg, color: col.color, border: col.border, whiteSpace: "nowrap" }}>
                            {CASE_TYPE_LABELS[c.caseType] ?? c.caseType}
                          </span>
                        );
                      })
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
