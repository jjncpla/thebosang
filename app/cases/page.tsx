"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_STATUS, CASE_TYPE_LABELS } from "@/lib/constants/case";

type Patient = { id: string; name: string; ssn: string; phone: string | null };
type Case = {
  id: string;
  patientId: string;
  patient: Patient;
  caseType: string;
  caseNumber: string | null;
  tfName: string | null;
  branch: string | null;
  caseManager: string | null;
  receptionDate: string | null;
  status: string;
  createdAt: string;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  "접수대기": { bg: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca", dot: "#818cf8" },
  "접수완료": { bg: "#082f49", color: "#7dd3fc", border: "1px solid #0369a1", dot: "#38bdf8" },
  "특진예정": { bg: "#1a2e05", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "특진중":   { bg: "#052e16", color: "#6ee7b7", border: "1px solid #059669", dot: "#34d399" },
  "특진완료": { bg: "#052e16", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "재특진예정":{ bg: "#1e1b4b", color: "#c4b5fd", border: "1px solid #7c3aed", dot: "#a78bfa" },
  "재특진중":  { bg: "#2e1065", color: "#d8b4fe", border: "1px solid #9333ea", dot: "#c084fc" },
  "재특진완료":{ bg: "#2e1065", color: "#e9d5ff", border: "1px solid #7e22ce", dot: "#d8b4fe" },
  "재재특진예정":{ bg: "#3b1764", color: "#f0abfc", border: "1px solid #a21caf", dot: "#e879f9" },
  "재재특진중":  { bg: "#4a1942", color: "#f9a8d4", border: "1px solid #be185d", dot: "#f472b6" },
  "재재특진완료":{ bg: "#4a1942", color: "#fda4af", border: "1px solid #9f1239", dot: "#fb7185" },
  "전문예정": { bg: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dot: "#fbbf24" },
  "전문완료": { bg: "#451a03", color: "#fde68a", border: "1px solid #d97706", dot: "#fcd34d" },
  "승인":     { bg: "#052e16", color: "#86efac", border: "1px solid #16a34a", dot: "#4ade80" },
  "불승인":   { bg: "#450a0a", color: "#fca5a5", border: "1px solid #b91c1c", dot: "#f87171" },
  "반려":     { bg: "#450a0a", color: "#fca5a5", border: "1px solid #dc2626", dot: "#f87171" },
  "보류":     { bg: "#1c1917", color: "#d6d3d1", border: "1px solid #78716c", dot: "#a8a29e" },
  "파기":     { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOR[status] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

const BRANCHES = ["울산지사", "부산지사", "경남지사", "서울지사", "경기지사", "인천지사", "대구지사", "광주지사", "대전지사", "기타"];

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCaseType, setFilterCaseType] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const router = useRouter();

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCaseType) params.set("caseType", filterCaseType);
      if (filterBranch) params.set("branch", filterBranch);
      if (search) params.set("search", search);
      const res = await fetch(`/api/cases?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: Case[] = await res.json();
      setCases(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCases(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = cases.filter((c) => {
    const searchLower = search.toLowerCase();
    const nameMatch = !search || c.patient.name.toLowerCase().includes(searchLower) || c.patient.ssn.includes(search);
    const statusMatch = !filterStatus || c.status === filterStatus;
    const typeMatch = !filterCaseType || c.caseType === filterCaseType;
    const branchMatch = !filterBranch || c.branch === filterBranch;
    return nameMatch && statusMatch && typeMatch && branchMatch;
  });

  const COLUMNS = ["연번", "성명", "사건유형", "TF", "담당자", "진행상황", "접수일자", "지사"];

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>CASE MANAGEMENT</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>사건 목록</h1>
          {!loading && !error && (
            <span style={{ background: "#e0e7ff", color: "#3730a3", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
              {cases.length}건
            </span>
          )}
        </div>
      </div>

      {/* 필터 바 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <input
          type="text"
          placeholder="이름 또는 주민번호 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchCases()}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", outline: "none", width: 200, background: "#f9fafb" }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer" }}>
          <option value="">전체 진행상황</option>
          {CASE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCaseType} onChange={(e) => setFilterCaseType(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer" }}>
          <option value="">전체 사건유형</option>
          {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer" }}>
          <option value="">전체 지사</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={fetchCases} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer" }}>검색</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => router.push("/cases/new")} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + 새 사건 등록
        </button>
      </div>

      {/* 테이블 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {error && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", fontSize: 13, borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10 }}>
            ⚠ {error}
            <button onClick={fetchCases} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>다시 시도</button>
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
                {[30, 60, 80, 70, 70, 80, 80, 70].map((w, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}>
                    <div style={{ height: 12, background: "#f1f5f9", borderRadius: 4, width: w }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  {cases.length === 0 ? "등록된 사건이 없습니다" : "검색 결과가 없습니다"}
                </td>
              </tr>
            )}
            {!loading && filtered.map((c, idx) => (
              <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{c.patient.name}</td>
                <td style={{ padding: "12px 16px", color: "#374151" }}>{CASE_TYPE_LABELS[c.caseType] ?? c.caseType}</td>
                <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.tfName ?? "-"}</td>
                <td style={{ padding: "12px 16px", color: "#374151" }}>{c.caseManager ?? "-"}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(c.receptionDate ?? c.createdAt)}</td>
                <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.branch ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
