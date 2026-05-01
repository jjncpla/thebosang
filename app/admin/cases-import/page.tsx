"use client";

import { useRef, useState } from "react";

type ParsedItem = {
  fileName: string;
  ok: boolean;
  error: string | null;
  patientName: string | null;
  patientRrn: string | null;
  patientPhone: string | null;
  patientAddress: string | null;
  caseType: string | null;
  caseTypeCode: string | null;
  tfName: string | null;
  branchName: string | null;
  receptionDate: string | null;
  introducer: string | null;
  salesStaff: string | null;
  caseChannel: string | null;
  preliminaryConsult: string | null;
  agentName: string | null;
  agentBranch: string | null;
  agentBirthDate: string | null;
  agentGender: string | null;
  agentAddress: string | null;
  agentLicenseNo: string | null;
  agentMobile: string | null;
  agentTel: string | null;
  agentFax: string | null;
  specialClinic: string | null;
  expertClinic: string | null;
  rawLabels: Record<string, string>;
};

type ParseResponse = {
  ok: boolean;
  total: number;
  parsedOk: number;
  parsedFail: number;
  parsed: ParsedItem[];
};

type CommitResponse = {
  ok: boolean;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: { fileName: string; patientName: string | null; reason: string }[];
};

const CASE_TYPE_LABEL: Record<string, string> = {
  HEARING_LOSS: "난청",
  COPD: "COPD",
  PNEUMOCONIOSIS: "진폐",
  OCCUPATIONAL_CANCER: "직업성암",
  MUSCULOSKELETAL: "근골격계",
  OCCUPATIONAL_ACCIDENT: "사고",
  BEREAVED: "유족",
  OTHER: "기타",
};

function rrnMask(s: string | null): string {
  if (!s) return "-";
  return s.replace(/(\d{6})-?(\d{7})/, "$1-*******");
}

export default function CasesImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "addCase">("skip");
  const [duplicateRrns, setDuplicateRrns] = useState<Set<string>>(new Set());

  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [debugIdx, setDebugIdx] = useState<number | null>(null);

  const reset = () => {
    setFiles([]);
    setParseResult(null);
    setParseError(null);
    setSelected(new Set());
    setDuplicateRrns(new Set());
    setCommitResult(null);
    setCommitError(null);
    setDebugIdx(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileInput = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter((f) =>
      /\.(xlsx?|xlsm)$/i.test(f.name)
    );
    setFiles(arr);
    setParseResult(null);
    setSelected(new Set());
    setCommitResult(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileInput(e.dataTransfer.files);
    }
  };

  const checkDuplicates = async (parsed: ParsedItem[]) => {
    const rrns = parsed
      .filter((p) => p.ok && p.patientRrn)
      .map((p) => p.patientRrn!);
    if (rrns.length === 0) {
      setDuplicateRrns(new Set());
      return;
    }
    try {
      const res = await fetch("/api/admin/import/cases/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rrns }),
      });
      if (res.ok) {
        const data = await res.json();
        setDuplicateRrns(new Set(data.duplicates || []));
      }
    } catch {
      // silent — 중복 체크 실패해도 import는 가능
    }
  };

  const handleParse = async () => {
    if (files.length === 0) return;
    setParsing(true);
    setParseError(null);
    setParseResult(null);
    setCommitResult(null);

    const fd = new FormData();
    for (const f of files) fd.append("files", f);

    try {
      const res = await fetch("/api/admin/import/cases/parse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || "파싱 실패");
        return;
      }
      setParseResult(data as ParseResponse);
      // 기본 선택: 파싱 성공 항목 모두
      const defaultSelected = new Set<number>();
      (data.parsed as ParsedItem[]).forEach((p, i) => {
        if (p.ok) defaultSelected.add(i);
      });
      setSelected(defaultSelected);
      // 중복 체크
      await checkDuplicates(data.parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async (selectedOnly: boolean) => {
    if (!parseResult) return;
    const items = selectedOnly
      ? parseResult.parsed.filter((_, i) => selected.has(i))
      : parseResult.parsed.filter((p) => p.ok);

    if (items.length === 0) {
      setCommitError("import할 항목을 선택하세요");
      return;
    }

    setCommitting(true);
    setCommitError(null);
    setCommitResult(null);

    try {
      const res = await fetch("/api/admin/import/cases/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, duplicateMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommitError(data.error || "import 실패");
        return;
      }
      setCommitResult(data as CommitResponse);
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setCommitting(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!parseResult) return;
    const okIdx = parseResult.parsed
      .map((p, i) => (p.ok ? i : -1))
      .filter((i) => i >= 0);
    if (selected.size === okIdx.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(okIdx));
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
        사건 일괄 import
      </h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
        자료입력서식 (.xls / .xlsx) 파일을 업로드하면 시트 &quot;1. 입력 / 3. 대리인 / 4. 특별&amp;전문&quot;
        에서 근로자·사건·대리인 정보를 추출해 일괄 등록합니다. 폴더당 1개 파일이 1개 사건으로
        등록됩니다.
      </p>

      {/* ── 1단계: 파일 업로드 ── */}
      <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", marginBottom: 12 }}>
          ① 파일 업로드
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? "#29ABE2" : "#cbd5e1"}`,
            borderRadius: 8,
            padding: "32px 20px",
            textAlign: "center",
            background: dragging ? "#eff6ff" : "#f8fafc",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8, color: "#9ca3af" }}>📂</div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
            {files.length === 0
              ? "파일을 드래그하거나 클릭해서 업로드"
              : `${files.length}개 파일 선택됨`}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            .xls / .xlsx 다중 선택 가능 (최대 200개)
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xls,.xlsx,.xlsm"
            style={{ display: "none" }}
            onChange={(e) => e.target.files && handleFileInput(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280", maxHeight: 120, overflowY: "auto" }}>
            {files.slice(0, 30).map((f, i) => (
              <div key={i} style={{ padding: "2px 0" }}>
                · {f.name}{" "}
                <span style={{ color: "#9ca3af" }}>({Math.ceil(f.size / 1024)}KB)</span>
              </div>
            ))}
            {files.length > 30 && (
              <div style={{ padding: "2px 0", color: "#9ca3af" }}>
                ... 외 {files.length - 30}개
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            onClick={handleParse}
            disabled={files.length === 0 || parsing}
            style={{
              background: "#29ABE2",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: files.length === 0 || parsing ? "not-allowed" : "pointer",
              opacity: files.length === 0 || parsing ? 0.5 : 1,
            }}
          >
            {parsing ? "파싱 중..." : "파싱 미리보기"}
          </button>
          <button
            onClick={reset}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "8px 18px",
              fontSize: 13,
              color: "#374151",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            초기화
          </button>
        </div>

        {parseError && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b" }}>
            {parseError}
          </div>
        )}
      </section>

      {/* ── 2단계: 미리보기 + 선택 ── */}
      {parseResult && parseResult.parsed.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937" }}>
              ② 파싱 결과 미리보기
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              총 {parseResult.total}개 · 성공 {parseResult.parsedOk} · 실패 {parseResult.parsedFail}
              {duplicateRrns.size > 0 && (
                <span style={{ marginLeft: 8, color: "#f59e0b" }}>
                  · 중복 {duplicateRrns.size}건
                </span>
              )}
            </div>
          </div>

          {/* 중복 처리 옵션 */}
          {duplicateRrns.size > 0 && (
            <div style={{ marginBottom: 12, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                ⚠ 주민번호 중복 {duplicateRrns.size}건 감지
              </div>
              <label style={{ display: "block", marginTop: 6, color: "#78350f" }}>
                <input
                  type="radio"
                  checked={duplicateMode === "skip"}
                  onChange={() => setDuplicateMode("skip")}
                />{" "}
                중복 시 skip (기본)
              </label>
              <label style={{ display: "block", marginTop: 4, color: "#78350f" }}>
                <input
                  type="radio"
                  checked={duplicateMode === "addCase"}
                  onChange={() => setDuplicateMode("addCase")}
                />{" "}
                기존 재해자에 새 사건 추가
              </label>
            </div>
          )}

          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 6px", textAlign: "center", width: 32 }}>
                    <input
                      type="checkbox"
                      checked={
                        selected.size > 0 &&
                        selected.size ===
                          parseResult.parsed.filter((p) => p.ok).length
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th style={{ padding: "8px 6px", textAlign: "left", color: "#374151", fontWeight: 600 }}>파일명</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", color: "#374151", fontWeight: 600 }}>근로자</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", color: "#374151", fontWeight: 600 }}>주민번호</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", color: "#374151", fontWeight: 600 }}>사건종류</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", color: "#374151", fontWeight: 600 }}>TF</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", color: "#374151", fontWeight: 600 }}>대리인</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", color: "#374151", fontWeight: 600 }}>접수일</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "#374151", fontWeight: 600 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.parsed.map((p, i) => {
                  const isDup = !!(p.patientRrn && duplicateRrns.has(p.patientRrn));
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background: !p.ok ? "#fef2f2" : isDup ? "#fffbeb" : "transparent",
                      }}
                    >
                      <td style={{ padding: "6px", textAlign: "center" }}>
                        {p.ok && (
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={() => toggleSelect(i)}
                          />
                        )}
                      </td>
                      <td style={{ padding: "6px", color: "#374151", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.fileName}>
                        {p.fileName}
                      </td>
                      <td style={{ padding: "6px", color: "#111827", fontWeight: 600 }}>
                        {p.patientName || <span style={{ color: "#9ca3af" }}>-</span>}
                      </td>
                      <td style={{ padding: "6px", color: "#6b7280", fontFamily: "monospace" }}>
                        {rrnMask(p.patientRrn)}
                      </td>
                      <td style={{ padding: "6px", color: "#374151" }}>
                        {p.caseType ? (
                          <>
                            {p.caseType}
                            {p.caseTypeCode && (
                              <span style={{ marginLeft: 4, fontSize: 10, color: "#9ca3af" }}>
                                ({CASE_TYPE_LABEL[p.caseTypeCode] || p.caseTypeCode})
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: "6px", color: "#374151" }}>
                        {p.tfName || <span style={{ color: "#9ca3af" }}>-</span>}
                      </td>
                      <td style={{ padding: "6px", color: "#374151" }}>
                        {p.agentName ? (
                          <>
                            {p.agentName}
                            {p.agentBranch && (
                              <span style={{ marginLeft: 3, fontSize: 10, color: "#9ca3af" }}>
                                ({p.agentBranch})
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: "6px", color: "#374151", fontFamily: "monospace", fontSize: 11 }}>
                        {p.receptionDate || <span style={{ color: "#9ca3af" }}>-</span>}
                      </td>
                      <td style={{ padding: "6px", textAlign: "center" }}>
                        {!p.ok ? (
                          <span
                            title={p.error ?? ""}
                            style={{ background: "#fee2e2", color: "#991b1b", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}
                          >
                            실패
                          </span>
                        ) : isDup ? (
                          <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>
                            중복
                          </span>
                        ) : (
                          <span style={{ background: "#dcfce7", color: "#166534", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>
                            OK
                          </span>
                        )}
                        <button
                          onClick={() => setDebugIdx(debugIdx === i ? null : i)}
                          style={{
                            marginLeft: 4,
                            border: "none",
                            background: "transparent",
                            color: "#6b7280",
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          {debugIdx === i ? "▲" : "▼"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 디버그 panel */}
          {debugIdx !== null && parseResult.parsed[debugIdx] && (
            <div style={{ marginBottom: 12, padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                #{debugIdx + 1} {parseResult.parsed[debugIdx].fileName} 추출 상세
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, color: "#374151" }}>
                <div><b>주소:</b> {parseResult.parsed[debugIdx].patientAddress || "-"}</div>
                <div><b>연락처:</b> {parseResult.parsed[debugIdx].patientPhone || "-"}</div>
                <div><b>지사:</b> {parseResult.parsed[debugIdx].branchName || "-"}</div>
                <div><b>소개자:</b> {parseResult.parsed[debugIdx].introducer || "-"}</div>
                <div><b>영업담당:</b> {parseResult.parsed[debugIdx].salesStaff || "-"}</div>
                <div><b>경로:</b> {parseResult.parsed[debugIdx].caseChannel || "-"}</div>
                <div><b>예비문진:</b> {parseResult.parsed[debugIdx].preliminaryConsult || "-"}</div>
                <div><b>특별진찰:</b> {parseResult.parsed[debugIdx].specialClinic || "-"}</div>
                <div><b>전문조사:</b> {parseResult.parsed[debugIdx].expertClinic || "-"}</div>
                <div><b>대리인전화:</b> {parseResult.parsed[debugIdx].agentTel || "-"}</div>
                <div><b>대리인FAX:</b> {parseResult.parsed[debugIdx].agentFax || "-"}</div>
                <div><b>직무개시:</b> {parseResult.parsed[debugIdx].agentLicenseNo || "-"}</div>
              </div>
              {Object.keys(parseResult.parsed[debugIdx].rawLabels || {}).length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", color: "#6b7280" }}>
                    원본 라벨 dump ({Object.keys(parseResult.parsed[debugIdx].rawLabels).length}개)
                  </summary>
                  <div style={{ marginTop: 6, fontSize: 10, color: "#6b7280", maxHeight: 200, overflowY: "auto" }}>
                    {Object.entries(parseResult.parsed[debugIdx].rawLabels).map(([k, v]) => (
                      <div key={k} style={{ padding: "1px 0" }}>
                        [{k}] = {String(v)}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {parseResult.parsed[debugIdx].error && (
                <div style={{ marginTop: 6, color: "#991b1b" }}>
                  <b>오류:</b> {parseResult.parsed[debugIdx].error}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleCommit(true)}
              disabled={committing || selected.size === 0}
              style={{
                background: "#8DC63F",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: committing || selected.size === 0 ? "not-allowed" : "pointer",
                opacity: committing || selected.size === 0 ? 0.5 : 1,
              }}
            >
              {committing ? "import 중..." : `선택 import (${selected.size}건)`}
            </button>
            <button
              onClick={() => handleCommit(false)}
              disabled={committing}
              style={{
                background: "#29ABE2",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: committing ? "not-allowed" : "pointer",
                opacity: committing ? 0.5 : 1,
              }}
            >
              전체 import ({parseResult.parsedOk}건)
            </button>
          </div>

          {commitError && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#991b1b" }}>
              {commitError}
            </div>
          )}
        </section>
      )}

      {/* ── 3단계: import 결과 ── */}
      {commitResult && (
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937", marginBottom: 12 }}>
            ③ import 결과
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <Stat label="요청" value={commitResult.total} color="#374151" />
            <Stat label="성공 (생성)" value={commitResult.created} color="#166534" />
            <Stat label="중복 skip" value={commitResult.skipped} color="#92400e" />
            <Stat label="실패" value={commitResult.failed} color="#991b1b" />
          </div>

          {commitResult.errors.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#991b1b", fontWeight: 700 }}>
                실패 상세 ({commitResult.errors.length}건)
              </summary>
              <div style={{ marginTop: 8, fontSize: 11, color: "#374151", maxHeight: 240, overflowY: "auto" }}>
                {commitResult.errors.map((e, i) => (
                  <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
                    · <b>{e.fileName}</b> ({e.patientName || "-"}): {e.reason}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              onClick={reset}
              style={{
                background: "#29ABE2",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              새 import 시작
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, padding: "12px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value.toLocaleString()}</div>
    </div>
  );
}
