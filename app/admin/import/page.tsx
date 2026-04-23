"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useBranches } from "@/lib/hooks/useBranches";

const BATCH_SIZE = 50;

const DISEASE_OPTIONS = [
  {
    value: "HEARING_LOSS",
    label: "소음성 난청",
    apiPath: "/api/import/hearing-loss",
    matchSheet: (n: string) => n.includes("소음성난청") || n.includes("소음성 난청"),
  },
  {
    value: "COPD",
    label: "COPD",
    apiPath: "/api/import/copd",
    matchSheet: (n: string) => n.toUpperCase().includes("COPD"),
  },
  {
    value: "PNEUMOCONIOSIS",
    label: "진폐",
    apiPath: "/api/import/pneumoconiosis",
    matchSheet: (n: string) => n.includes("진폐"),
  },
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

function ConfirmModal({ message, onConfirm, onCancel, confirming }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 28, zIndex: 1000, minWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 12 }}>삭제 확인</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 8, whiteSpace: "pre-line" }}>{message}</div>
        <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 24 }}>이 작업은 되돌릴 수 없습니다.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={confirming} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} disabled={confirming} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: confirming ? 0.6 : 1 }}>
            {confirming ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function ImportPage() {
  const { tfByBranch: TF_BY_BRANCH, tfToBranch: TF_TO_BRANCH } = useBranches();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedTf, setSelectedTf] = useState<string>("");
  const [selectedDisease, setSelectedDisease] = useState(DISEASE_OPTIONS[0]);

  const [deleteTf, setDeleteTf] = useState<string>("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [unassignedModal, setUnassignedModal] = useState(false);
  const [unassignedDeleting, setUnassignedDeleting] = useState(false);
  const [unassignedResult, setUnassignedResult] = useState<string | null>(null);

  const [simpleDeleteModal, setSimpleDeleteModal] = useState<{ title: string; message: string; apiPath: string } | null>(null);
  const [simpleDeleteConfirming, setSimpleDeleteConfirming] = useState(false);
  const [simpleDeleteResult, setSimpleDeleteResult] = useState<{ apiPath: string; text: string } | null>(null);

  type WageDataItem = { id: string; tfName: string; patientName: string; caseType: string; decisionDate: string | null };
  const [wageDataList, setWageDataList] = useState<WageDataItem[]>([]);
  const [wageDataLoading, setWageDataLoading] = useState(false);
  const [wageDataLoaded, setWageDataLoaded] = useState(false);
  const [selectedWageIds, setSelectedWageIds] = useState<Set<string>>(new Set());
  const [wageDeleteConfirm, setWageDeleteConfirm] = useState(false);
  const [wageDeleteConfirming, setWageDeleteConfirming] = useState(false);

  // ─── 전체 싱크 상태 ────────────────────────────────────────────────────
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ reviewAutoLinked: number; caseAutoLinked: number; caseStatusUpdated: number; hlDecisionUpdated: number; errors: string[] } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const runSyncAll = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/admin/sync-all-cases", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSyncError(data.error ?? "싱크 오류"); return; }
      setSyncResult(data.stats);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSyncLoading(false);
    }
  };

  // ─── HL 검증+임포트 상태 (기존 file/selectedTf/selectedBranch 재사용) ───
  const [hlVerifying, setHlVerifying] = useState(false);
  const [hlImporting, setHlImporting] = useState(false);
  const [hlVerifyResult, setHlVerifyResult] = useState<any>(null);
  const [hlImportResult, setHlImportResult] = useState<any>(null);
  const [hlError, setHlError] = useState<string | null>(null);

  const loadWageData = async () => {
    setWageDataLoading(true);
    try {
      const res = await fetch("/api/admin/wage-data");
      if (res.ok) { const data = await res.json(); setWageDataList(Array.isArray(data) ? data : []); setWageDataLoaded(true); }
    } catch { /* silent */ } finally { setWageDataLoading(false); }
  };

  const handleWageDelete = async () => {
    if (selectedWageIds.size === 0) return;
    setWageDeleteConfirming(true);
    try {
      const res = await fetch("/api/admin/wage-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedWageIds) }),
      });
      if (res.ok) {
        setWageDataList((prev) => prev.filter((i) => !selectedWageIds.has(i.id)));
        setSelectedWageIds(new Set());
        setWageDeleteConfirm(false);
      }
    } catch { /* silent */ } finally { setWageDeleteConfirming(false); }
  };

  const [hlParsedRows, setHlParsedRows] = useState<any[][] | null>(null);

  const parseHlFile = async (): Promise<any[][] | null> => {
    if (hlParsedRows) return hlParsedRows;
    if (!file) return null;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames.find(n => n === "변환결과")
      ?? wb.SheetNames.find(n => n.includes("TF"))
      ?? wb.SheetNames.find(n => !n.toLowerCase().startsWith("chart"))
      ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as any[][];
    setHlParsedRows(rows);
    return rows;
  };

  const handleHlVerify = async () => {
    if (!file || !selectedTf) return;
    setHlVerifying(true);
    setHlVerifyResult(null);
    setHlImportResult(null);
    setHlError(null);
    try {
      const rows = await parseHlFile();
      if (!rows) { setHlError("파일 파싱 실패"); return; }
      const res = await fetch("/api/admin/import-hearing-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "verify", rows, tfName: selectedTf, branch: selectedBranch }),
      });
      const data = await res.json();
      if (!res.ok) { setHlError(data.error ?? "검증 오류"); return; }
      setHlVerifyResult(data);
    } catch { setHlError("네트워크 오류가 발생했습니다"); }
    finally { setHlVerifying(false); }
  };

  const handleHlImport = async () => {
    if (!file || !selectedTf) return;
    setHlImporting(true);
    setHlImportResult(null);
    setHlError(null);
    try {
      const rows = await parseHlFile();
      if (!rows) { setHlError("파일 파싱 실패"); return; }
      const res = await fetch("/api/admin/import-hearing-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import", rows, tfName: selectedTf, branch: selectedBranch }),
      });
      const data = await res.json();
      if (!res.ok) { setHlError(data.error ?? "임포트 오류"); return; }
      setHlImportResult(data);
    } catch { setHlError("네트워크 오류가 발생했습니다"); }
    finally { setHlImporting(false); }
  };

  const selectedBranch = selectedTf ? TF_TO_BRANCH[selectedTf] ?? "" : "";

  const handleFile = (f: File) => {
    setFile(f);
    setHlParsedRows(null);
    setResult(null);
    setServerError(null);
    setProgress(null);
    setHlVerifyResult(null);
    setHlImportResult(null);
    setHlError(null);
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
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    setResult(null);
    setServerError(null);
    setProgress(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

      // 상병에 맞는 시트 찾기
      const sheetName = wb.SheetNames.find(n => selectedDisease.matchSheet(n));
      if (!sheetName) {
        setServerError(`${selectedDisease.label} 시트를 찾을 수 없습니다`);
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
      const dataRows = allRows.slice(headerRowIdx + 1).filter(row =>
        (row as unknown[]).some(c => c !== null && c !== undefined && String(c).trim() !== "")
      );
      const totalRows = dataRows.length;

      let totalCreated = 0, totalSkipped = 0;
      const allErrors: string[] = [];

      for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
        setProgress({ done: offset, total: totalRows });
        document.title = `임포트 중... ${offset}/${totalRows}건`;

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
      document.title = "데이터 임포트 | TBSS";
    } catch {
      setServerError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
      window.removeEventListener("beforeunload", beforeUnload);
      setProgress(null);
      document.title = "데이터 임포트 | TBSS";
    }
  };

  const handleSimpleDelete = async () => {
    if (!simpleDeleteModal) return;
    setSimpleDeleteConfirming(true);
    try {
      const res = await fetch(simpleDeleteModal.apiPath, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setSimpleDeleteResult({ apiPath: simpleDeleteModal.apiPath, text: `오류: ${data.error ?? "삭제 실패"}` }); }
      else { setSimpleDeleteResult({ apiPath: simpleDeleteModal.apiPath, text: data.message ?? `삭제 완료: ${data.deleted}건` }); }
    } catch {
      setSimpleDeleteResult({ apiPath: simpleDeleteModal.apiPath, text: "네트워크 오류가 발생했습니다" });
    } finally {
      setSimpleDeleteConfirming(false);
      setSimpleDeleteModal(null);
    }
  };

  const handleDeleteTf = async () => {
    setDeleteConfirming(true);
    try {
      const res = await fetch("/api/admin/delete-tf", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tfName: deleteTf }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteResult(`오류: ${data.error ?? "삭제 실패"}`); }
      else { setDeleteResult(`${deleteTf} TF의 ${data.deletedCases}건이 삭제되었습니다.`); setDeleteTf(""); }
    } catch {
      setDeleteResult("네트워크 오류가 발생했습니다");
    } finally {
      setDeleteConfirming(false);
      setDeleteModal(false);
    }
  };

  const handleDeleteUnassigned = async () => {
    setUnassignedDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-tf", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unassigned: true }),
      });
      const data = await res.json();
      if (!res.ok) { setUnassignedResult(`오류: ${data.error ?? "삭제 실패"}`); }
      else { setUnassignedResult(`TF 미배정 사건 ${data.deletedCases}건이 삭제되었습니다.`); }
    } catch {
      setUnassignedResult("네트워크 오류가 발생했습니다");
    } finally {
      setUnassignedDeleting(false);
      setUnassignedModal(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>ADMIN</p>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: "0 0 24px 0" }}>데이터 임포트</h1>

      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        {/* 상병 선택 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 6 }}>상병</label>
          <select
            value={selectedDisease.value}
            onChange={(e) => {
              const opt = DISEASE_OPTIONS.find(o => o.value === e.target.value);
              if (opt) { setSelectedDisease(opt); setResult(null); setServerError(null); setHlVerifyResult(null); setHlImportResult(null); setHlError(null); }
            }}
            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", width: "100%", cursor: "pointer" }}
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
              border: `2px dashed ${dragging ? "#29ABE2" : "#d1d5db"}`,
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

        {/* 버튼 — 소음성 난청: 검증→임포트, 기타: 직접 임포트 */}
        {selectedDisease.value === "HEARING_LOSS" ? (
          <button
            onClick={handleHlVerify}
            disabled={!file || !selectedTf || hlVerifying}
            style={{
              background: !file || !selectedTf || hlVerifying ? "#9ca3af" : "#1d4ed8",
              color: "white", border: "none", borderRadius: 6, padding: "10px 24px",
              fontSize: 14, fontWeight: 700,
              cursor: !file || !selectedTf || hlVerifying ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {hlVerifying && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {hlVerifying ? "검증 중..." : "검증 실행"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!file || !selectedTf || loading}
            style={{
              background: !file || !selectedTf || loading ? "#9ca3af" : "#29ABE2",
              color: "white", border: "none", borderRadius: 6, padding: "10px 24px",
              fontSize: 14, fontWeight: 700,
              cursor: !file || !selectedTf || loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {loading && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {loading ? "임포트 중..." : "임포트 시작"}
          </button>
        )}
      </div>

      {/* 진행상황 */}
      {progress && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #93c5fd", borderTopColor: "#29ABE2", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
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

      {/* HL 검증 에러 */}
      {selectedDisease.value === "HEARING_LOSS" && hlError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {hlError}
        </div>
      )}

      {/* HL 검증 결과 */}
      {selectedDisease.value === "HEARING_LOSS" && hlVerifyResult && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12 }}>검증 결과</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{hlVerifyResult.total}</div>
              <div style={{ fontSize: 11, color: "#15803d" }}>총 건수</div>
            </div>
            <div style={{ background: hlVerifyResult.summary?.missingRequiredCount > 0 ? "#fef2f2" : "#f0fdf4", border: `1px solid ${hlVerifyResult.summary?.missingRequiredCount > 0 ? "#fecaca" : "#bbf7d0"}`, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: hlVerifyResult.summary?.missingRequiredCount > 0 ? "#dc2626" : "#16a34a" }}>{hlVerifyResult.summary?.missingRequiredCount ?? 0}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>필수값 누락</div>
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ca8a04" }}>{hlVerifyResult.summary?.managerMismatchCount ?? 0}</div>
              <div style={{ fontSize: 11, color: "#92400e" }}>담당자 미매핑</div>
            </div>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1d4ed8" }}>{hlVerifyResult.summary?.ssnDuplicateCount ?? 0}</div>
              <div style={{ fontSize: 11, color: "#1e40af" }}>SSN 중복 (업데이트)</div>
            </div>
          </div>
          {hlVerifyResult.missingRequired?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>필수값 누락 목록</div>
              <div style={{ background: "#fef2f2", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#991b1b", lineHeight: 1.8 }}>
                {hlVerifyResult.missingRequired.map((m: any, i: number) => (
                  <div key={i}>행 {m.row}: {m.field} 없음 (읽힌 값: {m.rawValue ?? '-'})</div>
                ))}
              </div>
            </div>
          )}
          {hlVerifyResult.managerMismatches?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>담당자 미매핑 목록</div>
              <div style={{ background: "#fffbeb", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#78350f", lineHeight: 1.8 }}>
                {hlVerifyResult.managerMismatches.map((m: any, i: number) => (
                  <div key={i}>{m.value} ({m.field}, {m.occurrences}건) — DB에 없는 이름</div>
                ))}
              </div>
            </div>
          )}
          {hlVerifyResult.statusWarnings?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>잘못된 상태값</div>
              <div style={{ background: "#fef2f2", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#991b1b", lineHeight: 1.8 }}>
                {hlVerifyResult.statusWarnings.map((w: any, i: number) => (
                  <div key={i}>행 {w.row}: {w.value}</div>
                ))}
              </div>
            </div>
          )}
          {hlVerifyResult.dbUsers && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              DB 등록 User 목록: {hlVerifyResult.dbUsers.join(", ")}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px", lineHeight: 1.8 }}>
            <div><strong>감지된 헤더:</strong> {(hlVerifyResult.korHeaders ?? []).join(" | ") || "(없음)"}</div>
            <div><strong>진행상태 분포:</strong> {hlVerifyResult.statusDistribution ? Object.entries(hlVerifyResult.statusDistribution as Record<string, number>).map(([k, v]) => `${k}(${v}건)`).join(", ") : "(데이터 없음)"}</div>
          </div>
          {hlVerifyResult.summary?.ssnDuplicateCount > 0 && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "8px 12px" }}>
              SSN 중복 {hlVerifyResult.summary.ssnDuplicateCount}건은 기존 사건을 업데이트(덮어쓰기)합니다.
            </div>
          )}
          <button
            onClick={handleHlImport}
            disabled={hlImporting || !hlVerifyResult.summary?.readyToImport}
            style={{
              background: hlImporting || !hlVerifyResult.summary?.readyToImport ? "#9ca3af" : "#16a34a",
              color: "white", border: "none", borderRadius: 6, padding: "10px 24px",
              fontSize: 14, fontWeight: 700,
              cursor: hlImporting || !hlVerifyResult.summary?.readyToImport ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {hlImporting && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {hlImporting ? "임포트 중..." : "실제 임포트 실행"}
          </button>
          {!hlVerifyResult.summary?.readyToImport && (
            <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>
              필수값 누락 또는 잘못된 상태값이 있어 임포트할 수 없습니다.
            </div>
          )}
        </div>
      )}

      {/* HL 임포트 결과 */}
      {selectedDisease.value === "HEARING_LOSS" && hlImportResult && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #bbf7d0", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12 }}>임포트 결과</div>
          <div style={{ display: "flex", gap: 12, marginBottom: hlImportResult.errors?.length > 0 ? 16 : 0 }}>
            <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#16a34a" }}>{hlImportResult.created}</div>
              <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>신규 생성</div>
            </div>
            <div style={{ flex: 1, background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#ca8a04" }}>{hlImportResult.updated}</div>
              <div style={{ fontSize: 12, color: "#a16207", marginTop: 4 }}>업데이트</div>
            </div>
            <div style={{ flex: 1, background: hlImportResult.errors?.length > 0 ? "#fef2f2" : "#f9fafb", border: `1px solid ${hlImportResult.errors?.length > 0 ? "#fecaca" : "#e5e7eb"}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: hlImportResult.errors?.length > 0 ? "#dc2626" : "#6b7280" }}>{hlImportResult.errors?.length ?? 0}</div>
              <div style={{ fontSize: 12, color: hlImportResult.errors?.length > 0 ? "#b91c1c" : "#9ca3af", marginTop: 4 }}>오류</div>
            </div>
          </div>
          {hlImportResult.errors?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>오류 목록</div>
              <div style={{ background: "#fef2f2", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#991b1b", lineHeight: 1.8, maxHeight: 200, overflowY: "auto" }}>
                {hlImportResult.errors.map((e: any, i: number) => (
                  <div key={i}>행 {e.row}: {e.name} ({e.ssn}) — {e.error}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TF 데이터 삭제 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #fecaca", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#dc2626", marginBottom: 16 }}>TF 데이터 삭제</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 6 }}>삭제할 TF 선택</label>
            <select
              value={deleteTf}
              onChange={(e) => { setDeleteTf(e.target.value); setDeleteResult(null); }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: deleteTf ? "#374151" : "#9ca3af", background: "#f9fafb", width: "100%" }}
            >
              <option value="">TF를 선택하세요</option>
              {Object.entries(TF_BY_BRANCH).map(([branch, tfs]) => (
                <optgroup key={branch} label={branch}>
                  {tfs.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setDeleteResult(null); setDeleteModal(true); }}
            disabled={!deleteTf}
            style={{ background: !deleteTf ? "#9ca3af" : "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: !deleteTf ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
          >
            선택한 TF 전체 삭제
          </button>
        </div>
        {deleteResult && (
          <div style={{ marginTop: 12, fontSize: 13, color: deleteResult.startsWith("오류") ? "#dc2626" : "#16a34a", background: deleteResult.startsWith("오류") ? "#fef2f2" : "#f0fdf4", border: `1px solid ${deleteResult.startsWith("오류") ? "#fecaca" : "#bbf7d0"}`, borderRadius: 6, padding: "8px 12px" }}>
            {deleteResult}
          </div>
        )}
      </div>

      {/* TF 미배정 데이터 삭제 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #fecaca", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#dc2626", marginBottom: 12 }}>TF 미배정 데이터 삭제</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, lineHeight: 1.6 }}>
          TF가 배정되지 않은(tfName이 null인) 모든 사건과 관련 데이터를 삭제합니다.
        </div>
        <button
          onClick={() => { setUnassignedResult(null); setUnassignedModal(true); }}
          style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          TF 미배정 전체 삭제
        </button>
        {unassignedResult && (
          <div style={{ marginTop: 12, fontSize: 13, color: unassignedResult.startsWith("오류") ? "#dc2626" : "#16a34a", background: unassignedResult.startsWith("오류") ? "#fef2f2" : "#f0fdf4", border: `1px solid ${unassignedResult.startsWith("오류") ? "#fecaca" : "#bbf7d0"}`, borderRadius: 6, padding: "8px 12px" }}>
            {unassignedResult}
          </div>
        )}
      </div>

      {unassignedModal && (
        <ConfirmModal
          message="TF가 배정되지 않은 모든 사건을 삭제합니다."
          onConfirm={handleDeleteUnassigned}
          onCancel={() => setUnassignedModal(false)}
          confirming={unassignedDeleting}
        />
      )}

      {deleteModal && (
        <ConfirmModal
          message={`${deleteTf} TF의 모든 사건을 삭제합니다.`}
          onConfirm={handleDeleteTf}
          onCancel={() => setDeleteModal(false)}
          confirming={deleteConfirming}
        />
      )}

      {/* ─── 업무 데이터 전체 삭제 ─── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#dc2626", marginBottom: 12 }}>업무 데이터 전체 삭제</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          {[
            {
              title: "상담내역 전체 삭제",
              description: "상담 관리 페이지의 모든 상담내역 데이터를 삭제합니다.",
              buttonLabel: "상담내역 삭제",
              apiPath: "/api/admin/delete-consultations",
              confirmMessage: "상담내역 데이터를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            },
            {
              title: "처분검토 전체 삭제",
              description: "처분검토 페이지의 모든 데이터를 삭제합니다.",
              buttonLabel: "처분검토 삭제",
              apiPath: "/api/admin/delete-objection-reviews",
              confirmMessage: "처분검토 데이터를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            },
            {
              title: "기일관리 전체 삭제",
              description: "이의제기 기일관리 페이지의 모든 데이터를 삭제합니다.",
              buttonLabel: "기일관리 삭제",
              apiPath: "/api/admin/delete-objection-cases",
              confirmMessage: "기일관리 데이터를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            },
            {
              title: "평균임금 데이터 전체 삭제",
              description: "평균임금 데이터 검토 페이지의 모든 데이터를 삭제합니다.",
              buttonLabel: "평균임금 데이터 삭제",
              apiPath: "/api/admin/wage-data",
              confirmMessage: "평균임금 데이터를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            },
          ].map((item) => {
            const result = simpleDeleteResult?.apiPath === item.apiPath ? simpleDeleteResult.text : null;
            return (
              <div key={item.apiPath} style={{ background: "white", borderRadius: 10, border: "1px solid #fecaca", padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 14 }}>{item.description}</div>
                <button
                  onClick={() => { setSimpleDeleteResult(null); setSimpleDeleteModal({ title: item.title, message: item.confirmMessage, apiPath: item.apiPath }); }}
                  style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}
                >
                  {item.buttonLabel}
                </button>
                {result && (
                  <div style={{ marginTop: 10, fontSize: 12, color: result.startsWith("오류") ? "#dc2626" : "#16a34a", background: result.startsWith("오류") ? "#fef2f2" : "#f0fdf4", border: `1px solid ${result.startsWith("오류") ? "#fecaca" : "#bbf7d0"}`, borderRadius: 6, padding: "7px 10px" }}>
                    {result}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {simpleDeleteModal && (
        <ConfirmModal
          message={simpleDeleteModal.message}
          onConfirm={handleSimpleDelete}
          onCancel={() => setSimpleDeleteModal(null)}
          confirming={simpleDeleteConfirming}
        />
      )}

      {/* ─── 업무 데이터 임포트 (상담/이의제기/평임) ─── */}
      <div style={{ marginTop: 40 }} id="tf-import-main">
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 2, marginBottom: 4 }}>ADMIN</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: "0 0 20px 0" }}>업무 데이터 임포트</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ImportCard
            title="상담 내역 임포트"
            description="엑셀 파일의 '총 접수현황' 시트를 읽어 상담 관리 DB에 등록합니다."
            accept=".xlsx,.xls"
            apiPath="/api/admin/import/consultation"
            notice="동일 성명+연락처가 있으면 업데이트, 없으면 신규 등록합니다."
          />
          <ImportCard
            title="최초총현황 + 평임검토 임포트"
            description="승불자 관리파일의 '최초총현황' 시트와 '평임 데이터 검토' 시트를 읽어 등록합니다."
            accept=".xlsx,.xlsm,.xls"
            apiPath="/api/admin/import/objection-review"
            secondApiPath="/api/admin/import/wage-review"
            secondLabel="평임검토"
            notice="최초총현황과 평임검토 데이터를 동시에 처리합니다."
          />
          <ImportCard
            title="이의제기 기일 임포트"
            description="승불자 관리파일의 '이의제기' 시트를 읽어 기일 관리 DB에 등록합니다."
            accept=".xlsx,.xlsm,.xls"
            apiPath="/api/admin/import/objection-case"
          />
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>TF 데이터 임포트</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>상병별 TF를 선택하여 재해자·사건 데이터를 일괄 임포트합니다. 상단의 TF 임포트 섹션을 이용하세요.</div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
            >
              ↑ 페이지 상단 TF 임포트로 이동
            </button>
          </div>
        </div>
      </div>

      {/* ─── 평균임금 데이터 선택 삭제 ─── */}
      <div style={{ marginTop: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 2, marginBottom: 4 }}>ADMIN</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: "0 0 16px 0" }}>평균임금 데이터 선택 삭제</h2>
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #fecaca", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button
              onClick={loadWageData}
              disabled={wageDataLoading}
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151", opacity: wageDataLoading ? 0.6 : 1 }}
            >
              {wageDataLoading ? "로딩중..." : "목록 불러오기"}
            </button>
            {wageDataLoaded && <span style={{ fontSize: 12, color: "#6b7280" }}>총 {wageDataList.length}건</span>}
            {selectedWageIds.size > 0 && (
              <button
                onClick={() => setWageDeleteConfirm(true)}
                style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                선택 삭제 ({selectedWageIds.size})
              </button>
            )}
          </div>
          {wageDataLoaded && (
            <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "8px 10px", width: 36 }}>
                      <input
                        type="checkbox"
                        checked={wageDataList.length > 0 && selectedWageIds.size === wageDataList.length}
                        onChange={() => {
                          if (selectedWageIds.size === wageDataList.length) setSelectedWageIds(new Set());
                          else setSelectedWageIds(new Set(wageDataList.map((i) => i.id)));
                        }}
                      />
                    </th>
                    {["재해자명", "TF", "사건종류", "결정일자"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wageDataList.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>데이터 없음</td></tr>
                  )}
                  {wageDataList.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", background: selectedWageIds.has(item.id) ? "#fef2f2" : "white" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <input
                          type="checkbox"
                          checked={selectedWageIds.has(item.id)}
                          onChange={() => setSelectedWageIds((prev) => {
                            const next = new Set(prev);
                            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                            return next;
                          })}
                        />
                      </td>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#111827" }}>{item.patientName}</td>
                      <td style={{ padding: "8px 12px", color: "#374151" }}>{item.tfName}</td>
                      <td style={{ padding: "8px 12px", color: "#374151" }}>{item.caseType}</td>
                      <td style={{ padding: "8px 12px", color: "#6b7280" }}>{item.decisionDate ? item.decisionDate.slice(0, 10) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {wageDeleteConfirm && (
        <ConfirmModal
          message={`선택한 ${selectedWageIds.size}건의 평균임금 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleWageDelete}
          onCancel={() => setWageDeleteConfirm(false)}
          confirming={wageDeleteConfirming}
        />
      )}

      {/* ─── 전체 싱크 ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: "0 0 16px 0" }}>전체 싱크 (기일관리 → 처분검토 → 사건목록)</h2>
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, marginBottom: 16 }}>
            <strong>신뢰도 순서: 기일관리 &gt; 처분검토 &gt; 사건목록</strong>
            <br />① 미링크 ObjectionReview/ObjectionCase 레코드를 Case에 자동 연결
            <br />② 기일관리(ObjectionCase) → 처분검토(ObjectionReview) → 사건목록(Case.status) 순으로 일괄 싱크
          </div>
          <button
            onClick={runSyncAll}
            disabled={syncLoading}
            style={{ background: syncLoading ? "#9ca3af" : "#0d9488", color: "white", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: syncLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            {syncLoading && <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {syncLoading ? "싱크 실행 중..." : "🔄 전체 싱크 실행"}
          </button>
          {syncError && <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", marginTop: 12 }}>⚠ {syncError}</div>}
          {syncResult && (
            <div style={{ fontSize: 13, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "12px 16px", marginTop: 12, lineHeight: 2 }}>
              ✅ <strong>싱크 완료</strong>
              <br />• 미링크 처분검토 자동 연결: <strong>{syncResult.reviewAutoLinked}건</strong>
              <br />• 미링크 기일관리 자동 연결: <strong>{syncResult.caseAutoLinked}건</strong>
              <br />• 사건 상태 업데이트: <strong>{syncResult.caseStatusUpdated}건</strong>
              <br />• 처분결과 업데이트: <strong>{syncResult.hlDecisionUpdated}건</strong>
              {syncResult.errors.length > 0 && (
                <div style={{ color: "#dc2626", marginTop: 8 }}>
                  오류 {syncResult.errors.length}건:<br />
                  {syncResult.errors.slice(0, 5).map((e, i) => <span key={i}>• {e}<br /></span>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type ImportCardResult = { success?: number; skipped?: number; errors?: string[] };

function ImportCard({
  title,
  description,
  accept,
  apiPath,
  secondApiPath,
  secondLabel,
  notice,
  disabled,
}: {
  title: string;
  description: string;
  accept: string;
  apiPath: string;
  secondApiPath?: string;
  secondLabel?: string;
  notice?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardDragging, setCardDragging] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardResult, setCardResult] = useState<ImportCardResult | null>(null);
  const [cardResult2, setCardResult2] = useState<ImportCardResult | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  const run = async () => {
    if (!cardFile || !apiPath) return;
    setCardLoading(true);
    setCardResult(null);
    setCardResult2(null);
    setCardError(null);
    try {
      const fd1 = new FormData();
      fd1.append("file", cardFile);
      const r1 = await fetch(apiPath, { method: "POST", body: fd1 });
      const d1 = await r1.json();
      if (!r1.ok) { setCardError(d1.error ?? "오류 발생"); return; }
      setCardResult(d1);

      if (secondApiPath) {
        const fd2 = new FormData();
        fd2.append("file", cardFile);
        const r2 = await fetch(secondApiPath, { method: "POST", body: fd2 });
        const d2 = await r2.json();
        if (!r2.ok) { setCardError(d2.error ?? "두 번째 시트 오류"); return; }
        setCardResult2(d2);
      }
    } catch {
      setCardError("네트워크 오류가 발생했습니다");
    } finally {
      setCardLoading(false);
    }
  };

  const cardBg = disabled ? "#f9fafb" : "white";
  const cardBorder = disabled ? "1px solid #e5e7eb" : "1px solid #e5e7eb";

  return (
    <div style={{ background: cardBg, border: cardBorder, borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 10, opacity: disabled ? 0.7 : 1 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: disabled ? "#9ca3af" : "#111827" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{description}</div>
      {!disabled && (
        <>
          <div>
            <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCardFile(f); setCardResult(null); setCardResult2(null); setCardError(null); } }} />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setCardDragging(true); }}
              onDragLeave={() => setCardDragging(false)}
              onDrop={(e) => { e.preventDefault(); setCardDragging(false); const f = e.dataTransfer.files[0]; if (f) { setCardFile(f); setCardResult(null); setCardResult2(null); setCardError(null); } }}
              style={{ border: `2px dashed ${cardDragging ? "#29ABE2" : "#d1d5db"}`, borderRadius: 8, padding: "20px 12px", textAlign: "center", cursor: "pointer", background: cardDragging ? "#eff6ff" : "#f9fafb", transition: "all 0.15s" }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>📁</div>
              {cardFile ? (
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{cardFile.name}</div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: "#374151", marginBottom: 2 }}>파일을 드래그하거나 클릭하여 선택</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{accept}</div>
                </div>
              )}
            </div>
          </div>
          {notice && <div style={{ fontSize: 11, color: "#6b7280", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px" }}>{notice}</div>}
          <button onClick={run} disabled={!cardFile || cardLoading} style={{ background: !cardFile || cardLoading ? "#9ca3af" : "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: !cardFile || cardLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {cardLoading && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {cardLoading ? "처리중..." : "임포트 시작"}
          </button>
          {cardError && <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 10px" }}>⚠ {cardError}</div>}
          {cardResult && (
            <div style={{ fontSize: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 12px", lineHeight: 1.8 }}>
              ✅ {secondApiPath ? "최초총현황 " : ""}성공: {cardResult.success ?? 0}건 / 건너뜀: {cardResult.skipped ?? 0}건 / 오류: {cardResult.errors?.length ?? 0}건
              {cardResult.errors && cardResult.errors.length > 0 && <div style={{ color: "#dc2626", marginTop: 4 }}>{cardResult.errors.slice(0, 5).map((e, i) => <div key={i}>• {e}</div>)}</div>}
            </div>
          )}
          {cardResult2 && (
            <div style={{ fontSize: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 12px", lineHeight: 1.8 }}>
              ✅ {secondLabel ?? "두 번째"} 성공: {cardResult2.success ?? 0}건 / 건너뜀: {cardResult2.skipped ?? 0}건 / 오류: {cardResult2.errors?.length ?? 0}건
              {cardResult2.errors && cardResult2.errors.length > 0 && <div style={{ color: "#dc2626", marginTop: 4 }}>{cardResult2.errors.slice(0, 5).map((e, i) => <div key={i}>• {e}</div>)}</div>}
            </div>
          )}
        </>
      )}
      {disabled && <div style={{ fontSize: 12, color: "#9ca3af" }}>준비 중입니다.</div>}
    </div>
  );
}
