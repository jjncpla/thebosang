"use client";

import { useEffect, useRef, useState } from "react";
import type { ParsedAvgWage } from "@/lib/avg-wage-parser";
import FormModal, { type FormModalField } from "@/components/ui/FormModal";

type ListItem = {
  id: string;
  fileName: string;
  workerName: string | null;
  workplaceName: string | null;
  diagnosisDate: string | null;
  baseAvgWage: number | null;
  statWageBase: number | null;
  finalAvgWage: number | null;
  needsCorrection: boolean;
  correctionReason: string | null;
  verifyStatus: string | null;
  wageReviewId: string | null;
  createdAt: string;
};

/** 평균임금산정내역서 OCR 자동 인입 검토 페이지 */
export default function AvgWageNoticePage() {
  const [parsed, setParsed] = useState<ParsedAvgWage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 모달 상태
  const [pdfModalItem, setPdfModalItem] = useState<ListItem | null>(null);
  const [pdfModalSubmitting, setPdfModalSubmitting] = useState(false);
  const [promoteModalItem, setPromoteModalItem] = useState<ListItem | null>(null);
  const [promoteModalSubmitting, setPromoteModalSubmitting] = useState(false);

  const [recent, setRecent] = useState<ListItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterCorrection, setFilterCorrection] = useState<"all" | "needs" | "ok">("all");

  async function fetchRecent() {
    setLoadingHistory(true);
    try {
      const url =
        filterCorrection === "needs"
          ? "/api/avg-wage/list?limit=20&needsCorrection=true"
          : filterCorrection === "ok"
          ? "/api/avg-wage/list?limit=20&needsCorrection=false"
          : "/api/avg-wage/list?limit=20";
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
  }, [filterCorrection]);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadedFileName(file.name);
    setOcrRawText(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("includeRaw", "true");
      const res = await fetch("/api/avg-wage/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "파싱 실패");
      if (data.parsed?.rawText) setOcrRawText(data.parsed.rawText);
      setParsed(data.parsed as ParsedAvgWage);
      fetchRecent();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function resetUpload() {
    setParsed(null);
    setUploadError(null);
    setUploadedFileName(null);
    setOcrRawText(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteItem(id: string) {
    if (!confirm("이 검토 이력을 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/avg-wage/list?id=${id}`, { method: "DELETE" });
      fetchRecent();
    } catch {
      alert("삭제 실패");
    }
  }

  /** 평균임금 정정청구서 PDF 다운로드 - 모달 열기 */
  function openPdfModal(item: ListItem) {
    setPdfModalItem(item);
  }

  /** 평균임금 정정청구서 PDF 실제 생성 */
  async function submitPdfModal(values: Record<string, string>) {
    if (!pdfModalItem) return;
    setPdfModalSubmitting(true);
    try {
      const res = await fetch(`/api/avg-wage/${pdfModalItem.id}/correction-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalReason: values.additionalReason ?? "",
          bankName: values.bankName ?? "",
          bankAccount: values.bankAccount ?? "",
          bankHolder: values.bankHolder ?? "",
          claimantAddr: values.claimantAddr ?? "",
          claimantPhone: values.claimantPhone ?? "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`PDF 생성 실패: ${data.error ?? res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `평균임금정정청구서_${pdfModalItem.workerName ?? "재해자"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfModalItem(null);
    } catch (e) {
      alert(`PDF 생성 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPdfModalSubmitting(false);
    }
  }

  /** AvgWageNotice → WageReviewData 변환 - 모달 열기 */
  function openPromoteModal(item: ListItem) {
    if (item.wageReviewId) {
      alert(`이미 WageReviewData로 변환됨 (id=${item.wageReviewId})`);
      return;
    }
    setPromoteModalItem(item);
  }

  /** WageReviewData 변환 실제 실행 */
  async function submitPromoteModal(values: Record<string, string>) {
    if (!promoteModalItem) return;
    setPromoteModalSubmitting(true);
    try {
      const res = await fetch(`/api/avg-wage/${promoteModalItem.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tfName: values.tfName,
          patientName: values.patientName,
          caseType: values.caseType,
          caseId: values.caseId || null,
          reviewManagerName: values.reviewManagerName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "변환 실패");
        return;
      }
      alert(`✅ WageReviewData 생성 완료 (id=${data.wageReviewId})`);
      setPromoteModalItem(null);
      fetchRecent();
    } catch (e) {
      alert(`변환 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPromoteModalSubmitting(false);
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
    maxWidth: 1080,
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
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 500,
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#111827",
    fontWeight: 600,
  };
  const fieldRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
  };
  const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  };
  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "#ef4444",
  };
  const subtleButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
  };

  function fmtAmount(n: number | null | undefined): string {
    if (n === null || n === undefined) return "-";
    return n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  }

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

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>📋 평균임금산정내역서 자동 인입</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        근로복지공단이 발신한 평균임금산정내역서 PDF를 업로드하면, OCR로 자동 추출하고
        정정청구 검토 필요 여부를 판정합니다 (적용임금 / 비교임금 &lt; 95% 시 트리거).
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

            {/* 정정청구 판정 결과 (가장 중요) */}
            {parsed.needsCorrection ? (
              <div
                style={{
                  padding: 16,
                  background: "#fef2f2",
                  border: "2px solid #ef4444",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>
                  🚨 평균임금 정정청구 검토 필요
                </div>
                <div style={{ fontSize: 14, color: "#7f1d1d" }}>
                  {parsed.correctionReason}
                </div>
              </div>
            ) : parsed.correctionReason ? (
              <div
                style={{
                  padding: 12,
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: 14,
                  color: "#166534",
                }}
              >
                ✅ {parsed.correctionReason}
              </div>
            ) : (
              <div
                style={{
                  padding: 12,
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: 14,
                  color: "#92400e",
                }}
              >
                ⚠️ 적용평균임금 또는 비교임금이 추출되지 않아 정정청구 판정을 못했습니다.
              </div>
            )}

            {/* 추출 필드 표시 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                  사건 정보
                </h3>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>관리번호</span>
                  <span style={valueStyle}>{parsed.managementNo ?? "-"}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>회사명</span>
                  <span style={valueStyle}>{parsed.workplaceName ?? "-"}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>사업종류</span>
                  <span style={valueStyle}>{parsed.businessType ?? "-"}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>성명</span>
                  <span style={valueStyle}>{parsed.workerName ?? "-"}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>주민번호 앞</span>
                  <span style={valueStyle}>{parsed.rrnPrefix ?? "-"}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>채용일</span>
                  <span style={valueStyle}>{fmtDate(parsed.hireDate)}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>산정사유발생일</span>
                  <span style={valueStyle}>{fmtDate(parsed.diagnosisDate)}</span>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                  임금 산정
                </h3>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>임금산정형태</span>
                  <span style={valueStyle}>{parsed.wageCalcType ?? "-"}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>일당</span>
                  <span style={valueStyle}>{fmtAmount(parsed.dailyWage)}원</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>통상근로계수</span>
                  <span style={valueStyle}>{parsed.commuteCoef ?? "-"}</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>근기법 평균임금</span>
                  <span style={valueStyle}>{fmtAmount(parsed.baseAvgWage)}원</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>특례임금</span>
                  <span style={valueStyle}>{fmtAmount(parsed.statWageBase)}원</span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>적용평균임금</span>
                  <span style={{ ...valueStyle, color: "#1d4ed8" }}>
                    {fmtAmount(parsed.finalAvgWage)}원
                  </span>
                </div>
                <div style={fieldRowStyle}>
                  <span style={labelStyle}>적용일자</span>
                  <span style={valueStyle}>{fmtDate(parsed.finalApplyDate)}</span>
                </div>
              </div>
            </div>

            {/* 노동통계 (특례임금 산출 자료) */}
            <div style={{ marginTop: 16, padding: 12, background: "#f9fafb", borderRadius: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
                노동통계 (사업체노동력조사)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
                <div>
                  <span style={labelStyle}>적용분기</span>
                  <div style={valueStyle}>{parsed.statQuarter ?? "-"}</div>
                </div>
                <div>
                  <span style={labelStyle}>사업체 규모</span>
                  <div style={valueStyle}>{parsed.statSize ?? "-"}</div>
                </div>
                <div>
                  <span style={labelStyle}>총일수</span>
                  <div style={valueStyle}>{parsed.statTotalDays ?? "-"}일</div>
                </div>
                <div>
                  <span style={labelStyle}>총금액</span>
                  <div style={valueStyle}>{fmtAmount(parsed.statTotalAmount)}원</div>
                </div>
              </div>
            </div>

            {/* 특이사항 */}
            {parsed.remarks && (
              <div style={{ marginTop: 16, padding: 12, background: "#fefce8", borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#92400e" }}>
                  특이사항 (원문)
                </div>
                <div style={{ fontSize: 12, whiteSpace: "pre-wrap", color: "#451a03", maxHeight: 200, overflow: "auto" }}>
                  {parsed.remarks}
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

      {/* ─── 최근 업로드 이력 ─── */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={sectionTitleStyle}>📜 최근 검토 이력</h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setFilterCorrection("all")}
              style={{
                ...subtleButtonStyle,
                background: filterCorrection === "all" ? "#3b82f6" : "#f3f4f6",
                color: filterCorrection === "all" ? "#fff" : "#374151",
              }}
            >
              전체
            </button>
            <button
              onClick={() => setFilterCorrection("needs")}
              style={{
                ...subtleButtonStyle,
                background: filterCorrection === "needs" ? "#ef4444" : "#f3f4f6",
                color: filterCorrection === "needs" ? "#fff" : "#374151",
              }}
            >
              🚨 정정청구 필요
            </button>
            <button
              onClick={() => setFilterCorrection("ok")}
              style={{
                ...subtleButtonStyle,
                background: filterCorrection === "ok" ? "#22c55e" : "#f3f4f6",
                color: filterCorrection === "ok" ? "#fff" : "#374151",
              }}
            >
              ✅ 정상
            </button>
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>로딩 중...</div>
        ) : recent.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
            검토 이력이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>업로드일</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>파일명</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>성명</th>
                  <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>회사명</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>근기법</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>특례</th>
                  <th style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>적용</th>
                  <th style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>판정</th>
                  <th style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>변환</th>
                  <th style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: 8 }}>
                      {new Date(it.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td style={{ padding: 8, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.fileName}>
                      {it.fileName}
                    </td>
                    <td style={{ padding: 8 }}>{it.workerName ?? "-"}</td>
                    <td style={{ padding: 8 }}>{it.workplaceName ?? "-"}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{fmtAmount(it.baseAvgWage)}</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{fmtAmount(it.statWageBase)}</td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>
                      {fmtAmount(it.finalAvgWage)}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      {it.needsCorrection ? (
                        <span
                          style={{
                            background: "#fef2f2",
                            color: "#991b1b",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                          title={it.correctionReason ?? ""}
                        >
                          🚨 검토필요
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#f0fdf4",
                            color: "#166534",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          ✅
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        {it.wageReviewId ? (
                          <span
                            style={{
                              background: "#dbeafe",
                              color: "#1e40af",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 11,
                            }}
                            title={`WageReviewData id=${it.wageReviewId}`}
                          >
                            ✅ 변환됨
                          </span>
                        ) : (
                          <button
                            onClick={() => openPromoteModal(it)}
                            style={{
                              background: "#3b82f6",
                              color: "#fff",
                              border: "none",
                              borderRadius: 4,
                              padding: "4px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            ➡️ 변환
                          </button>
                        )}
                        <button
                          onClick={() => openPdfModal(it)}
                          style={{
                            background: "#7c3aed",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            padding: "4px 8px",
                            fontSize: 11,
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                          title="평균임금 정정청구서 PDF 다운로드"
                        >
                          📄 정정청구서
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <button
                        onClick={() => deleteItem(it.id)}
                        style={{ ...dangerButtonStyle, padding: "4px 8px", fontSize: 11 }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 정정청구서 PDF 입력 모달 ─── */}
      <FormModal
        open={!!pdfModalItem}
        title="평균임금 정정청구서 입력"
        description={
          pdfModalItem
            ? `${pdfModalItem.workerName ?? "재해자"} (${pdfModalItem.workplaceName ?? "사업장 미상"}) - 추가 정보를 입력 후 PDF를 생성합니다. 빈 칸은 양식에서 비워둡니다.`
            : undefined
        }
        fields={
          [
            {
              key: "additionalReason",
              label: "추가 청구 사유 (선택)",
              type: "textarea",
              placeholder: "비우면 자동 생성된 사유만 사용",
              helpText: "OCR 자동 판정 사유 외에 노무사가 추가하고 싶은 내용",
            },
            { key: "bankName", label: "수령 은행 (선택)", type: "text" },
            { key: "bankAccount", label: "계좌번호 (선택)", type: "text" },
            {
              key: "bankHolder",
              label: "예금주 (선택)",
              type: "text",
              defaultValue: pdfModalItem?.workerName ?? "",
            },
            { key: "claimantAddr", label: "청구인 주소 (선택)", type: "text" },
            { key: "claimantPhone", label: "청구인 연락처 (선택)", type: "text" },
          ] as FormModalField[]
        }
        submitLabel="📄 PDF 다운로드"
        cancelLabel="취소"
        submitting={pdfModalSubmitting}
        onSubmit={submitPdfModal}
        onCancel={() => setPdfModalItem(null)}
      />

      {/* ─── WageReviewData 변환 모달 ─── */}
      <FormModal
        open={!!promoteModalItem}
        title="WageReviewData로 변환"
        description={
          promoteModalItem
            ? `${promoteModalItem.workerName ?? "재해자"} (${promoteModalItem.workplaceName ?? "사업장 미상"}) - 사건 정보를 입력해 평균임금 검토 자료로 변환합니다.`
            : undefined
        }
        fields={
          [
            {
              key: "tfName",
              label: "TF명",
              type: "text",
              placeholder: "예: 울산북부TF",
              required: true,
            },
            {
              key: "patientName",
              label: "재해자 성명",
              type: "text",
              required: true,
              defaultValue: promoteModalItem?.workerName ?? "",
            },
            {
              key: "caseType",
              label: "사건 종류",
              type: "select",
              required: true,
              defaultValue: "소음성 난청",
              options: [
                { value: "소음성 난청", label: "소음성 난청" },
                { value: "진폐", label: "진폐" },
                { value: "COPD", label: "COPD" },
                { value: "근골격계", label: "근골격계" },
                { value: "직업성암", label: "직업성암" },
                { value: "업무상사고", label: "업무상사고" },
                { value: "기타", label: "기타" },
              ],
            },
            {
              key: "caseId",
              label: "Case ID (선택)",
              type: "text",
              placeholder: "기존 사건과 연결할 경우만 입력",
            },
            {
              key: "reviewManagerName",
              label: "검토 담당자명 (선택)",
              type: "text",
            },
          ] as FormModalField[]
        }
        submitLabel="➡️ 변환"
        cancelLabel="취소"
        submitting={promoteModalSubmitting}
        onSubmit={submitPromoteModal}
        onCancel={() => setPromoteModalItem(null)}
      />
    </div>
  );
}
