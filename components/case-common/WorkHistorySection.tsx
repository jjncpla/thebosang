"use client";

import React, { useState } from "react";
import { WorkHistoryItem, WorkHistoryRaw, WorkHistoryRawEntry, WorkHistoryDailyEntry } from "./WorkHistoryTypes";

// ── 공통 타입 ──────────────────────────────────────────────────────────────
interface WorkHistorySectionProps {
  caseId: string;
  workHistory: WorkHistoryItem[];
  workHistoryRaw: WorkHistoryRaw;
  workHistoryDaily: WorkHistoryDailyEntry[];
  workHistoryMemo: string | null;
  lastNoiseWorkEndDate: string | null;
  onChange: (updates: {
    workHistory?: WorkHistoryItem[];
    workHistoryRaw?: WorkHistoryRaw;
    workHistoryMemo?: string | null;
    lastNoiseWorkEndDate?: string | null;
  }) => void;
  onChangeDaily: (entries: WorkHistoryDailyEntry[]) => void;
  onSaveLastDate?: (dateIso: string) => Promise<void>;
}

// ── 스타일 상수 ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 12,
  color: "#374151",
  background: "#f9fafb",
  outline: "none",
};

// ── 유틸 함수 ──────────────────────────────────────────────────────────────
function calcDuration(totalMonths: number): string {
  const y = Math.floor(Math.max(0, totalMonths) / 12);
  const m = Math.max(0, totalMonths) % 12;
  return y > 0 && m > 0 ? `${y}년 ${m}개월` : y > 0 ? `${y}년` : `${m}개월`;
}

function normalizeCompany(name: string): string {
  return name
    .trim()
    .replace(/^(주식회사|유한회사|합자회사|합명회사)\s+/, "")
    .replace(/\s+(주식회사|유한회사|합자회사|합명회사)$/, "")
    .replace(/^\(주\)\s*/, "").replace(/\s*\(주\)$/, "")
    .replace(/^\(유\)\s*/, "").replace(/\s*\(유\)$/, "")
    .replace(/^\(합\)\s*/, "").replace(/\s*\(합\)$/, "")
    .replace(/\s+/g, "").toLowerCase();
}

function calcUnionMonths(intervals: { start: number; end: number }[]): number {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0, curStart = sorted[0].start, curEnd = sorted[0].end;
  for (const iv of sorted.slice(1)) {
    if (iv.start <= curEnd + 1) { curEnd = Math.max(curEnd, iv.end); }
    else { total += curEnd - curStart + 1; curStart = iv.start; curEnd = iv.end; }
  }
  return total + curEnd - curStart + 1;
}

// ── 소스 그룹 패널 (상용직/일용직 분할 표시) ───────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRawSource = any;
interface SourceGroupPanelProps {
  title: string;
  titleColor: string;
  bgColor: string;
  sources: readonly string[];
  activeSrc: string;
  setActiveSrc: (s: string) => void;
  workHistoryRaw: WorkHistoryRaw;
  sourceLabels: Record<string, string>;
  inputStyle: React.CSSProperties;
  years: number[];
  months: number[];
  workHistoryDaily: WorkHistoryDailyEntry[];
  onChangeDaily: (entries: WorkHistoryDailyEntry[]) => void;
  setRawField: (source: AnyRawSource, i: number, key: keyof WorkHistoryRawEntry, val: unknown) => void;
  removeRawRow: (source: AnyRawSource, i: number) => void;
  addRawRow: (source: AnyRawSource) => void;
}
function SourceGroupPanel(props: SourceGroupPanelProps) {
  const { title, titleColor, bgColor, sources, activeSrc, setActiveSrc, workHistoryRaw, sourceLabels, inputStyle, years, months, setRawField, removeRawRow, addRawRow, workHistoryDaily, onChangeDaily } = props;
  const isDailyTab = activeSrc === "일용직" || activeSrc === "건근공";

  return (
    <div style={{ background: bgColor, borderRadius: 10, padding: 12, border: `1px solid ${titleColor}33` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: titleColor, marginBottom: 10 }}>{title}</div>
      {/* 탭 버튼 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {sources.map((src) => {
          const count = src === "일용직"
            ? workHistoryDaily.length
            : (workHistoryRaw[src as keyof WorkHistoryRaw]?.length ?? 0);
          return (
            <button key={src} onClick={() => setActiveSrc(src)} style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "1px solid",
              background: activeSrc === src ? titleColor : "white",
              color: activeSrc === src ? "white" : "#374151",
              borderColor: activeSrc === src ? titleColor : "#d1d5db",
            }}>
              {sourceLabels[src] ?? src}
              {count > 0 && (
                <span style={{ marginLeft: 4, background: activeSrc === src ? "rgba(255,255,255,0.3)" : "#e0e7ff", color: activeSrc === src ? "white" : "#3730a3", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* 데이터 테이블 */}
      <div style={{ overflowX: "auto", marginBottom: 8 }}>
        {isDailyTab && activeSrc === "일용직" ? (
          // 일용직 탭: dailyEntries 표시
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["사업장명", "직종", "총일수", "최초근무", "환산", ""].map(h => (
                  <th key={h} style={{ padding: "4px 5px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workHistoryDaily.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "10px", textAlign: "center", color: "#9ca3af", fontSize: 11 }}>데이터 없음</td></tr>
              ) : workHistoryDaily.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9" }}>
                    <input style={{ ...inputStyle, minWidth: 80, fontSize: 11 }} value={row.company} onChange={(e) => onChangeDaily(workHistoryDaily.map((r, j) => j === i ? { ...r, company: e.target.value } : r))} />
                  </td>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9" }}>
                    <input style={{ ...inputStyle, minWidth: 80, fontSize: 11 }} value={row.jobType} onChange={(e) => onChangeDaily(workHistoryDaily.map((r, j) => j === i ? { ...r, jobType: e.target.value } : r))} />
                  </td>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9", textAlign: "center" }}>
                    <input type="number" style={{ ...inputStyle, width: 50, fontSize: 11 }} value={row.totalDays} onChange={(e) => onChangeDaily(workHistoryDaily.map((r, j) => j === i ? { ...r, totalDays: Number(e.target.value) } : r))} />
                  </td>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9", textAlign: "center", whiteSpace: "nowrap" }}>{row.startYear}-{String(row.startMonth).padStart(2, "0")}</td>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9", textAlign: "center" }}>{row.convertedMonths}개월</td>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9", textAlign: "center" }}>
                    <button onClick={() => onChangeDaily(workHistoryDaily.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // 일반 raw source 탭
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["사업장명", "직종", "작업내용", "시작연월", "종료연월", ""].map(h => (
                  <th key={h} style={{ padding: "4px 5px", border: "1px solid #e5e7eb", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(workHistoryRaw[activeSrc as keyof WorkHistoryRaw] ?? []).map((row, i) => (
                <tr key={i}>
                  {(["company", "department", "jobType"] as (keyof WorkHistoryRawEntry)[]).map(k => (
                    <td key={k} style={{ padding: 2, border: "1px solid #f1f5f9" }}>
                      <input style={{ ...inputStyle, minWidth: 70, fontSize: 11 }} value={String(row[k] ?? "")} onChange={(e) => setRawField(activeSrc, i, k, e.target.value)} />
                    </td>
                  ))}
                  <td style={{ padding: 2, border: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      <select style={{ ...inputStyle, width: 60, fontSize: 11 }} value={row.startYear} onChange={(e) => setRawField(activeSrc, i, "startYear", Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select style={{ ...inputStyle, width: 44, fontSize: 11 }} value={row.startMonth} onChange={(e) => setRawField(activeSrc, i, "startMonth", Number(e.target.value))}>
                        {months.map(m => <option key={m} value={m}>{m}월</option>)}
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      <select style={{ ...inputStyle, width: 60, fontSize: 11 }} value={row.endYear} onChange={(e) => setRawField(activeSrc, i, "endYear", Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select style={{ ...inputStyle, width: 44, fontSize: 11 }} value={row.endMonth} onChange={(e) => setRawField(activeSrc, i, "endMonth", Number(e.target.value))}>
                        {months.map(m => <option key={m} value={m}>{m}월</option>)}
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: 2, border: "1px solid #f1f5f9", textAlign: "center" }}>
                    <button onClick={() => removeRawRow(activeSrc, i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
                  </td>
                </tr>
              ))}
              {(workHistoryRaw[activeSrc as keyof WorkHistoryRaw]?.length ?? 0) === 0 && (
                <tr><td colSpan={6} style={{ padding: "10px", textAlign: "center", color: "#9ca3af", fontSize: 11 }}>데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {!isDailyTab || activeSrc === "건근공" ? (
        <button onClick={() => addRawRow(activeSrc)} style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>+ 행 추가</button>
      ) : null}
    </div>
  );
}

// ── 진행률 표시 컴포넌트 ───────────────────────────────────────────────
function AnalyzeProgressBar({ progress }: { progress: { done: number; total: number; currentChunk: string; estimatedTotalSec: number; startMs: number } }) {
  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const elapsedSec = Math.floor((now - progress.startMs) / 1000);
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const remainingSec = Math.max(0, progress.estimatedTotalSec - elapsedSec);
  const isHeavy = progress.estimatedTotalSec > 60;

  return (
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
          🤖 AI 분석 중… ({progress.done}/{progress.total} 청크 완료)
        </span>
        <span style={{ fontSize: 11, color: "#475569" }}>
          경과 {elapsedSec}초 · 예상 약 {progress.estimatedTotalSec}초
          {remainingSec > 0 && ` (남은 ~${remainingSec}초)`}
        </span>
      </div>
      <div style={{ height: 8, background: "#dbeafe", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #3b82f6, #2563eb)", transition: "width 0.4s ease" }} />
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        현재: {progress.currentChunk}
      </div>
      {isHeavy && (
        <div style={{ fontSize: 11, color: "#92400e", marginTop: 6, background: "#fef3c7", padding: 6, borderRadius: 4 }}>
          ⏰ 페이지 수가 많아 시간이 다소 걸립니다. 처리되는 항목은 아래 표에 즉시 반영됩니다.
        </div>
      )}
    </div>
  );
}

// ── 드로어 내부 컴포넌트 (분리된 컴포넌트 → DOM 안정성 보장) ──────────────
interface DrawerContentProps extends WorkHistorySectionProps {
  onClose: () => void;
}

function WorkHistoryDrawerContent({
  caseId,
  workHistory,
  workHistoryRaw,
  workHistoryDaily,
  workHistoryMemo,
  lastNoiseWorkEndDate,
  onChange,
  onChangeDaily,
  onSaveLastDate,
  onClose,
}: DrawerContentProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number; currentChunk: string; estimatedTotalSec: number; startMs: number } | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; docType: string }[]>([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mergeResult, setMergeResult] = useState<{
    regularMonths: number; noiseMonths: number; dailyMonths: number; totalMonths: number;
  } | null>(null);

  const RAW_SOURCES = ["고용산재", "건보", "소득금액", "연금", "건근공", "일용직"] as const;
  type RawSource = typeof RAW_SOURCES[number];
  // 상용직: 4개 / 일용직: 2개로 분리
  const REGULAR_SOURCES = ["고용산재", "건보", "소득금액", "연금"] as const;
  const DAILY_SOURCES = ["건근공", "일용직"] as const;
  const [activeRegularSource, setActiveRegularSource] = useState<RawSource>("고용산재");
  const [activeDailySource, setActiveDailySource] = useState<RawSource>("건근공");
  // 통합 ref (다른 부분 호환용)
  const activeRawSource = activeRegularSource;
  const setActiveRawSource = (src: RawSource) => {
    if ((REGULAR_SOURCES as readonly string[]).includes(src)) setActiveRegularSource(src);
    else setActiveDailySource(src);
  };

  const DOC_TYPE_OPTIONS = [
    { value: "건보", label: "건강보험 자격득실확인서" },
    { value: "고용산재_전체", label: "고용보험 (자격이력 + 일용근로 통합)" },
    { value: "고용산재_상용", label: "고용보험 자격이력내역서 (상용직만)" },
    { value: "일용직", label: "고용보험 일용근로노무제공내역서 (일용직만)" },
    { value: "연금", label: "국민연금 가입증명/가입내역확인서" },
    { value: "건근공", label: "건설근로자공제회 내역서" },
    { value: "경력증명서", label: "경력증명서 (재직증명서)" },
  ];

  const SOURCE_LABELS: Record<string, string> = {
    고용산재: "고용/산재보험", 건보: "건강보험", 소득금액: "소득금액증명원",
    연금: "국민연금", 건근공: "건설근로자공제회", 일용직: "일용직(고용보험)",
  };

  const years = Array.from({ length: 60 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const EMPTY_RAW_ENTRY = (): WorkHistoryRawEntry => ({
    company: "", department: "", jobType: "",
    startYear: new Date().getFullYear(), startMonth: 1,
    endYear: new Date().getFullYear(), endMonth: 12,
    noiseExposure: false, noiseLevel: null, workHours: "",
  });

  const addRawRow = (source: RawSource) => {
    onChange({ workHistoryRaw: { ...workHistoryRaw, [source]: [...(workHistoryRaw[source] ?? []), EMPTY_RAW_ENTRY()] } });
  };
  const removeRawRow = (source: RawSource, i: number) => {
    onChange({ workHistoryRaw: { ...workHistoryRaw, [source]: workHistoryRaw[source].filter((_, idx) => idx !== i) } });
  };
  const setRawField = (source: RawSource, i: number, key: keyof WorkHistoryRawEntry, val: unknown) => {
    const rows = [...(workHistoryRaw[source] ?? [])];
    rows[i] = { ...rows[i], [key]: val };
    onChange({ workHistoryRaw: { ...workHistoryRaw, [source]: rows } });
  };
  const addWorkRow = () => {
    onChange({ workHistory: [...workHistory, { company: "", department: "", jobType: "", startYear: new Date().getFullYear(), startMonth: 1, endYear: new Date().getFullYear(), endMonth: 12, noiseExposure: false, noiseLevel: null, workHours: "", source: "" }] });
  };
  const removeWorkRow = (i: number) => onChange({ workHistory: workHistory.filter((_, idx) => idx !== i) });
  const setWorkField = (i: number, key: keyof WorkHistoryItem, val: unknown) => {
    onChange({ workHistory: workHistory.map((r, idx) => idx === i ? { ...r, [key]: val } : r) });
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles(prev => [...prev, ...Array.from(files).map(file => ({ file, docType: "" }))]);
    setShowFileSelector(true);
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    const valid = pendingFiles.filter(f => f.docType !== "");
    if (valid.length === 0) { setAnalyzeError("문서 종류를 선택해주세요"); return; }
    setIsAnalyzing(true);
    setAnalyzeError(null);
    const accRaw = { ...workHistoryRaw };
    const accDaily: typeof workHistoryDaily = [...workHistoryDaily];
    let extractedName = "";
    try {
      const { PDFDocument } = await import("pdf-lib");

      // 1) PDF 청크 분할 — 작은 PDF(≤5p)는 단일 청크, 큰 PDF는 3p 청크
      type Chunk = { blob: Blob; chunkName: string; docType: string; chunkIndex: number };
      const allChunks: Chunk[] = [];
      for (const { file, docType } of valid) {
        const buffer = await file.arrayBuffer();
        const srcDoc = await PDFDocument.load(buffer);
        const totalPages = srcDoc.getPageCount();
        const CHUNK_PAGES = totalPages <= 5 ? totalPages : 3;
        let fileChunkIndex = 0;
        for (let start = 0; start < totalPages; start += CHUNK_PAGES) {
          const end = Math.min(start + CHUNK_PAGES, totalPages);
          const chunkDoc = await PDFDocument.create();
          const copied = await chunkDoc.copyPages(srcDoc, Array.from({ length: end - start }, (_, k) => start + k));
          copied.forEach(p => chunkDoc.addPage(p));
          const bytes = await chunkDoc.save();
          allChunks.push({
            blob: new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
            chunkName: `${file.name} (p${start + 1}-${end})`,
            docType,
            chunkIndex: fileChunkIndex++,
          });
        }
      }

      // 진행률 추적 초기화
      // 추정: 청크당 평균 ~10초 (OCR 6-8s + Haiku 3-5s, 동시성 고려)
      const concurrency = allChunks.length <= 3 ? 3 : allChunks.length <= 6 ? 2 : 1;
      const estimatedTotalSec = Math.ceil(allChunks.length / concurrency) * 12;
      let doneCount = 0;
      setAnalyzeProgress({
        done: 0,
        total: allChunks.length,
        currentChunk: allChunks[0]?.chunkName ?? "",
        estimatedTotalSec,
        startMs: Date.now(),
      });

      // 2) 청크 처리 함수
      const processChunk = async (chunk: Chunk) => {
        // 진행 상태 업데이트: 현재 처리 중인 청크 표시
        setAnalyzeProgress((prev) => prev ? { ...prev, currentChunk: chunk.chunkName } : prev);

        const formData = new FormData();
        formData.append("file", chunk.blob, chunk.chunkName);
        formData.append("docType", chunk.docType);
        formData.append("chunkName", chunk.chunkName);
        formData.append("chunkIndex", String(chunk.chunkIndex));

        const res = await fetch(`/api/cases/${caseId}/work-history/analyze`, { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as {error?: string}).error ?? "분석 실패"); }

        // SSE 스트림 읽기
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let data: { type: string; sources?: Record<string, unknown[]>; dailyEntries?: unknown[]; name?: string; error?: string } | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            try { data = JSON.parse(part.slice(6)); } catch { /* skip */ }
          }
        }
        if (data?.type === "error") throw new Error(data.error ?? "분석 오류");
        if (data?.type === "result") {
          // 청크별 결과를 누적 + 즉시 UI 반영
          if (data.name && !extractedName) extractedName = data.name;
          ["고용산재", "건보", "소득금액", "연금", "건근공"].forEach((src) => {
            if ((data!.sources as Record<string, unknown[]>)?.[src]?.length > 0) {
              (accRaw as Record<string, unknown[]>)[src] = [
                ...((accRaw as Record<string, unknown[]>)[src] ?? []),
                ...(data!.sources as Record<string, unknown[]>)[src],
              ];
            }
          });
          if (data.dailyEntries?.length) accDaily.push(...(data.dailyEntries as WorkHistoryDailyEntry[]));
          onChange({ workHistoryRaw: { ...accRaw } as WorkHistoryRaw });
          onChangeDaily([...accDaily]);
        }
        // 청크 완료 카운트
        doneCount++;
        setAnalyzeProgress((prev) => prev ? { ...prev, done: doneCount } : prev);
      };

      // 3) 동시성 제한 병렬 처리 (rate limit 방지)
      const CONCURRENCY = concurrency;
      for (let i = 0; i < allChunks.length; i += CONCURRENCY) {
        const batch = allChunks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(processChunk));
      }
      onChange({ workHistoryRaw: accRaw });
      onChangeDaily(accDaily);
      const firstWithData = ['고용산재', '건보', '연금', '건근공', '일용직'].find(src => (accRaw as Record<string, unknown[]>)[src]?.length > 0);
      if (firstWithData) setActiveRawSource(firstWithData as RawSource);
      setPendingFiles([]);
      setShowFileSelector(false);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setIsAnalyzing(false);
      setAnalyzeProgress(null);
    }
  };

  const handleClearAll = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    onChange({ workHistory: [], workHistoryRaw: { 고용산재: [], 건보: [], 소득금액: [], 연금: [], 건근공: [], 일용직: [] }, workHistoryMemo: null, lastNoiseWorkEndDate: null });
    onChangeDaily([]);
    setMergeResult(null);
    setConfirmClear(false);
  };

  const mergeWorkHistory = async () => {
    const toM = (y: number, m: number) => y * 12 + m;
    const all: (WorkHistoryRawEntry & { source: string })[] = [];
    (["고용산재", "건보", "소득금액", "연금", "건근공"] as const).forEach(src => {
      (workHistoryRaw[src] ?? []).forEach(entry => all.push({ ...entry, source: src }));
    });
    const memoLines: string[] = [];
    let merged: WorkHistoryItem[] = [];

    if (all.length > 0) {
      all.sort((a, b) => toM(a.startYear, a.startMonth) - toM(b.startYear, b.startMonth));
      const byNorm = new Map<string, typeof all>();
      for (const e of all) {
        const k = normalizeCompany(e.company);
        if (!byNorm.has(k)) byNorm.set(k, []);
        byNorm.get(k)!.push(e);
      }
      const prio = ["고용산재", "건보", "연금", "소득금액", "건근공"];
      const companyMerged: typeof all = [];
      for (const entries of byNorm.values()) {
        const best = entries.reduce((b, e) => prio.indexOf(e.source) < prio.indexOf(b.source) ? e : b);
        const sorted = [...entries].sort((a, b) => toM(a.startYear, a.startMonth) - toM(b.startYear, b.startMonth));
        let curr = { ...sorted[0], company: best.company };
        for (const e of sorted.slice(1)) {
          const ce = toM(curr.endYear, curr.endMonth), es = toM(e.startYear, e.startMonth), ee = toM(e.endYear, e.endMonth);
          if (es <= ce + 1) {
            if (ee > ce) { curr.endYear = e.endYear; curr.endMonth = e.endMonth; }
            curr.noiseExposure = curr.noiseExposure || e.noiseExposure;
            if (!curr.department && e.department) curr.department = e.department;
            if (!curr.jobType && e.jobType) curr.jobType = e.jobType;
          } else { companyMerged.push(curr); curr = { ...e, company: best.company }; }
        }
        companyMerged.push(curr);
      }
      companyMerged.sort((a, b) => toM(a.startYear, a.startMonth) - toM(b.startYear, b.startMonth));
      const filtered: typeof companyMerged = [];
      for (let i = 0; i < companyMerged.length; i++) {
        const b = companyMerged[i];
        const bN = normalizeCompany(b.company), bS = toM(b.startYear, b.startMonth), bE = toM(b.endYear, b.endMonth);
        const contained = companyMerged.some((a, j) => i !== j && normalizeCompany(a.company) !== bN && toM(a.startYear, a.startMonth) <= bS && toM(a.endYear, a.endMonth) >= bE);
        if (contained) memoLines.push(`[포함이력] ${b.company} (${b.startYear}.${String(b.startMonth).padStart(2,"0")} ~ ${b.endYear}.${String(b.endMonth).padStart(2,"0")}) — 상위 사업장 재직기간 내 포함됨 [출처: ${b.source}]`);
        else filtered.push(b);
      }
      merged = filtered.map(({ source, ...e }) => ({ ...e, workHours: e.workHours || "", source }));
    }

    const updates: Parameters<typeof onChange>[0] = { workHistory: merged };
    if (memoLines.length > 0) {
      const em = workHistoryMemo ?? "";
      updates.workHistoryMemo = em ? em + "\n\n" + memoLines.join("\n") : memoLines.join("\n");
    }
    if (merged.length > 0) {
      const noiseEntries = merged.filter(e => e.noiseExposure);
      const ref = noiseEntries.length > 0 ? noiseEntries : merged;
      const last = ref.reduce((p, c) => toM(c.endYear, c.endMonth) > toM(p.endYear, p.endMonth) ? c : p);
      updates.lastNoiseWorkEndDate = `${last.endYear}-${String(last.endMonth).padStart(2, "0")}-01`;
      if (onSaveLastDate) { try { await onSaveLastDate(new Date(last.endYear, last.endMonth - 1, 1).toISOString()); } catch (e) { console.error(e); } }
    }
    onChange(updates);

    const allIv = merged.map(e => ({ start: toM(e.startYear, e.startMonth), end: toM(e.endYear, e.endMonth) }));
    const noiseIv = merged.filter(e => e.noiseExposure).map(e => ({ start: toM(e.startYear, e.startMonth), end: toM(e.endYear, e.endMonth) }));
    const totalDaySum = workHistoryDaily.reduce((s, r) => s + Number(r.totalDays || 0), 0);
    setMergeResult({
      regularMonths: calcUnionMonths(allIv),
      noiseMonths: calcUnionMonths(noiseIv),
      dailyMonths: totalDaySum > 0 ? Math.ceil(totalDaySum / 20) : 0,
      totalMonths: calcUnionMonths(allIv) + (totalDaySum > 0 ? Math.ceil(totalDaySum / 20) : 0),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 드로어 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#29ABE2", color: "white", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>직업력 관리</span>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: 6, padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          저장 후 닫기
        </button>
      </div>

      {/* 메모 모달 */}
      {showMemoModal && (
        <>
          <div onClick={() => setShowMemoModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 24, zIndex: 1101, width: "min(600px, 90vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>특이사항</span>
              <button onClick={() => setShowMemoModal(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <textarea style={{ ...inputStyle, width: "100%", minHeight: 300, resize: "vertical", boxSizing: "border-box" }}
              value={workHistoryMemo ?? ""} onChange={(e) => onChange({ workHistoryMemo: e.target.value || null })} placeholder="특이사항을 입력하세요..." />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setShowMemoModal(false)} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "7px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>확인</button>
            </div>
          </div>
        </>
      )}

      {/* 드로어 내용 */}
      <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>

        {/* PDF 자동 분석 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe", flexWrap: "wrap" }}>
            {/* file input: label 오버레이 방식 — 클릭이 input에 직접 전달 */}
            <label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, background: "#2563eb", color: "white", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", overflow: "hidden" }}>
              📄 PDF 파일 선택
              <input type="file" multiple onChange={handleFilesSelected}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", fontSize: 0 }} />
            </label>
            <span style={{ fontSize: 11, color: "#1d4ed8", flex: 1 }}>건강보험·고용보험·국민연금 PDF를 선택하면 종류를 지정할 수 있습니다</span>
            {confirmClear ? (
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>정말 초기화?</span>
                <button onClick={handleClearAll} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>확인</button>
                <button onClick={() => setConfirmClear(false)} style={{ background: "white", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>취소</button>
              </span>
            ) : (
              <button onClick={handleClearAll} style={{ background: "white", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗑 전체 초기화</button>
            )}
            {analyzeError && <span style={{ fontSize: 11, color: "#dc2626", width: "100%" }}>⚠ {analyzeError}</span>}
          </div>

          {isAnalyzing && analyzeProgress && (
            <AnalyzeProgressBar progress={analyzeProgress} />
          )}

          {showFileSelector && pendingFiles.length > 0 && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>📋 문서 종류 지정</div>
              {pendingFiles.map((pf, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pf.file.name}</span>
                  <select value={pf.docType} onChange={(e) => setPendingFiles(prev => prev.map((f, i) => i === idx ? { ...f, docType: e.target.value } : f))}
                    style={{ fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 8px", background: "white" }}>
                    <option value="">-- 종류 선택 --</option>
                    {DOC_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={handleAnalyze} disabled={isAnalyzing || pendingFiles.every(f => !f.docType)}
                  style={{ background: isAnalyzing ? "#93c5fd" : "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: isAnalyzing ? "not-allowed" : "pointer" }}>
                  {isAnalyzing ? "⏳ 분석 중..." : "🤖 AI 자동 분석 시작"}
                </button>
                <button onClick={() => { setPendingFiles([]); setShowFileSelector(false); }}
                  style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>취소</button>
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, padding: '6px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            💡 소득금액증명원 및 그 외 자료들은 수동으로 기입해주세요 (소득금액증명원 탭 직접 입력)
          </div>
        </div>

        {/* 상용직/일용직 좌우 분할 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* 좌: 상용직 직업력 산정 */}
          <SourceGroupPanel
            title="🏢 상용직 직업력 산정"
            titleColor="#1e40af"
            bgColor="#eff6ff"
            sources={REGULAR_SOURCES}
            activeSrc={activeRegularSource}
            setActiveSrc={(s) => setActiveRegularSource(s as RawSource)}
            workHistoryRaw={workHistoryRaw}
            sourceLabels={SOURCE_LABELS}
            inputStyle={inputStyle}
            years={years}
            months={months}
            workHistoryDaily={workHistoryDaily}
            onChangeDaily={onChangeDaily}
            setRawField={setRawField}
            removeRawRow={removeRawRow}
            addRawRow={addRawRow}
          />
          {/* 우: 일용직 직업력 산정 */}
          <SourceGroupPanel
            title="🛠 일용직 직업력 산정"
            titleColor="#92400e"
            bgColor="#fffbeb"
            sources={DAILY_SOURCES}
            activeSrc={activeDailySource}
            setActiveSrc={(s) => setActiveDailySource(s as RawSource)}
            workHistoryRaw={workHistoryRaw}
            sourceLabels={SOURCE_LABELS}
            inputStyle={inputStyle}
            years={years}
            months={months}
            workHistoryDaily={workHistoryDaily}
            onChangeDaily={onChangeDaily}
            setRawField={setRawField}
            removeRawRow={removeRawRow}
            addRawRow={addRawRow}
          />
        </div>

        {/* 최종 직업력 합산하기 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", flexWrap: "wrap" }}>
          <button onClick={mergeWorkHistory} style={{ background: "#8DC63F", color: "white", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            ▶ 최종 직업력 합산하기
          </button>
          {mergeResult ? (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#15803d" }}>상용직: <strong>{calcDuration(mergeResult.regularMonths)}</strong></span>
              {mergeResult.noiseMonths > 0 && (
                <span style={{ fontSize: 12, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: 6 }}>소음노출: <strong>{calcDuration(mergeResult.noiseMonths)}</strong></span>
              )}
              <span style={{ fontSize: 12, color: "#92400e" }}>일용직: <strong>{calcDuration(mergeResult.dailyMonths)}</strong></span>
              <span style={{ fontSize: 13, color: "#111827", fontWeight: 700, background: "#dcfce7", padding: "3px 10px", borderRadius: 6 }}>최종 합계: {calcDuration(mergeResult.totalMonths)}</span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>※동시재직 중복 제거 union 기준</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#15803d" }}>
              총 {RAW_SOURCES.reduce((s, src) => s + (workHistoryRaw[src]?.length ?? 0), 0)}개 항목 + 일용직 {workHistoryDaily.length}건 → 합산하여 최종 직업력 생성
            </span>
          )}
        </div>

        {/* 합산 결과 요약 */}
        {workHistory.length > 0 && (
          <div style={{ marginBottom: 16, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>합산 결과 요약</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#dcfce7" }}>
                  {["회사명", "시작연월", "종료연월", "근속기간"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", border: "1px solid #bbf7d0", fontWeight: 600, color: "#15803d", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workHistory.map((row, i) => {
                  const tm = (row.endYear - row.startYear) * 12 + (row.endMonth - row.startMonth) + 1;
                  return (
                    <tr key={i}>
                      <td style={{ padding: "4px 8px", border: "1px solid #dcfce7" }}>{row.company}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #dcfce7" }}>{row.startYear}-{String(row.startMonth).padStart(2, "0")}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #dcfce7" }}>{row.endYear}-{String(row.endMonth).padStart(2, "0")}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #dcfce7", fontWeight: 600, color: "#15803d" }}>{calcDuration(tm)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0fdf4" }}>
                  <td colSpan={3} style={{ padding: "4px 8px", border: "1px solid #bbf7d0", fontWeight: 700, color: "#15803d", textAlign: "right" }}>상용직 합계 (union)</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #bbf7d0", fontWeight: 700, color: "#15803d" }}>
                    {mergeResult ? calcDuration(mergeResult.regularMonths) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 최종 직업력 편집 테이블 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>최종 직업력 (합산 결과)</div>
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f0fdf4" }}>
                {["사업장명", "직종", "작업내용", "시작연월", "종료연월", "출처", ""].map(h => (
                  <th key={h} style={{ padding: "5px 6px", border: "1px solid #bbf7d0", fontWeight: 600, color: "#15803d", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workHistory.map((row, i) => (
                <tr key={i}>
                  {(["company", "department", "jobType"] as (keyof WorkHistoryItem)[]).map(k => (
                    <td key={k} style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                      <input style={{ ...inputStyle, minWidth: 75, fontSize: 12 }} value={String(row[k] ?? "")} onChange={(e) => setWorkField(i, k, e.target.value)} />
                    </td>
                  ))}
                  <td style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      <select style={{ ...inputStyle, width: 65, fontSize: 12 }} value={row.startYear} onChange={(e) => setWorkField(i, "startYear", Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select style={{ ...inputStyle, width: 48, fontSize: 12 }} value={row.startMonth} onChange={(e) => setWorkField(i, "startMonth", Number(e.target.value))}>
                        {months.map(m => <option key={m} value={m}>{m}월</option>)}
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: 3, border: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 2 }}>
                      <select style={{ ...inputStyle, width: 65, fontSize: 12 }} value={row.endYear} onChange={(e) => setWorkField(i, "endYear", Number(e.target.value))}>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select style={{ ...inputStyle, width: 48, fontSize: 12 }} value={row.endMonth} onChange={(e) => setWorkField(i, "endMonth", Number(e.target.value))}>
                        {months.map(m => <option key={m} value={m}>{m}월</option>)}
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

        {/* 일용직 직업력 */}
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>
            일용직 직업력 <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>(20일=1개월 기준 · 전체 합산 후 환산)</span>
          </div>
          {(() => {
            if (workHistoryDaily.length === 0) return (
              <div style={{ padding: "12px", textAlign: "center", color: "#9ca3af", fontSize: 12, border: "1px solid #fef3c7", borderRadius: 6 }}>일용직 이력 없음</div>
            );
            // 최신 사업장 계산
            const sorted = [...workHistoryDaily].sort((a, b) => (b.startYear * 12 + b.startMonth) - (a.startYear * 12 + a.startMonth));
            const latestCompany = sorted[0]?.company ?? "";
            const latestEntries = workHistoryDaily.filter(e => e.company === latestCompany);
            const otherEntries = workHistoryDaily.filter(e => e.company !== latestCompany);
            const latestDays = latestEntries.reduce((s, r) => s + Number(r.totalDays || 0), 0);
            const otherDays = otherEntries.reduce((s, r) => s + Number(r.totalDays || 0), 0);
            const totalDays = latestDays + otherDays;
            const latestEarliestStart = latestEntries.reduce((min, e) => {
              const v = e.startYear * 12 + e.startMonth;
              return v < min ? v : min;
            }, Infinity);
            const otherEarliestStart = otherEntries.length > 0 ? otherEntries.reduce((min, e) => {
              const v = e.startYear * 12 + e.startMonth;
              return v < min ? v : min;
            }, Infinity) : 0;
            const toYM = (v: number) => v === Infinity || v === 0 ? "—" : `${Math.floor(v / 12)}.${String(v % 12).padStart(2, "0")}`;
            const latestJobType = latestEntries[0]?.jobType ?? "";
            const latestSource = [...new Set(latestEntries.map(e => e.source))].join("/");
            const otherSources = [...new Set(otherEntries.map(e => e.source))].join("/");
            return (
              <div style={{ overflowX: "auto", marginBottom: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#fef9ec" }}>
                      {["사업장(대표)", "직종", "총 근무일수", "최초 근무", "출처"].map(h => (
                        <th key={h} style={{ padding: "5px 6px", border: "1px solid #fcd34d", fontWeight: 600, color: "#92400e", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", fontWeight: 600 }}>{latestCompany || "—"}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", fontSize: 11, color: "#6b7280" }}>{latestJobType}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", textAlign: "center", fontWeight: 700, color: "#b45309" }}>{latestDays}일</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", textAlign: "center", fontSize: 11, color: "#6b7280" }}>{toYM(latestEarliestStart)}</td>
                      <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", fontSize: 11, color: "#6b7280" }}>{latestSource}</td>
                    </tr>
                    {otherDays > 0 && (
                      <tr style={{ background: "#fffbeb" }}>
                        <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", color: "#92400e", fontStyle: "italic" }}>그 외 직업력</td>
                        <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", fontSize: 11, color: "#9ca3af" }}>다수</td>
                        <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", textAlign: "center", fontWeight: 700, color: "#b45309" }}>{otherDays}일</td>
                        <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", textAlign: "center", fontSize: 11, color: "#6b7280" }}>{toYM(otherEarliestStart)}</td>
                        <td style={{ padding: "4px 8px", border: "1px solid #fef3c7", fontSize: 11, color: "#6b7280" }}>{otherSources}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#fef9ec" }}>
                      <td colSpan={2} style={{ padding: "4px 8px", border: "1px solid #fcd34d", fontWeight: 700, color: "#92400e", textAlign: "right" }}>합계</td>
                      <td colSpan={3} style={{ padding: "4px 8px", border: "1px solid #fcd34d", fontWeight: 700, color: "#b45309" }}>
                        {totalDays}일 → <strong>{calcDuration(Math.ceil(totalDays / 20))}</strong>
                        <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>({totalDays}일 ÷ 20, 올림)</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>※ 상세 내역 {workHistoryDaily.length}건 집계 (최신 사업장 기준 요약)</div>
              </div>
            );
          })()}
        </div>

        {/* 마지막 소음작업 중단일 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>마지막 소음작업 중단 시기</label>
            <input type="date" style={inputStyle} value={lastNoiseWorkEndDate?.slice(0, 10) ?? ""}
              onChange={(e) => onChange({ lastNoiseWorkEndDate: e.target.value || null })} />
          </div>
        </div>

        {/* 특이사항 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>특이사항</label>
            <button onClick={() => setShowMemoModal(true)} style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#6b7280" }}>↗ 새창</button>
          </div>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
            value={workHistoryMemo ?? ""} onChange={(e) => onChange({ workHistoryMemo: e.target.value || null })} placeholder="특이사항을 입력하세요..." />
        </div>
      </div>
    </div>
  );
}

// ── 메인 섹션 컴포넌트 (compact summary + drawer 토글만 담당) ─────────────
export function WorkHistorySection({
  caseId,
  workHistory,
  workHistoryRaw,
  workHistoryDaily,
  workHistoryMemo,
  lastNoiseWorkEndDate,
  onChange,
  onChangeDaily,
  onSaveLastDate,
}: WorkHistorySectionProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const RAW_SOURCES = ["고용산재", "건보", "소득금액", "연금", "건근공", "일용직"] as const;
  const totalRawEntries = RAW_SOURCES.reduce((s, src) => s + (workHistoryRaw[src]?.length ?? 0), 0);
  const noiseEntryCount = workHistory.filter(e => e.noiseExposure).length;

  const toM = (y: number, m: number) => y * 12 + m;
  const allIv = workHistory.map(e => ({ start: toM(e.startYear, e.startMonth), end: toM(e.endYear, e.endMonth) }));
  const totalDaySum = workHistoryDaily.reduce((s, r) => s + Number(r.totalDays || 0), 0);
  const totalMonths = calcUnionMonths(allIv) + (totalDaySum > 0 ? Math.ceil(totalDaySum / 20) : 0);

  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", padding: "14px 0 8px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 12 }}>직업력</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#374151" }}>원시데이터: <strong>{totalRawEntries}개</strong></span>
          {workHistory.length > 0 && <span style={{ fontSize: 12, color: "#15803d" }}>합산완료: <strong>{workHistory.length}개사</strong></span>}
          {noiseEntryCount > 0 && (
            <span style={{ fontSize: 12, color: "#dc2626", background: "#fee2e2", padding: "1px 8px", borderRadius: 6 }}>소음노출 <strong>{noiseEntryCount}개</strong></span>
          )}
          {totalMonths > 0 && (
            <span style={{ fontSize: 12, color: "#111827", fontWeight: 700, background: "#dcfce7", padding: "2px 10px", borderRadius: 6 }}>{calcDuration(totalMonths)}</span>
          )}
          {lastNoiseWorkEndDate && <span style={{ fontSize: 11, color: "#6b7280" }}>소음중단: {lastNoiseWorkEndDate.slice(0, 7)}</span>}
        </div>
        <button onClick={() => setIsDrawerOpen(true)} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          직업력 편집 →
        </button>
      </div>

      {/* 드로어: WorkHistoryDrawerContent는 독립 컴포넌트 → DOM 재사용 보장 */}
      {isDrawerOpen && (
        <>
          <div onClick={() => setIsDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 900 }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(820px, 85vw)", background: "white", zIndex: 901, boxShadow: "-8px 0 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <WorkHistoryDrawerContent
              caseId={caseId}
              workHistory={workHistory}
              workHistoryRaw={workHistoryRaw}
              workHistoryDaily={workHistoryDaily}
              workHistoryMemo={workHistoryMemo}
              lastNoiseWorkEndDate={lastNoiseWorkEndDate}
              onChange={onChange}
              onChangeDaily={onChangeDaily}
              onSaveLastDate={onSaveLastDate}
              onClose={() => setIsDrawerOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
