"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";
import { useBranches } from "@/lib/hooks/useBranches";

type ContactItem = {
  id: string;
  name: string;
  branch: string;
  title: string;
  jobGrade: string;
  mobile: string;
  hireDate: string | null;
};

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
  const { tfByBranch: TF_BY_BRANCH } = useBranches();
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";

  useEffect(() => {
    if (status === "authenticated" && role !== "ADMIN") {
      router.replace("/cases");
    }
  }, [status, role, router]);

  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [filterTf, setFilterTf] = useState("");

  // 임직원 검색
  const [empSearch, setEmpSearch] = useState("");
  const [empSubmitted, setEmpSubmitted] = useState("");
  const [empResults, setEmpResults] = useState<ContactItem[]>([]);
  const [empLoading, setEmpLoading] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (submittedSearch) params.set("search", submittedSearch);
      if (filterTf) params.set("tfName", filterTf);
      const res = await fetch(`/api/patients?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: PatientListItem[] = await res.json();
      setPatients(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [submittedSearch, filterTf]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const handleSearch = () => setSubmittedSearch(search);

  const fetchEmployees = useCallback(async () => {
    if (!empSubmitted) { setEmpResults([]); return; }
    setEmpLoading(true);
    try {
      const params = new URLSearchParams({ firmType: "TBOSANG", search: empSubmitted });
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setEmpResults(data.contacts || []);
    } finally {
      setEmpLoading(false);
    }
  }, [empSubmitted]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleEmpSearch = () => setEmpSubmitted(empSearch);

  const COLUMNS = ["연번", "성명", "주민번호", "연락처", "사건수", "상병", "등록일"];
  const EMP_COLUMNS = ["이름", "소속", "직책", "직군", "핸드폰번호", "입사일"];

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>PATIENT LIST</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: 0 }}>재해자 목록</h1>
            {!loading && !error && (
              <span style={{ background: "#e0e7ff", color: "#3730a3", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
                {patients.length}명
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push("/cases/new")}
          style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + 재해자 등록
        </button>
      </div>

      {/* Search */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {/* 재해자 검색 */}
        <input
          type="text"
          placeholder="이름, 주민번호, 전화번호 뒷 4자리 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", outline: "none", width: 280, background: "#f9fafb" }}
        />
        <button
          onClick={handleSearch}
          style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          재해자 검색
        </button>
        <select
          value={filterTf}
          onChange={(e) => setFilterTf(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer" }}
        >
          <option value="">TF 전체</option>
          {Object.entries(TF_BY_BRANCH).map(([branch, tfs]) => (
            <optgroup key={branch} label={branch}>
              {tfs.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </optgroup>
          ))}
        </select>
        {submittedSearch && (
          <button
            onClick={() => { setSearch(""); setSubmittedSearch(""); }}
            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
          >
            초기화
          </button>
        )}

        {/* 구분선 */}
        <div style={{ width: 1, height: 28, background: "#e5e7eb", margin: "0 4px" }} />

        {/* 임직원 검색 */}
        <input
          type="text"
          placeholder="임직원 이름 검색..."
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEmpSearch()}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", outline: "none", width: 180, background: "#f9fafb" }}
        />
        <button
          onClick={handleEmpSearch}
          style={{ background: "#005530", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          임직원 검색
        </button>
        {empSubmitted && (
          <button
            onClick={() => { setEmpSearch(""); setEmpSubmitted(""); setEmpResults([]); }}
            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
          >
            초기화
          </button>
        )}
      </div>

      {/* 임직원 검색 결과 */}
      {empSubmitted && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <div style={{ padding: "10px 16px", background: "#f0fdf4", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#005530" }}>임직원 검색 결과</span>
            {!empLoading && (
              <span style={{ background: "#d1fae5", color: "#065f46", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                {empResults.length}명
              </span>
            )}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#005530", borderBottom: "2px solid #004425" }}>
                {EMP_COLUMNS.map((h) => (
                  <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empLoading && (
                <tr><td colSpan={EMP_COLUMNS.length} style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>검색 중...</td></tr>
              )}
              {!empLoading && empResults.length === 0 && (
                <tr><td colSpan={EMP_COLUMNS.length} style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>검색 결과가 없습니다</td></tr>
              )}
              {!empLoading && empResults.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "#111827" }}>{c.name}</td>
                  <td style={{ padding: "10px 16px", color: "#374151" }}>{c.branch || "-"}</td>
                  <td style={{ padding: "10px 16px", color: "#374151" }}>{c.title || "-"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {c.jobGrade ? (
                      <span style={{ background: "#f0fdf4", color: "#065f46", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid #d1fae5" }}>
                        {c.jobGrade}
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#374151", fontFamily: "monospace", fontSize: 12 }}>{c.mobile || "-"}</td>
                  <td style={{ padding: "10px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{c.hireDate ? formatDate(c.hireDate) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {error && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", fontSize: 13, borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10 }}>
            ⚠ {error}
            <button onClick={fetchPatients} style={{ color: "#29ABE2", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>다시 시도</button>
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#29ABE2", borderBottom: "2px solid #1A8BBF" }}>
              {COLUMNS.map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
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
