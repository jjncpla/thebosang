"use client";

import { useState } from "react";
import { WorkHistoryItem, WorkHistoryRaw, WorkHistoryRawEntry } from "./WorkHistoryTypes";

interface WorkHistorySectionProps {
  caseId: string;
  workHistory: WorkHistoryItem[];
  workHistoryRaw: WorkHistoryRaw;
  workHistoryMemo: string | null;
  lastNoiseWorkEndDate: string | null;
  onChange: (updates: {
    workHistory?: WorkHistoryItem[];
    workHistoryRaw?: WorkHistoryRaw;
    workHistoryMemo?: string | null;
    lastNoiseWorkEndDate?: string | null;
  }) => void;
  onSaveLastDate?: (dateIso: string) => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 12,
  color: "#374151",
  background: "#f9fafb",
  outline: "none",
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{label}</label>
    {children}
  </div>
);

export function WorkHistorySection({
  caseId,
  workHistory,
  workHistoryRaw,
  workHistoryMemo,
  lastNoiseWorkEndDate,
  onChange,
  onSaveLastDate,
}: WorkHistorySectionProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const RAW_SOURCES = ["고용산재", "건보", "소득금액", "연금", "건근공"] as const;
  type RawSource = typeof RAW_SOURCES[number];
  const [activeRawSource, setActiveRawSource] = useState<RawSource>("고용산재");

  const years = Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const EMPTY_RAW_ENTRY = (): WorkHistoryRawEntry => ({
    company: "", department: "", jobType: "",
    startYear: new Date().getFullYear(), startMonth: 1,
    endYear: new Date().getFullYear(), endMonth: 12,
    noiseExposure: false, noiseLevel: null, workHours: "",
  });

  const addRawRow = (source: RawSource) => {
    const updated = { ...workHistoryRaw, [source]: [...(workHistoryRaw[source] ?? []), EMPTY_RAW_ENTRY()] };
    onChange({ workHistoryRaw: updated });
  };

  const removeRawRow = (source: RawSource, i: number) => {
    const updated = { ...workHistoryRaw, [source]: workHistoryRaw[source].filter((_, idx) => idx !== i) };
    onChange({ workHistoryRaw: updated });
  };

  const setRawField = (source: RawSource, i: number, key: keyof WorkHistoryRawEntry, val: unknown) => {
    const rows = [...(workHistoryRaw[source] ?? [])];
    rows[i] = { ...rows[i], [key]: val };
    onChange({ workHistoryRaw: { ...workHistoryRaw, [source]: rows } });
  };

  const addWorkRow = () => {
    onChange({
      workHistory: [
        ...workHistory,
        { company: "", department: "", jobType: "", startYear: new Date().getFullYear(), startMonth: 1, endYear: new Date().getFullYear(), endMonth: 12, noiseExposure: false, noiseLevel: null, workHours: "", source: "" }
      ]
    });
  };

  const removeWorkRow = (i: number) => {
    onChange({ workHistory: workHistory.filter((_, idx) => idx !== i) });
  };

  const setWorkField = (i: number, key: keyof WorkHistoryItem, val: unknown) => {
    onChange({ workHistory: workHistory.map((r, idx) => idx === i ? { ...r, [key]: val } : r) });
  };

  const handlePdfAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const res = await fetch(`/api/cases/${caseId}/work-history/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "분석 실패");
      }
      const data = await res.json();
      const newRaw = { ...workHistoryRaw };
      const sourceMap: Record<string, string> = {
        "고용산재": "고용산재",
        "건보": "건보",
        "소득금액": "소득금액",
        "연금": "연금",
      };
      Object.entries(sourceMap).forEach(([apiKey, stateKey]) => {
        if (data.sources?.[apiKey]?.length > 0) {
          (newRaw as Record<string, unknown>)[stateKey] = data.sources[apiKey];
        }
      });
      onChange({ workHistoryRaw: newRaw });
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다");
    } finally {
      setIsAnalyzing(false);
      e.target.value = "";
    }
  };

  const mergeWorkHistory = async () => {
    const all: (WorkHistoryRawEntry & { source: string })[] = [];
    RAW_SOURCES.forEach((src) => {
      (workHistoryRaw[src] ?? []).forEach((entry) => all.push({ ...entry, source: src }));
    });
    if (all.length === 0) return;

    const toMonths = (y: number, m: number) => y * 12 + m;
    all.sort((a, b) => toMonths(a.startYear, a.startMonth) - toMonths(b.startYear, b.startMonth));

    const memoLines: string[] = [];
    const filtered: typeof all = [];

    for (let i = 0; i < all.length; i++) {
      const b = all[i];
      const bStart = toMonths(b.startYear, b.startMonth);
      const bEnd = toMonths(b.endYear, b.endMonth);

      const isContained = all.some((a, j) => {
        if (i === j) return false;
        if (a.company.trim() === b.company.trim()) return false;
        const aStart = toMonths(a.startYear, a.startMonth);
        const aEnd = toMonths(a.endYear, a.endMonth);
        return aStart <= bStart && aEnd >= bEnd;
      });

      if (isContained) {
        memoLines.push(
          `[포함이력] ${b.company} (${b.startYear}.${String(b.startMonth).padStart(2,"0")} ~ ${b.endYear}.${String(b.endMonth).padStart(2,"0")}) — 상위 사업장 재직기간 내 포함됨 [출처: ${b.source}]`
        );
      } else {
        filtered.push(b);
      }
    }

    const deduped: typeof filtered = [];
    for (const entry of filtered) {
      const eStart = toMonths(entry.startYear, entry.startMonth);
      const eEnd = toMonths(entry.endYear, entry.endMonth);
      const isDuplicate = deduped.some((existing) => {
        if (existing.company.trim() !== entry.company.trim()) return false;
        const xStart = toMonths(existing.startYear, existing.startMonth);
        const xEnd = toMonths(existing.endYear, existing.endMonth);
        return xStart <= eStart && xEnd >= eEnd;
      });
      if (!isDuplicate) deduped.push(entry);
    }

    const merged: WorkHistoryItem[] = deduped.map(({ source, ...entry }) => ({
      ...entry,
      workHours: entry.workHours || "",
      source,
    }));

    const updates: Parameters<typeof onChange>[0] = { workHistory: merged };

    if (memoLines.length > 0) {
      const existingMemo = workHistoryMemo ?? "";
      updates.workHistoryMemo = existingMemo
        ? existingMemo + "\n\n" + memoLines.join("\n")
        : memoLines.join("\n");
    }

    if (merged.length > 0) {
      const last = merged.reduce((prev, cur) =>
        toMonths(cur.endYear, cur.endMonth) > toMonths(prev.endYear, prev.endMonth) ? cur : prev
      );
      // yyyy-mm-dd format (1st of the end month)
      const lastStr = `${last.endYear}-${String(last.endMonth).padStart(2, "0")}-01`;
      updates.lastNoiseWorkEndDate = lastStr;

      if (onSaveLastDate) {
        try {
          const lastDate = new Date(last.endYear, last.endMonth - 1, 1);
          await onSaveLastDate(lastDate.toISOString());
        } catch (e) {
          console.error("lastNoiseWorkEndDate 저장 실패:", e);
        }
      }
    }

    onChange(updates);
  };

  return (
    <>
      <SectionTitle>직업력</SectionTitle>
      
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#2563eb", color: "white", border: "none",
          borderRadius: 6, padding: "6px 14px", fontSize: 12,
          fontWeight: 700, cursor: isAnalyzing ? "not-allowed" : "pointer",
          opacity: isAnalyzing ? 0.7 : 1,
        }}>
          {isAnalyzing ? "분석 중..." : "📄 PDF 자동 분석"}
          <input
            type="file"
            accept="application/pdf"
            multiple
            style={{ display: "none" }}
            disabled={isAnalyzing}
            onChange={handlePdfAnalyze}
          />
        </label>
        <span style={{ fontSize: 11, color: "#1d4ed8" }}>
          고용산재 · 건강보험 · 소득금액 · 연금 등 PDF를 선택하면 AI가 직업력을 자동으로 추출합니다
        </span>
        {analyzeError && (
          <span style={{ fontSize: 11, color: "#dc2626", marginLeft: 8 }}>⚠ {analyzeError}</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {RAW_SOURCES.map((src) => (
          <button key={src} onClick={() => setActiveRawSource(src)} style={{
            padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "1px solid",
            background: activeRawSource === src ? "#29ABE2" : "white",
            color: activeRawSource === src ? "white" : "#374151",
            borderColor: activeRawSource === src ? "#29ABE2" : "#d1d5db",
          }}>
            {src === "고용산재" ? "고용/산재보험" : src === "건보" ? "건강보험" : src === "소득금액" ? "소득금액증명원" : src === "연금" ? "국민연금" : "건설근로자공제회"}
            {(workHistoryRaw[src]?.length ?? 0) > 0 && (
              <span style={{ marginLeft: 4, background: activeRawSource === src ? "rgba(255,255,255,0.3)" : "#e0e7ff", color: activeRawSource === src ? "white" : "#3730a3", borderRadius: 999, padding: "1px 6px", fontSize: 11 }}>
                {workHistoryRaw[src].length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto", marginBottom: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["회사명", "직종", "작업내용", "시작년월", "종료년월", ""].map((h) => (
                <th key={h} style={{ padding: "5px 6px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(workHistoryRaw[activeRawSource] ?? []).map((row, i) => (
              <tr key={i}>
                {(["company", "department", "jobType"] as (keyof WorkHistoryRawEntry)[]).map((k) => (
                  <td key={k} style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                    <input style={{ ...inputStyle, minWidth: 75, fontSize: 12 }} value={String(row[k] ?? "")} onChange={(e) => setRawField(activeRawSource, i, k, e.target.value)} />
                  </td>
                ))}
                <td style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    <select style={{ ...inputStyle, width: 65, fontSize: 12 }} value={row.startYear} onChange={(e) => setRawField(activeRawSource, i, "startYear", Number(e.target.value))}>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select style={{ ...inputStyle, width: 48, fontSize: 12 }} value={row.startMonth} onChange={(e) => setRawField(activeRawSource, i, "startMonth", Number(e.target.value))}>
                      {months.map((m) => <option key={m} value={m}>{m}월</option>)}
                    </select>
                  </div>
                </td>
                <td style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    <select style={{ ...inputStyle, width: 65, fontSize: 12 }} value={row.endYear} onChange={(e) => setRawField(activeRawSource, i, "endYear", Number(e.target.value))}>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select style={{ ...inputStyle, width: 48, fontSize: 12 }} value={row.endMonth} onChange={(e) => setRawField(activeRawSource, i, "endMonth", Number(e.target.value))}>
                      {months.map((m) => <option key={m} value={m}>{m}월</option>)}
                    </select>
                  </div>
                </td>
                <td style={{ padding: 3, border: "1px solid #f1f5f9", textAlign: "center" }}>
                  <button onClick={() => removeRawRow(activeRawSource, i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>✕</button>
                </td>
              </tr>
            ))}
            {(workHistoryRaw[activeRawSource]?.length ?? 0) === 0 && (
              <tr><td colSpan={6} style={{ padding: "12px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>항목 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      <button onClick={() => addRawRow(activeRawSource)} style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", marginBottom: 16 }}>
        + 행 추가
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
        <button onClick={mergeWorkHistory} style={{ background: "#8DC63F", color: "white", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          ▶ 최종 직업력 합산하기
        </button>
        <span style={{ fontSize: 12, color: "#15803d" }}>
          전체 {RAW_SOURCES.reduce((sum, src) => sum + (workHistoryRaw[src]?.length ?? 0), 0)}개 항목 → 중복 제거 후 최종 직업력 생성
        </span>
      </div>

      {workHistory.length > 0 && (
        <div style={{ marginBottom: 16, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>합산 결과 요약</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#dcfce7" }}>
                {["회사명", "시작년월", "종료년월", "근속기간"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", border: "1px solid #bbf7d0", fontWeight: 600, color: "#15803d", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workHistory.map((row, i) => {
                const totalMonths = (row.endYear - row.startYear) * 12 + (row.endMonth - row.startMonth) + 1;
                const years = Math.floor(Math.max(0, totalMonths) / 12);
                const months = Math.max(0, totalMonths) % 12;
                const duration = years > 0 && months > 0 ? `${years}년 ${months}개월` : years > 0 ? `${years}년` : `${months}개월`;
                return (
                  <tr key={i}>
                    <td style={{ padding: "4px 8px", border: "1px solid #dcfce7" }}>{row.company}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #dcfce7" }}>{row.startYear}-{String(row.startMonth).padStart(2,"0")}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #dcfce7" }}>{row.endYear}-{String(row.endMonth).padStart(2,"0")}</td>
                    <td style={{ padding: "4px 8px", border: "1px solid #dcfce7", fontWeight: 600, color: "#15803d" }}>{duration}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f0fdf4" }}>
                <td colSpan={3} style={{ padding: "4px 8px", border: "1px solid #bbf7d0", fontWeight: 700, color: "#15803d", textAlign: "right" }}>총 근속기간</td>
                <td style={{ padding: "4px 8px", border: "1px solid #bbf7d0", fontWeight: 700, color: "#15803d" }}>
                  {(() => {
                    const total = workHistory.reduce((sum, row) => {
                      const m = (row.endYear - row.startYear) * 12 + (row.endMonth - row.startMonth) + 1;
                      return sum + Math.max(0, m);
                    }, 0);
                    const y = Math.floor(total / 12);
                    const mo = total % 12;
                    return y > 0 && mo > 0 ? `${y}년 ${mo}개월` : y > 0 ? `${y}년` : `${mo}개월`;
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>최종 직업력 (합산 결과)</div>
      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f0fdf4" }}>
              {["회사명", "직종", "작업내용", "시작년월", "종료년월", "출처", ""].map((h) => (
                <th key={h} style={{ padding: "5px 6px", border: "1px solid #bbf7d0", fontWeight: 600, color: "#15803d", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workHistory.map((row, i) => (
              <tr key={i}>
                {(["company", "department", "jobType"] as (keyof WorkHistoryItem)[]).map((k) => (
                  <td key={k} style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                    <input style={{ ...inputStyle, minWidth: 75, fontSize: 12 }} value={String(row[k] ?? "")} onChange={(e) => setWorkField(i, k, e.target.value)} />
                  </td>
                ))}
                <td style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    <select style={{ ...inputStyle, width: 65, fontSize: 12 }} value={row.startYear} onChange={(e) => setWorkField(i, "startYear", Number(e.target.value))}>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select style={{ ...inputStyle, width: 48, fontSize: 12 }} value={row.startMonth} onChange={(e) => setWorkField(i, "startMonth", Number(e.target.value))}>
                      {months.map((m) => <option key={m} value={m}>{m}월</option>)}
                    </select>
                  </div>
                </td>
                <td style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    <select style={{ ...inputStyle, width: 65, fontSize: 12 }} value={row.endYear} onChange={(e) => setWorkField(i, "endYear", Number(e.target.value))}>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select style={{ ...inputStyle, width: 48, fontSize: 12 }} value={row.endMonth} onChange={(e) => setWorkField(i, "endMonth", Number(e.target.value))}>
                      {months.map((m) => <option key={m} value={m}>{m}월</option>)}
                    </select>
                  </div>
                </td>
                <td style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                  <input style={{ ...inputStyle, minWidth: 65, fontSize: 12 }} value={String(row.source ?? "")} onChange={(e) => setWorkField(i, "source", e.target.value)} />
                </td>
                <td style={{ padding: 3, border: "1px solid #f1f5f9", textAlign: "center" }}>
                  <button onClick={() => removeWorkRow(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>✕</button>
                </td>
              </tr>
            ))}
            {workHistory.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "12px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>합산하기 버튼을 눌러 최종 직업력을 생성하세요</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button onClick={addWorkRow} style={{ background: "white", border: "1px solid #bbf7d0", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", marginBottom: 16, color: "#15803d" }}>+ 직접 추가</button>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 8 }}>
        <Field label="마지막 소음작업 중단 시기">
          <input
            type="date"
            style={inputStyle}
            value={lastNoiseWorkEndDate?.slice(0, 10) ?? ""}
            onChange={(e) => onChange({ lastNoiseWorkEndDate: e.target.value || null })}
          />
        </Field>
      </div>
      <Field label="특이사항">
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          value={workHistoryMemo ?? ""}
          onChange={(e) => onChange({ workHistoryMemo: e.target.value || null })}
        />
      </Field>
    </>
  );
}
