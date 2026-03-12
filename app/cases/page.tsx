"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";
import { TF_BY_BRANCH } from "@/lib/constants/tf";
import {
  FILTER_DEFINITIONS_BY_TYPE,
  FilterField,
} from "@/lib/constants/case-filter-definitions";

// ─── Types ───────────────────────────────────────────────────────────────────

type Patient = { id: string; name: string; ssn: string; phone: string | null };
type HearingLoss = {
  firstClinic: string | null;
  specialClinic: string | null;
  disposalType: string | null;
  grade: number | null;
  gradeType: string | null;
};
type Case = {
  id: string;
  patientId: string;
  patient: Patient;
  caseType: string;
  caseNumber: string | null;
  tfName: string | null;
  branch: string | null;
  salesManager: string | null;
  caseManager: string | null;
  receptionDate: string | null;
  status: string;
  createdAt: string;
  hearingLoss: HearingLoss | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  "접수대기":    { bg: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca", dot: "#818cf8" },
  "접수완료":    { bg: "#082f49", color: "#7dd3fc", border: "1px solid #0369a1", dot: "#38bdf8" },
  "특진예정":    { bg: "#1a2e05", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "특진중":      { bg: "#052e16", color: "#6ee7b7", border: "1px solid #059669", dot: "#34d399" },
  "특진완료":    { bg: "#052e16", color: "#86efac", border: "1px solid #15803d", dot: "#4ade80" },
  "재특진예정":  { bg: "#1e1b4b", color: "#c4b5fd", border: "1px solid #7c3aed", dot: "#a78bfa" },
  "재특진중":    { bg: "#2e1065", color: "#d8b4fe", border: "1px solid #9333ea", dot: "#c084fc" },
  "재특진완료":  { bg: "#2e1065", color: "#e9d5ff", border: "1px solid #7e22ce", dot: "#d8b4fe" },
  "재재특진예정":{ bg: "#3b1764", color: "#f0abfc", border: "1px solid #a21caf", dot: "#e879f9" },
  "재재특진중":  { bg: "#4a1942", color: "#f9a8d4", border: "1px solid #be185d", dot: "#f472b6" },
  "재재특진완료":{ bg: "#4a1942", color: "#fda4af", border: "1px solid #9f1239", dot: "#fb7185" },
  "전문예정":    { bg: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dot: "#fbbf24" },
  "전문완료":    { bg: "#451a03", color: "#fde68a", border: "1px solid #d97706", dot: "#fcd34d" },
  "승인":        { bg: "#052e16", color: "#86efac", border: "1px solid #16a34a", dot: "#4ade80" },
  "불승인":      { bg: "#450a0a", color: "#fca5a5", border: "1px solid #b91c1c", dot: "#f87171" },
  "반려":        { bg: "#450a0a", color: "#fca5a5", border: "1px solid #dc2626", dot: "#f87171" },
  "보류":        { bg: "#1c1917", color: "#d6d3d1", border: "1px solid #78716c", dot: "#a8a29e" },
  "파기":        { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" },
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

// ─── Jurisdiction Modal ───────────────────────────────────────────────────────

function JurisdictionModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "white", borderRadius: 12, padding: 24, zIndex: 1000,
        maxWidth: 720, width: "90%", maxHeight: "80vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>관할표</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#6b7280", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>지사</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#6b7280", borderBottom: "2px solid #e5e7eb" }}>담당 TF</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(TF_BY_BRANCH).map(([branch, tfs]) => (
              <tr key={branch} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{branch}</td>
                <td style={{ padding: "8px 12px", color: "#6b7280", lineHeight: 1.7 }}>{tfs.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Filter value key helpers ─────────────────────────────────────────────────

function paramKey(f: FilterField, suffix?: string): string {
  const base = f.table === "hearingLoss" ? `hl_${f.field}` : f.field;
  return suffix ? `${base}_${suffix}` : base;
}

// ─── Single filter control ────────────────────────────────────────────────────

function FilterControl({
  field,
  value,
  onChange,
}: {
  field: FilterField;
  value: Record<string, string>;
  onChange: (updates: Record<string, string>) => void;
}) {
  const [dateMode, setDateMode] = useState<"single" | "range">("single");

  const inputStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 12,
    color: "#374151",
    background: "#f9fafb",
    outline: "none",
  };

  if (field.type === "multi_select") {
    const key = paramKey(field);
    const current = value[key] ?? "";
    const selected = current ? current.split(",").filter(Boolean) : [];

    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt];
      onChange({ [key]: next.join(",") });
    };

    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(field.options ?? []).map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  borderRadius: 999,
                  border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
                  background: active ? "#eff6ff" : "#f9fafb",
                  color: active ? "#2563eb" : "#374151",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    const key = paramKey(field);
    const listId = `dl-${field.table}-${field.field}`;
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            list={listId}
            style={{ ...inputStyle, width: 200 }}
            placeholder={`${field.label} 검색...`}
            value={value[key] ?? ""}
            onChange={(e) => onChange({ [key]: e.target.value })}
          />
          {value[key] && (
            <button
              onClick={() => onChange({ [key]: "" })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>
        <datalist id={listId}>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </div>
    );
  }

  if (field.type === "text") {
    const key = paramKey(field);
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <input
          style={{ ...inputStyle, width: 140 }}
          placeholder={field.label}
          value={value[key] ?? ""}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    const key = paramKey(field);
    const cur = value[key] ?? "";
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["", "true", "false"].map((v) => {
            const label = v === "" ? "전체" : v === "true" ? "예" : "아니오";
            const active = cur === v;
            return (
              <button
                key={v}
                onClick={() => onChange({ [key]: v })}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  borderRadius: 999,
                  border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
                  background: active ? "#eff6ff" : "#f9fafb",
                  color: active ? "#2563eb" : "#374151",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "number_range") {
    const minKey = paramKey(field, "min");
    const maxKey = paramKey(field, "max");
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            style={{ ...inputStyle, width: 70 }}
            placeholder="최소"
            value={value[minKey] ?? ""}
            onChange={(e) => onChange({ [minKey]: e.target.value })}
          />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>~</span>
          <input
            type="number"
            style={{ ...inputStyle, width: 70 }}
            placeholder="최대"
            value={value[maxKey] ?? ""}
            onChange={(e) => onChange({ [maxKey]: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (field.type === "date_single_or_range") {
    const fromKey = paramKey(field, "from");
    const toKey = paramKey(field, "to");

    const handleModeChange = (mode: "single" | "range") => {
      setDateMode(mode);
      onChange({ [fromKey]: "", [toKey]: "" });
    };

    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 5 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
            <input
              type="radio"
              name={`mode-${field.table}-${field.field}`}
              checked={dateMode === "single"}
              onChange={() => handleModeChange("single")}
              style={{ cursor: "pointer" }}
            />
            단일
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
            <input
              type="radio"
              name={`mode-${field.table}-${field.field}`}
              checked={dateMode === "range"}
              onChange={() => handleModeChange("range")}
              style={{ cursor: "pointer" }}
            />
            범위
          </label>
        </div>
        {dateMode === "single" ? (
          <input
            type="date"
            style={{ ...inputStyle, width: 130 }}
            value={value[fromKey] ?? ""}
            onChange={(e) => onChange({ [fromKey]: e.target.value, [toKey]: e.target.value })}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="date"
              style={{ ...inputStyle, width: 130 }}
              value={value[fromKey] ?? ""}
              onChange={(e) => onChange({ [fromKey]: e.target.value })}
            />
            <span style={{ color: "#9ca3af", fontSize: 12 }}>~</span>
            <input
              type="date"
              style={{ ...inputStyle, width: 130 }}
              value={value[toKey] ?? ""}
              onChange={(e) => onChange({ [toKey]: e.target.value })}
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedTf, setSelectedTf] = useState("");
  const [selectedCaseType, setSelectedCaseType] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showJurisdiction, setShowJurisdiction] = useState(false);

  const tfList = selectedBranch ? TF_BY_BRANCH[selectedBranch] ?? [] : [];
  const filterFields: FilterField[] = selectedCaseType
    ? FILTER_DEFINITIONS_BY_TYPE[selectedCaseType] ?? []
    : [];

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTf) params.set("tfName", selectedTf);
      if (selectedCaseType) params.set("caseType", selectedCaseType);
      if (search) params.set("search", search);

      for (const [k, v] of Object.entries(activeFilters)) {
        if (v) params.set(k, v);
      }

      const res = await fetch(`/api/cases?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: Case[] = await res.json();
      setCases(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [selectedTf, selectedCaseType, search, activeFilters]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const updateFilter = (updates: Record<string, string>) => {
    setActiveFilters((prev) => ({ ...prev, ...updates }));
  };

  const resetFilters = () => {
    setActiveFilters({});
    setSearch("");
  };

  // ─── Columns ─────────────────────────────────────────────────────────────
  const isHearingLoss = selectedCaseType === "HEARING_LOSS";
  const COLUMNS = isHearingLoss
    ? ["연번", "성명", "TF", "영업담당자", "실무담당자", "진행상황", "초진병원", "특진병원", "처분결과", "장해등급", "접수일자"]
    : ["연번", "성명", "사건유형", "TF", "담당자", "진행상황", "접수일자"];

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      {showJurisdiction && <JurisdictionModal onClose={() => setShowJurisdiction(false)} />}

      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowJurisdiction(true)}
            style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            관할표 보기
          </button>
          <button
            onClick={() => router.push("/cases/new")}
            style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            + 새 사건 등록
          </button>
        </div>
      </div>

      {/* Step 1 & 2: 지사 → TF 선택 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>지사 선택</label>
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setSelectedTf(""); }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer", minWidth: 200 }}
            >
              <option value="">전체 지사</option>
              {Object.keys(TF_BY_BRANCH).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {selectedBranch && (
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>TF 선택</label>
              <select
                value={selectedTf}
                onChange={(e) => setSelectedTf(e.target.value)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer", minWidth: 180 }}
              >
                <option value="">전체 TF</option>
                {tfList.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: 상병 선택 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>상병 선택</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setSelectedCaseType(""); setActiveFilters({}); }}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              borderRadius: 6,
              border: selectedCaseType === "" ? "1px solid #2563eb" : "1px solid #e5e7eb",
              background: selectedCaseType === "" ? "#eff6ff" : "#f9fafb",
              color: selectedCaseType === "" ? "#2563eb" : "#374151",
              cursor: "pointer",
              fontWeight: selectedCaseType === "" ? 700 : 400,
            }}
          >
            전체
          </button>
          {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => { setSelectedCaseType(k); setActiveFilters({}); }}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                borderRadius: 6,
                border: selectedCaseType === k ? "1px solid #2563eb" : "1px solid #e5e7eb",
                background: selectedCaseType === k ? "#eff6ff" : "#f9fafb",
                color: selectedCaseType === k ? "#2563eb" : "#374151",
                cursor: "pointer",
                fontWeight: selectedCaseType === k ? 700 : 400,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Filters */}
      {filterFields.length > 0 && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {filterFields.map((f) => (
              <FilterControl
                key={`${f.table}_${f.field}`}
                field={f}
                value={activeFilters}
                onChange={updateFilter}
              />
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              onClick={resetFilters}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "#6b7280", background: "#f9fafb", cursor: "pointer" }}
            >
              필터 초기화
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <input
          type="text"
          placeholder="이름, 주민번호, 전화번호 뒷 4자리 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", outline: "none", width: 280, background: "#f9fafb" }}
        />
      </div>

      {/* Table */}
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
                {COLUMNS.map((_, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}>
                    <div style={{ height: 12, background: "#f1f5f9", borderRadius: 4, width: 60 + (j % 3) * 20 }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && cases.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  등록된 사건이 없습니다
                </td>
              </tr>
            )}
            {!loading && cases.map((c, idx) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                {isHearingLoss ? (
                  <>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{c.patient.name}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.tfName ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.salesManager ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.caseManager ?? "-"}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.hearingLoss?.firstClinic ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.hearingLoss?.specialClinic ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.hearingLoss?.disposalType ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>
                      {c.hearingLoss?.grade != null ? `${c.hearingLoss.grade}급` : "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(c.receptionDate ?? c.createdAt)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{c.patient.name}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{CASE_TYPE_LABELS[c.caseType] ?? c.caseType}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.tfName ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.caseManager ?? "-"}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(c.receptionDate ?? c.createdAt)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
