"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { TF_BY_BRANCH, TF_TO_BRANCH } from "@/lib/constants/tf";

const BATCH_SIZE = 50;

const DISEASE_OPTIONS = [
  { value: "HEARING_LOSS", label: "소음성 난청", apiPath: "/api/import/hearing-loss" },
  // 추후 확장 예정
];

function sanitizeRows(rows: unknown[][]): (string | null)[][] {
  return rows.map(row =>
    (row as unknown[]).map(val => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString();
      return String(val);
    })
  );
}

type ImportResult = { created: number; skipped: number; errors: string[] };

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedTf, setSelectedTf] = useState<string>("");
  const [selectedDisease] = useState(DISEASE_OPTIONS[0]);

  const selectedBranch = selectedTf ? TF_TO_BRANCH[selectedTf] ?? "" : "";

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
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
    setResult(null);
    setServerError(null);
    setProgress(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

      // 소음성 난청 시트 찾기
      const sheetName = wb.SheetNames.find(n => n.includes("소음성난청") || n.includes("소음성 난청"));
      if (!sheetName) {
        setServerError("소음성난청 시트를 찾을 수 없습니다");
        return;
      }

      const ws = wb.Sheets[sheetName];
      const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      // 헤더 행 탐색
      const headerRowIdx = allRows.findIndex(row =>
        (row as unknown[]).some(c => c === "연번" || c === "성명")
      );
      if (headerRowIdx === -1) {
        setServerError("헤더 행을 찾을 수 없습니다");
        return;
      }

      const header = sanitizeRows([allRows[headerRowIdx] as unknown[]])[0];
      const prevHeader = headerRowIdx > 0
        ? sanitizeRows([allRows[headerRowIdx - 1] as unknown[]])[0]
        : [];
      const dataRows = allRows.slice(headerRowIdx + 1);
      const totalRows = dataRows.length;

      let totalCreated = 0, totalSkipped = 0;
      const allErrors: string[] = [];

      for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
        setProgress({ done: offset, total: totalRows });

        const batch = sanitizeRows(dataRows.slice(offset, offset + BATCH_SIZE));
        const res = await fetch(selectedDisease.apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tfName: selectedTf,
            branch: selectedBranch,
            header,
            prevHeader,
            rows: batch,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setServerError(data.error ?? "서버 오류");
          break;
        }

        totalCreated += data.created ?? 0;
        totalSkipped += data.skipped ?? 0;
        allErrors.push(...(data.errors ?? []));

        setResult({
          created: totalCreated,
          skipped: totalSkipped,
          errors: allErrors.slice(0, 20),
        });
      }

      setProgress(null);
    } catch {
      setServerError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>ADMIN</p>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 24px 0" }}>데이터 임포트</h1>

      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        {/* 상병 선택 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 6 }}>상병</label>
          <select
            value={selectedDisease.value}
            disabled
            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#374151", background: "#f3f4f6", width: "100%" }}
          >
            {DISEASE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

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
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
            처리 중...
            {progress.total > 0 && ` ${Math.min(progress.done + BATCH_SIZE, progress.total)}/${progress.total}건`}
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
      {result && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
            임포트 결과
            {loading && <span style={{ fontSize: 12, fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>(처리 중...)</span>}
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: result.errors.length > 0 ? 20 : 0 }}>
            <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#16a34a" }}>{result.created}</div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>생성</div>
            </div>
            <div style={{ flex: 1, background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#ca8a04" }}>{result.skipped}</div>
              <div style={{ fontSize: 12, color: "#a16207", marginTop: 4 }}>건너뜀</div>
            </div>
            <div style={{ flex: 1, background: result.errors.length > 0 ? "#fef2f2" : "#f9fafb", border: `1px solid ${result.errors.length > 0 ? "#fecaca" : "#e5e7eb"}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: result.errors.length > 0 ? "#dc2626" : "#6b7280" }}>{result.errors.length}</div>
              <div style={{ fontSize: 12, color: result.errors.length > 0 ? "#b91c1c" : "#9ca3af", marginTop: 4 }}>오류</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>오류 목록</div>
              <div style={{ background: "#fef2f2", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#991b1b", lineHeight: 1.8, maxHeight: 200, overflowY: "auto" }}>
                {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
