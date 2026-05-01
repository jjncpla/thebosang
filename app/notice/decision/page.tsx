"use client";

import { useEffect, useRef, useState } from "react";
import type { ParsedResolutionNotice, MatchCandidate } from "@/lib/decision-notice-parser";

type ListItem = {
  id: string;
  caseId: string | null;
  patientId: string | null;
  originalFileName: string;
  pageCount: number | null;
  resolutionDate: string | null;
  noticeNumber: string | null;
  kwcOfficeName: string | null;
  decisionType: string | null;
  recipientName: string | null;
  medicalInstitution: string | null;
  injuryName: string | null;
  icdCode: string | null;
  treatmentPeriodStart: string | null;
  treatmentPeriodEnd: string | null;
  diseaseCategory: string | null;
  autoIngestConfidence: string;
  requiresUserReview: boolean;
  appliedToCase: boolean;
  appliedAt: string | null;
  createdAt: string;
};

type AutoIngestResult = {
  canAutoIngest: boolean;
  requiresUserReview: boolean;
  blockedReason: string | null;
};

type ParseResponse = {
  success: boolean;
  fileName: string;
  fileSize: number;
  ocrTextLength: number;
  pageCount: number;
  noticeId: string | null;
  parsed: ParsedResolutionNotice;
  autoIngest: AutoIngestResult;
};

const DISEASE_KOR: Record<string, string> = {
  HEARING_LOSS: "소음성 난청",
  PNEUMOCONIOSIS: "진폐",
  COPD: "COPD",
  LUNG_CANCER: "폐암",
  MUSCULOSKELETAL: "근골격계",
  GENERAL: "일반산재",
  UNKNOWN: "미분류",
};

const CASE_TYPE_KOR: Record<string, string> = {
  HEARING_LOSS: "소음성 난청",
  COPD: "COPD",
  PNEUMOCONIOSIS: "진폐",
  MUSCULOSKELETAL: "근골격계",
  OCCUPATIONAL_ACCIDENT: "업무상사고",
  OCCUPATIONAL_CANCER: "직업성암",
  BEREAVED: "유족급여",
  OTHER: "기타",
};

export default function DecisionNoticePage() {
  const [parsed, setParsed] = useState<ParsedResolutionNotice | null>(null);
  const [autoIngest, setAutoIngest] = useState<AutoIngestResult | null>(null);
  const [latestNoticeId, setLatestNoticeId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recent, setRecent] = useState<ListItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterReview, setFilterReview] = useState<"all" | "pending" | "applied">("all");

  // 매칭 모달
  const [matchModalNoticeId, setMatchModalNoticeId] = useState<string | null>(null);
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  async function fetchRecent() {
    setLoadingHistory(true);
    try {
      let url = "/api/resolution-notice/list?limit=100";
      if (filterReview === "pending") url += "&applied=false&requiresUserReview=true";
      if (filterReview === "applied") url += "&applied=true";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecent(data.items ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    fetchRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterReview]);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadedFileName(file.name);
    setOcrRawText(null);
    setParsed(null);
    setAutoIngest(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("includeRaw", "true");
      const res = await fetch("/api/resolution-notice/parse", { method: "POST", body: fd });
      const data: ParseResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "파싱 실패");
      if (data.parsed?.rawText) setOcrRawText(data.parsed.rawText);
      setParsed(data.parsed);
      setAutoIngest(data.autoIngest);
      setLatestNoticeId(data.noticeId);
      fetchRecent();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function resetUpload() {
    setParsed(null);
    setAutoIngest(null);
    setLatestNoticeId(null);
    setUploadError(null);
    setUploadedFileName(null);
    setOcrRawText(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteItem(id: string) {
    if (!confirm("이 결정통지서 이력을 삭제하시겠습니까? (ADMIN 권한 필요)")) return;
    try {
      const res = await fetch(`/api/resolution-notice/list?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`삭제 실패: ${data.error ?? res.statusText}`);
        return;
      }
      fetchRecent();
    } catch {
      alert("삭제 실패");
    }
  }

  async function openMatchModal(noticeId: string) {
    setMatchModalNoticeId(noticeId);
    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/resolution-notice/${noticeId}/match-case`);
      const data = await res.json();
      if (res.ok) setMatchCandidates(data.candidates ?? []);
      else setMatchCandidates([]);
    } catch {
      setMatchCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function selectMatch(noticeId: string, caseId: string) {
    try {
      const res = await fetch(`/api/resolution-notice/${noticeId}/match-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`매칭 실패: ${data.error ?? res.statusText}`);
        return;
      }
      alert("✅ 사건 매칭 완료. '사건에 적용' 버튼을 눌러 결정 정보를 인입하세요.");
      setMatchModalNoticeId(null);
      fetchRecent();
    } catch (e) {
      alert(`매칭 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function applyToCase(noticeId: string) {
    if (!confirm("이 결정통지서를 사건에 적용하시겠습니까?\n- 사건 상태가 변경됩니다\n- 불승인/일부승인 시 이의제기 검토가 자동 생성됩니다")) return;
    try {
      const res = await fetch(`/api/resolution-notice/${noticeId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`적용 실패: ${data.error ?? res.statusText}`);
        return;
      }
      alert(`✅ ${data.message}`);
      fetchRecent();
    } catch (e) {
      alert(`적용 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function downloadOcr() {
    if (!ocrRawText) return;
    const blob = new Blob([ocrRawText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${uploadedFileName ?? "ocr"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 스타일
  const containerStyle: React.CSSProperties = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: 24,
    fontFamily: "system-ui, -apple-system, sans-serif",
  };
  const sectionStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 12,
    color: "#111827",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, color: "#6b7280", fontWeight: 500 };
  const valueStyle: React.CSSProperties = { fontSize: 14, color: "#111827", fontWeight: 600 };
  const fieldRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
  };
  const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    background: "#29ABE2",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  };
  const dangerButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#ef4444" };
  const successButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#8DC63F" };
  const subtleButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
  };

  function fmtDate(s: string | null | undefined): string {
    if (!s) return "-";
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return s;
    }
  }

  function ConfidenceBadge({ conf }: { conf: string }) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      HIGH: { bg: "#dcfce7", color: "#166534", label: "HIGH 자동 인입 가능" },
      MEDIUM: { bg: "#fef9c3", color: "#854d0e", label: "MEDIUM 검토 필요" },
      LOW: { bg: "#fee2e2", color: "#991b1b", label: "LOW 수기 입력 권장" },
    };
    const v = map[conf] ?? { bg: "#f3f4f6", color: "#374151", label: conf };
    return (
      <span style={{ background: v.bg, color: v.color, padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
        {v.label}
      </span>
    );
  }

  function DecisionBadge({ type }: { type: string | null }) {
    if (!type) return <span style={{ color: "#9ca3af" }}>-</span>;
    const map: Record<string, { bg: string; color: string }> = {
      "승인": { bg: "#dcfce7", color: "#166534" },
      "불승인": { bg: "#fee2e2", color: "#991b1b" },
      "일부승인": { bg: "#fef9c3", color: "#854d0e" },
    };
    const v = map[type] ?? { bg: "#f3f4f6", color: "#374151" };
    return (
      <span style={{ background: v.bg, color: v.color, padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
        {type}
      </span>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>📑 결정통지서 자동 인입</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        근로복지공단이 발신한 결정통지서(별지 제6호) PDF를 업로드하면 OCR로 자동 추출 후
        승인/불승인/일부승인 결과를 사건에 자동 인입합니다.
        불승인·일부승인 시 이의제기 검토(90일 카운트다운)가 자동 생성됩니다.
      </p>

      {/* ─── PDF 업로드 ─── */}
      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>📎 PDF 업로드</h2>

        {!parsed && !uploading && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
              style={{ display: "block", marginBottom: 12 }}
            />
            <p style={{ fontSize: 12, color: "#6b7280" }}>
              ※ 스캔본·이미지 PDF 모두 가능 / 파일 크기 15MB 이하 / Document AI OCR 사용
            </p>
            {uploadError && (
              <div style={{ marginTop: 12, padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6 }}>
                ❌ {uploadError}
              </div>
            )}
          </div>
        )}

        {uploading && (
          <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
            ⏳ OCR 처리 중... ({uploadedFileName})
          </div>
        )}

        {parsed && !uploading && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 14 }}>
                📄 <strong>{uploadedFileName}</strong>
                {parsed.warnings.length > 0 && (
                  <span style={{ marginLeft: 12, color: "#f59e0b", fontSize: 12 }}>
                    ⚠️ {parsed.warnings.length}건 경고
                  </span>
                )}
              </span>
              <button onClick={resetUpload} style={subtleButtonStyle}>
                새 파일 업로드
              </button>
            </div>

            {/* 양식 식별 실패 */}
            {!parsed.isResolutionNotice && (
              <div
                style={{
                  padding: 16,
                  background: "#fef2f2",
                  border: "2px solid #ef4444",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b" }}>
                  🚫 결정통지서 양식 식별 실패
                </div>
                <div style={{ fontSize: 13, color: "#7f1d1d", marginTop: 4 }}>
                  업로드된 PDF에서 결정통지서 키워드를 찾을 수 없습니다. 다른 양식인지 확인하세요.
                </div>
              </div>
            )}

            {/* 자동 인입 판정 */}
            {parsed.isResolutionNotice && autoIngest && (
              <div
                style={{
                  padding: 16,
                  background:
                    parsed.confidence === "HIGH" ? "#f0fdf4" :
                    parsed.confidence === "MEDIUM" ? "#fffbeb" : "#fef2f2",
                  border:
                    parsed.confidence === "HIGH" ? "2px solid #8DC63F" :
                    parsed.confidence === "MEDIUM" ? "2px solid #f59e0b" : "2px solid #ef4444",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                      <ConfidenceBadge conf={parsed.confidence} />
                      <span style={{ marginLeft: 12 }}>
                        결정구분: <DecisionBadge type={
                          parsed.resultStatus === "APPROVED" ? "승인" :
                          parsed.resultStatus === "REJECTED" ? "불승인" :
                          parsed.resultStatus === "PARTIAL" ? "일부승인" : null
                        } />
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151" }}>
                      {autoIngest.canAutoIngest
                        ? `사건에 자동 적용 가능 — ${autoIngest.requiresUserReview ? "사용자 검토 후" : "곧바로"} 인입`
                        : autoIngest.blockedReason ?? "자동 인입 차단"}
                    </div>
                  </div>
                  {latestNoticeId && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => openMatchModal(latestNoticeId)}
                        style={buttonStyle}
                      >
                        🔗 사건 매칭
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 추출 필드 표시 */}
            {parsed.isResolutionNotice && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                    처분 정보
                  </h3>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>결정일</span>
                    <span style={valueStyle}>{fmtDate(parsed.decisionDate)}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>관리번호</span>
                    <span style={valueStyle}>{parsed.mgmtNo ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>공단지사</span>
                    <span style={valueStyle}>{parsed.comwelBranch ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>우편번호</span>
                    <span style={valueStyle}>{parsed.zipcode ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>재해자명</span>
                    <span style={valueStyle}>{parsed.workerName ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>상병계열</span>
                    <span style={valueStyle}>{DISEASE_KOR[parsed.diseaseCategory] ?? parsed.diseaseCategory}</span>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                    의료/상병
                  </h3>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>의료기관명</span>
                    <span style={valueStyle}>{parsed.medicalInstName ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>의료기관번호</span>
                    <span style={valueStyle}>{parsed.medicalInstNo ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>상병명</span>
                    <span style={valueStyle}>{parsed.diagnosisName ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>ICD 코드</span>
                    <span style={valueStyle}>{parsed.icdCode ?? "-"}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>요양시작일</span>
                    <span style={valueStyle}>{fmtDate(parsed.treatmentStartDate)}</span>
                  </div>
                  <div style={fieldRowStyle}>
                    <span style={labelStyle}>요양종료일</span>
                    <span style={valueStyle}>{fmtDate(parsed.treatmentEndDate)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 불승인 사유 */}
            {parsed.rejectionReason && (
              <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#991b1b" }}>
                  불승인·반려·삭감 사유
                </div>
                <div style={{ fontSize: 13, color: "#7f1d1d", whiteSpace: "pre-wrap" }}>
                  {parsed.rejectionReason}
                </div>
              </div>
            )}

            {/* 결정내용 상세 */}
            {parsed.decisionDetail && (
              <div style={{ marginTop: 16, padding: 12, background: "#f9fafb", borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                  결정내용 상세 (입원/통원)
                </div>
                <div style={{ fontSize: 12, color: "#374151", whiteSpace: "pre-wrap" }}>
                  {parsed.decisionDetail}
                </div>
              </div>
            )}

            {/* 경고 */}
            {parsed.warnings.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: "#fffbeb", borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#92400e" }}>
                  ⚠️ 추출 경고
                </div>
                <ul style={{ fontSize: 12, color: "#78350f", margin: 0, paddingLeft: 20 }}>
                  {parsed.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* OCR 원문 */}
            {ocrRawText && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setShowRaw(!showRaw)} style={subtleButtonStyle}>
                    {showRaw ? "OCR 원문 숨기기" : "OCR 원문 보기"}
                  </button>
                  <button onClick={downloadOcr} style={subtleButtonStyle}>
                    .txt 다운로드
                  </button>
                </div>
                {showRaw && (
                  <pre
                    style={{
                      fontSize: 11,
                      background: "#1f2937",
                      color: "#e5e7eb",
                      padding: 12,
                      borderRadius: 6,
                      maxHeight: 400,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {ocrRawText}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 검토 이력 ─── */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={sectionTitleStyle}>📜 결정통지서 이력</h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setFilterReview("all")}
              style={{
                ...subtleButtonStyle,
                background: filterReview === "all" ? "#29ABE2" : "#f3f4f6",
                color: filterReview === "all" ? "#fff" : "#374151",
              }}
            >
              전체
            </button>
            <button
              onClick={() => setFilterReview("pending")}
              style={{
                ...subtleButtonStyle,
                background: filterReview === "pending" ? "#f59e0b" : "#f3f4f6",
                color: filterReview === "pending" ? "#fff" : "#374151",
              }}
            >
              ⏳ 검토 필요
            </button>
            <button
              onClick={() => setFilterReview("applied")}
              style={{
                ...subtleButtonStyle,
                background: filterReview === "applied" ? "#8DC63F" : "#f3f4f6",
                color: filterReview === "applied" ? "#fff" : "#374151",
              }}
            >
              ✅ 적용 완료
            </button>
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>로딩 중...</div>
        ) : recent.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
            결정통지서 이력이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>업로드</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>처분일</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>재해자</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>상병명</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>공단지사</th>
                  <th style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>결정</th>
                  <th style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>신뢰도</th>
                  <th style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>매칭</th>
                  <th style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 8 }}>
                      {new Date(it.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td style={{ padding: 8 }}>{fmtDate(it.resolutionDate)}</td>
                    <td style={{ padding: 8 }}>{it.recipientName ?? "-"}</td>
                    <td
                      style={{
                        padding: 8,
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={it.injuryName ?? ""}
                    >
                      {it.injuryName ?? "-"}
                    </td>
                    <td style={{ padding: 8 }}>{it.kwcOfficeName ?? "-"}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <DecisionBadge type={it.decisionType} />
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <ConfidenceBadge conf={it.autoIngestConfidence} />
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      {it.caseId ? (
                        <span
                          style={{
                            background: "#dbeafe",
                            color: "#1e40af",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                          title={`Case id=${it.caseId}`}
                        >
                          ✅ 매칭됨
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>미매칭</span>
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        {it.appliedToCase ? (
                          <span
                            style={{
                              background: "#dcfce7",
                              color: "#166534",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 11,
                            }}
                          >
                            ✅ 적용 완료
                          </span>
                        ) : (
                          <>
                            {!it.caseId && (
                              <button
                                onClick={() => openMatchModal(it.id)}
                                style={{
                                  background: "#29ABE2",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 4,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                              >
                                🔗 매칭
                              </button>
                            )}
                            {it.caseId && (
                              <button
                                onClick={() => applyToCase(it.id)}
                                style={{
                                  background: "#8DC63F",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 4,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                              >
                                ➡️ 적용
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => deleteItem(it.id)}
                          style={{ ...dangerButtonStyle, padding: "4px 8px", fontSize: 11 }}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 매칭 후보 모달 ─── */}
      {matchModalNoticeId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setMatchModalNoticeId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 24,
              maxWidth: 800,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>사건 매칭 후보</h3>
              <button onClick={() => setMatchModalNoticeId(null)} style={subtleButtonStyle}>
                닫기
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              재해자명·사건유형·관할공단을 기준으로 매칭 점수를 계산합니다. 가장 적합한 사건을 선택하세요.
            </p>

            {loadingCandidates ? (
              <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>후보 검색 중...</div>
            ) : matchCandidates.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
                매칭 후보가 없습니다. 재해자명이 추출되지 않았거나 일치하는 사건이 없습니다.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ padding: 8, textAlign: "left" }}>재해자</th>
                    <th style={{ padding: 8, textAlign: "left" }}>사건유형</th>
                    <th style={{ padding: 8, textAlign: "left" }}>상태</th>
                    <th style={{ padding: 8, textAlign: "left" }}>관할공단</th>
                    <th style={{ padding: 8, textAlign: "left" }}>TF</th>
                    <th style={{ padding: 8, textAlign: "center" }}>점수</th>
                    <th style={{ padding: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {matchCandidates.map((c) => (
                    <tr key={c.caseId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: 8, fontWeight: 600 }}>{c.patientName}</td>
                      <td style={{ padding: 8 }}>{CASE_TYPE_KOR[c.caseType] ?? c.caseType}</td>
                      <td style={{ padding: 8, fontSize: 12, color: "#6b7280" }}>{c.status}</td>
                      <td style={{ padding: 8 }}>{c.kwcOfficeName ?? "-"}</td>
                      <td style={{ padding: 8 }}>{c.tfName ?? "-"}</td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <span
                          style={{
                            background: c.matchScore >= 80 ? "#dcfce7" : c.matchScore >= 50 ? "#fef9c3" : "#fee2e2",
                            color: c.matchScore >= 80 ? "#166534" : c.matchScore >= 50 ? "#854d0e" : "#991b1b",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                          title={c.matchReasons.join(", ")}
                        >
                          {c.matchScore}점
                        </span>
                      </td>
                      <td style={{ padding: 8, textAlign: "right" }}>
                        <button
                          onClick={() => selectMatch(matchModalNoticeId, c.caseId)}
                          style={successButtonStyle}
                        >
                          선택
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
