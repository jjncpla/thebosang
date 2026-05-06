"use client";

import React, { useState } from "react";
import { WorkHistorySection } from "@/components/case-common/WorkHistorySection";
import type { WorkHistoryItem, WorkHistoryRaw, WorkHistoryDailyEntry } from "@/components/case-common/WorkHistoryTypes";

/**
 * 직업력 카드 — 모든 caseType에서 공통으로 표시.
 * 내부적으로 WorkHistorySection(분석/입력 본체)을 감싸 카드 UI + 자동저장 PATCH 처리.
 */

export type CaseWorkHistoryItem = {
  id: string;
  workHistory: WorkHistoryItem[] | null;
  workHistoryDaily: WorkHistoryDailyEntry[] | null;
  workHistoryRaw: WorkHistoryRaw | null;
  workHistoryMemo: string | null;
  lastNoiseWorkEndDate: string | null;
};

interface Props {
  caseItem: CaseWorkHistoryItem;
  onUpdated: (updates: Partial<CaseWorkHistoryItem>) => void;
}

export default function CaseWorkHistoryCard({ caseItem, onUpdated }: Props) {
  const [open, setOpen] = useState(true);

  const handleChange = async (updates: {
    workHistory?: WorkHistoryItem[] | null;
    workHistoryRaw?: WorkHistoryRaw | null;
    workHistoryMemo?: string | null;
    lastNoiseWorkEndDate?: string | null;
  }) => {
    onUpdated(updates);
    try {
      await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.error("직업력 저장 실패:", e);
    }
  };

  const handleChangeDaily = async (entries: WorkHistoryDailyEntry[]) => {
    onUpdated({ workHistoryDaily: entries });
    try {
      await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workHistoryDaily: entries }),
      });
    } catch (e) {
      console.error("일용직 저장 실패:", e);
    }
  };

  const saveLastNoiseWorkEndDate = async (isoDate: string) => {
    await fetch(`/api/cases/${caseItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastNoiseWorkEndDate: isoDate }),
    });
    onUpdated({ lastNoiseWorkEndDate: isoDate });
  };

  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", border: "none", borderBottom: open ? "1px solid #e5e7eb" : "none", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>직업력</span>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          <WorkHistorySection
            caseId={caseItem.id}
            workHistory={(caseItem.workHistory as WorkHistoryItem[]) ?? []}
            workHistoryRaw={(caseItem.workHistoryRaw as WorkHistoryRaw) ?? { 고용산재: [], 건보: [], 소득금액: [], 연금: [], 건근공: [], 일용직: [] }}
            workHistoryDaily={(caseItem.workHistoryDaily as WorkHistoryDailyEntry[]) ?? []}
            workHistoryMemo={caseItem.workHistoryMemo}
            lastNoiseWorkEndDate={caseItem.lastNoiseWorkEndDate}
            onChange={handleChange}
            onChangeDaily={handleChangeDaily}
            onSaveLastDate={saveLastNoiseWorkEndDate}
          />
        </div>
      )}
    </div>
  );
}
