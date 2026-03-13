"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { TF_BY_BRANCH, TF_TO_BRANCH } from "@/lib/constants/tf";

const BATCH_SIZE = 30;

type SheetResult = { created: number; skipped: number; errors: string[]; totalRows: number };

const SHEET_PATTERNS: Array<{
  match: (n: string) => boolean;
  caseType: string;
  label: string;
}> = [
  { match: (n) => n.includes("소음성난청") || n.includes("소음성 난청"), caseType: "HEARING_LOSS",          label: "소음성 난청" },
  { match: (n) => n.includes("진폐"),                                    caseType: "PNEUMOCONIOSIS",        label: "진폐" },
  { match: (n) => n.toUpperCase().includes("COPD"),                      caseType: "COPD",                  label: "COPD" },
  { match: (n) => n.includes("직업성 암") || n.includes("직업성암"),     caseType: "OCCUPATIONAL_CANCER",   label: "직업성 암" },
  { match: (n) => n.includes("유족"),                                    caseType: "BEREAVED",              label: "유족" },
  { match: (n) => n.includes("근골격계"),                                caseType: "MUSCULOSKELETAL",       label: "근골격계" },
  { match: (n) => n.includes("업무상 사고") || n.includes("업무상사고"), caseType: "OCCUPATIONAL_ACCIDENT", label: "업무상 사고" },
];

const CASE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SHEET_PATTERNS.map((p) => [p.caseType, p.label])
);

function sanitizeRows(rows: unknown[][]): (string | null)[][] {
  return rows.map(row =>
    (row as unknown[]).map(val => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString();
      return String(val);
    })
  );
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, SheetResult> | null>(null);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number; sheetStep: number; sheetTotal: number } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedTf, setSelectedTf] = useState<string>("");

  const selectedBranch = selectedTf ? TF_TO_BRANCH[selectedTf] ?? "" : "";

  const handleFile = (f: File) => {
    setFile(f);
    setResults(null);
    setServerError(null);
    setProgress(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !selectedTf) return;
    setLoading(true);
    setResults(null);
    setServerError(null);
    setProgress(null);

    try {
      // 파일을 클라이언트에서 읽어 시트 목록 파악
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

      const matchingSheets = wb.SheetNames
        .map((sheetName) => {
          const pattern = SHEET_PATTERNS.find((p) => p.match(sheetName));
          return pattern ? { sheetName, caseType: pattern.caseType, label: pattern.label } : null;
        })
        .filter(Boolean) as Array<{ sheetName: string; caseType: string; label: string }>;

      if (matchingSheets.length === 0) {
        setServerError("처리할 시트가 없습니다 (소음성난청·진폐·COPD·직업성암·유족·근골격계·업무상사고)");
        return;
      }

      // 시트별 rows 추출 (클라이언트에서 파싱 — 서버 OOM 방지)
      const accumulated: Record<string, SheetResult> = {};

      for (let i = 0; i < matchingSheets.length; i++) {
        const { sheetName, caseType, label } = matchingSheets[i];

        const ws = wb.Sheets[sheetName];
        const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        // 헤더 행 탐색
        const headerRowIdx = allRows.findIndex(row =>
          (row as unknown[]).some(c => c === "연번" || c === "성명" || c === "재해자명")
        );
        if (headerRowIdx === -1) {
          accumulated[caseType] = { created: 0, skipped: 0, errors: ["헤더 행을 찾을 수 없습니다"], totalRows: 0 };
          setResults({ ...accumulated });
          continue;
        }

        const header = allRows[headerRowIdx] as unknown[];
        const prevHeader = headerRowIdx > 0 ? (allRows[headerRowIdx - 1] as unknown[]) : [];
        const dataRows = allRows.slice(headerRowIdx + 1);
        const totalRows = dataRows.length;

        let sheetCreated = 0, sheetSkipped = 0;
        const sheetErrors: string[] = [];

        for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
          setProgress({ label, done: offset, total: totalRows, sheetStep: i + 1, sheetTotal: matchingSheets.length });

          const batch = sanitizeRows(dataRows.slice(offset, offset + BATCH_SIZE));
          const res = await fetch("/api/import/all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseType, tfName: selectedTf, branch: selectedBranch, header: sanitizeRows([header])[0], prevHeader: sanitizeRows([prevHeader])[0], rows: batch }),
          });
          const data = await res.json();

          if (!res.ok) {
            sheetErrors.push(data.error ?? "오류");
            break;
          }

          const result = data.result as SheetResult;
          sheetCreated += result.created;
          sheetSkipped += result.skipped;
          sheetErrors.push(...result.errors);

          accumulated[caseType] = {
            created: sheetCreated,
            skipped: sheetSkipped,
            errors: sheetErrors.slice(0, 20),
            totalRows,
          };
          setResults({ ...accumulated });
        }
      }

      setProgress(null);
    } catch {
      setServerError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const allErrors = results
    ? Object.entries(results).flatMap(([caseType, r]) =>
        r.errors.map((e) => `[${CASE_TYPE_LABELS[caseType] ?? caseType}] ${e}`)
      )
    : [];

  const totalCreated = results ? Object.values(results).reduce((s, r) => s + r.created, 0) : 0;
  const totalSkipped = results ? Object.values(results).reduce((s, r) => s + r.skipped, 0) : 0;

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>ADMIN</p>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 24px 0" }}>데이터 임포트</h1>

      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        {/* TF 선택 */}
        <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 6 }}>TF 선택 <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              value={selectedTf}
              onChange={(e) => setSelectedTf(e.target.value)}
              style={{ border: `1px solid ${!selectedTf ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 6, padding: "7px 12px", fontSize: 13, color: selectedTf ? "#374151" : "#9ca3af", background: "#f9fafb", width: "100%" }}
            >
              <option value="">TF를 선택하세요</option>
              {Object.entries(TF_BY_BRANCH).map(([branch, tfs]) => (
                <optgroup key={branch} label={branch}>
                  {tfs.map((tf) => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 6 }}>지사</label>
            <input
              readOnly
              value={selectedBranch}
              placeholder="TF 선택 시 자동 표시"
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#6b7280", background: "#f3f4f6", width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* 파일 드롭존 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 6 }}>엑셀 파일 (.xlsx)</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragging ? "#2563eb" : "#d1d5db"}`,
              borderRadius: 8,
              padding: "32px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragging ? "#eff6ff" : "#f9fafb",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            {file ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 14, color: "#374151", marginBottom: 4 }}>파일을 드래그하거나 클릭하여 선택</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>.xlsx, .xls 파일 지원</div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {/* 주의사항 */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 6 }}>⚠ 주의사항</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#78350f", lineHeight: 1.8 }}>
            <li>파일의 시트를 하나씩 순차 처리합니다 (타임아웃 방지)</li>
            <li>같은 주민번호의 재해자가 이미 있으면 재사용됩니다</li>
            <li>같은 연번의 사건이 이미 있으면 건너뜁니다</li>
            <li>성명 뒤의 숫자(중복 구분용)는 자동으로 제거됩니다</li>
            <li>선택한 TF와 지사가 모든 임포트 데이터에 적용됩니다</li>
          </ul>
        </div>

        {/* 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!file || !selectedTf || loading}
          style={{
            background: !file || !selectedTf || loading ? "#9ca3af" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: !file || !selectedTf || loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {loading && (
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          )}
          {loading ? "임포트 중..." : "임포트 시작"}
        </button>
      </div>

      {/* 진행상황 */}
      {progress && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #93c5fd", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
              {progress.label} 처리 중...
              {progress.total > 0 && ` ${Math.min(progress.done + BATCH_SIZE, progress.total)}/${progress.total}건`}
              {" "}({progress.sheetStep}/{progress.sheetTotal} 시트)
            </div>
            <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }}>
              완료된 시트는 아래에서 확인할 수 있습니다
            </div>
          </div>
        </div>
      )}

      {/* 에러 */}
      {serverError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          ⚠ {serverError}
        </div>
      )}

      {/* 결과 */}
      {results && Object.keys(results).length > 0 && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
            임포트 결과
            {progress && <span style={{ fontSize: 12, fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>(처리 중...)</span>}
          </div>

          {/* 합계 */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#16a34a" }}>{totalCreated}</div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>총 생성</div>
            </div>
            <div style={{ flex: 1, background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#ca8a04" }}>{totalSkipped}</div>
              <div style={{ fontSize: 12, color: "#a16207", marginTop: 4 }}>총 건너뜀</div>
            </div>
            <div style={{ flex: 1, background: allErrors.length > 0 ? "#fef2f2" : "#f9fafb", border: `1px solid ${allErrors.length > 0 ? "#fecaca" : "#e5e7eb"}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: allErrors.length > 0 ? "#dc2626" : "#6b7280" }}>{allErrors.length}</div>
              <div style={{ fontSize: 12, color: allErrors.length > 0 ? "#b91c1c" : "#9ca3af", marginTop: 4 }}>총 오류</div>
            </div>
          </div>

          {/* 상병별 결과 */}
          <div style={{ marginBottom: allErrors.length > 0 ? 16 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>상병별 결과</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              {Object.entries(results).map(([caseType, r], i) => (
                <div
                  key={caseType}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                    background: "white",
                  }}
                >
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    {CASE_TYPE_LABELS[caseType] ?? caseType}
                  </div>
                  <div style={{ fontSize: 13, color: "#16a34a", marginRight: 16 }}>
                    생성 <strong>{r.created}</strong>건
                  </div>
                  <div style={{ fontSize: 13, color: "#ca8a04", marginRight: 16 }}>
                    건너뜀 <strong>{r.skipped}</strong>건
                  </div>
                  {r.errors.length > 0 && (
                    <div style={{ fontSize: 13, color: "#dc2626" }}>
                      오류 <strong>{r.errors.length}</strong>건
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 오류 목록 */}
          {allErrors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>오류 목록</div>
              <div style={{ background: "#fef2f2", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#991b1b", lineHeight: 1.8, maxHeight: 200, overflowY: "auto" }}>
                {allErrors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
