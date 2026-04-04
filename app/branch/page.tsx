"use client";

import { useState } from "react";
import RegulationsTab from './_components/RegulationsTab'
import MinutesTab from './_components/MinutesTab'
import PerformanceTab from './_components/PerformanceTab'
type Tab = "REGULATIONS" | "MINUTES" | "SETTLEMENT";

export default function BranchManagementPage() {
  const [tab, setTab] = useState<Tab>("REGULATIONS");
  /* ─── Render ─── */
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={s.pageTitle}>지사장 관리·운영</h1>

      {/* 탭 */}
      <div style={s.tabRow}>
        {([["REGULATIONS", "운영규정·취업규칙"], ["MINUTES", "회의록"], ["SETTLEMENT", "법인 실적 관리"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...s.tab, ...(tab === key ? s.tabActive : {}) }}>{label}</button>
        ))}
      </div>

      {tab === "REGULATIONS" && <RegulationsTab />}
      {tab === "MINUTES"     && <MinutesTab />}
      {tab === "SETTLEMENT"  && <PerformanceTab />}
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
