"use client";

import { useState } from "react";
import RegulationsTab from './_components/RegulationsTab'
import MinutesTab from './_components/MinutesTab'
import PerformanceTab from './_components/PerformanceTab'
import EvaluationTab from './_components/EvaluationTab'
import BranchPerformanceTab from './_components/BranchPerformanceTab'
type Tab = "REGULATIONS" | "MINUTES" | "SETTLEMENT" | "BRANCH_PERF" | "EVALUATION";

export default function BranchManagementPage() {
  const [tab, setTab] = useState<Tab>("REGULATIONS");
  const currentYear = new Date().getFullYear();
  const [selectedBranch, setSelectedBranch] = useState("울산지사");
  const [selectedYear, setSelectedYear] = useState(currentYear);

  /* ─── Render ─── */
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={s.pageTitle}>지사장 관리·운영</h1>

      {/* 탭 */}
      <div style={s.tabRow}>
        {([["REGULATIONS", "운영규정·취업규칙"], ["MINUTES", "회의록"], ["SETTLEMENT", "법인 실적 관리"], ["BRANCH_PERF", "지사 실적 관리"], ["EVALUATION", "인사평가"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...s.tab, ...(tab === key ? s.tabActive : {}) }}>{label}</button>
        ))}
      </div>

      {tab === "REGULATIONS" && <RegulationsTab />}
      {tab === "MINUTES"     && <MinutesTab />}
      {tab === "SETTLEMENT"  && <PerformanceTab />}
      {tab === "BRANCH_PERF" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}>
              {['울산지사','부산경남지사','서울북부지사','경기안산지사','전북익산지사',
                '경북구미지사','경기의정부지사','강원동해지사','전남여수지사','대구지사',
                '부산중부지사','경기수원지사'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <input type="number" value={selectedYear} min={2020} max={2099}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              style={{ width: 80, padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, textAlign: "center" }} />
            <span style={{ fontSize: 13, color: "#64748b" }}>년</span>
          </div>
          <BranchPerformanceTab selectedBranch={selectedBranch} selectedYear={selectedYear} />
        </div>
      )}
      {tab === "EVALUATION"  && <EvaluationTab />}
    </div>
  );
}

/* ─── Styles ─── */
const s = {
  pageTitle: { fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 20px" } as React.CSSProperties,
  tabRow:    { display: "flex", gap: 0, marginBottom: 16 } as React.CSSProperties,
  tab:       { padding: "10px 24px", fontSize: 14, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer", color: "#6b7280" } as React.CSSProperties,
  tabActive: { background: "#1e3a5f", color: "#fff", borderColor: "#1e3a5f" } as React.CSSProperties,
};
