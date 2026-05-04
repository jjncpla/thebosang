"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";

/* ═══════════════════════════════════════════════════════════════
   타입 정의
   ═══════════════════════════════════════════════════════════════ */

type NoticeListItem = {
  id: string;
  caseId: string | null;
  patientId: string | null;
  wageReviewId: string | null;
  fileName: string;
  managementNo: string | null;
  diagnosisDate: string | null;
  workplaceName: string | null;
  businessType: string | null;
  workerName: string | null;
  hireDate: string | null;
  wageCalcType: string | null;
  baseAvgWage: number | null;
  statWageBase: number | null;
  finalAvgWage: number | null;
  finalApplyDate: string | null;
  needsCorrection: boolean;
  correctionReason: string | null;
  verifyStatus: string | null;
  verifyNote: string | null;
  createdAt: string;
};

type NoticeDetail = NoticeListItem & {
  fileSize: number;
  rrnPrefix: string | null;
  retirementDate: string | null;
  occupation: string | null;
  dailyWage: number | null;
  commuteCoef: number | null;
  statQuarter: string | null;
  statSize: string | null;
  statTotalDays: number | null;
  statTotalAmount: number | null;
  parsedData: unknown;
  ocrText: string | null;
  uploadedBy: string | null;
  updatedAt: string;
};

type CaseCandidate = {
  caseId: string;
  patientId: string;
  patientName: string;
  ssnMasked: string;
  caseType: string;
  status: string;
  tfName: string | null;
  branch: string | null;
  receptionDate: string | null;
  contractDate: string | null;
  createdAt: string;
};

type ParseStats = {
  total: number;
  saved: number;
  needsCorrection: number;
  failed: number;
};

type StatusFilter = "all" | "unmatched" | "matched" | "promoted";

/* ═══════════════════════════════════════════════════════════════
   유틸
   ═══════════════════════════════════════════════════════════════ */

const KRW = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("ko-KR") + "원";

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
};

const PRIMARY = "#29ABE2";
const DANGER = "#ef4444";
const OK = "#16a34a";
const WARN = "#f59e0b";

/* ═══════════════════════════════════════════════════════════════
   페이지
   ═══════════════════════════════════════════════════════════════ */

export default function AvgWagePage() {
  // ── 업로드 상태 ──
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [parseStats, setParseStats] = useState<ParseStats | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // ── 목록 상태 ──
  const [items, setItems] = useState<NoticeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // ── 상세 패널 상태 ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NoticeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── 매칭/promote 상태 ──
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    matched: boolean;
    matchedCase?: CaseCandidate;
    candidates: CaseCandidate[];
    message?: string;
  } | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteForm, setPromoteForm] = useState({
    caseId: "",
    tfName: "",
    patientName: "",
    caseType: "HEARING_LOSS",
    reviewManagerName: "",
  });

  /* ── 토스트 자동 종료 ── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── 목록 로드 ── */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (searchName.trim()) params.set("workerName", searchName.trim());
      if (needsOnly) params.set("needsCorrection", "true");
      const res = await fetch(`/api/avg-wage/list?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록 로드 실패");
      setItems(data.items ?? []);
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, [searchName, needsOnly]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /* ── 상세 로드 ── */
  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setMatchResult(null);
    try {
      const res = await fetch(`/api/avg-wage/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "상세 로드 실패");
      const item = data.item as NoticeDetail;
      setDetail(item);
      setPromoteForm((prev) => ({
        ...prev,
        caseId: item.caseId ?? "",
        patientName: item.workerName ?? "",
      }));
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  /* ── 파일 업로드 + 파싱 ── */
  const handleUpload = async () => {
    if (files.length === 0) {
      setToast({ kind: "err", msg: "PDF 파일을 선택하세요." });
      return;
    }
    setUploading(true);
    setParseStats(null);
    let saved = 0;
    let needs = 0;
    let failed = 0;
    for (const f of files) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/avg-wage/parse", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          failed += 1;
          console.error(`[upload] ${f.name}: ${data.error}`);
          continue;
        }
        saved += 1;
        if (data.parsed?.needsCorrection) needs += 1;
      } catch (e) {
        failed += 1;
        console.error(`[upload] ${f.name}:`, e);
      }
    }
    setParseStats({ total: files.length, saved, needsCorrection: needs, failed });
    setToast({
      kind: failed === 0 ? "ok" : "err",
      msg: `인입 ${saved}건 / 정정청구 검토 ${needs}건 / 실패 ${failed}건`,
    });
    setFiles([]);
    setUploading(false);
    await loadList();
  };

  /* ── 사건 매칭 ── */
  const handleMatch = async () => {
    if (!detail) return;
    setMatching(true);
    setMatchResult(null);
    try {
      const res = await fetch("/api/avg-wage/match-and-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workerName: detail.workerName,
          rrnPrefix: detail.rrnPrefix,
          diagnosisDate: detail.diagnosisDate,
          ocrFinalAvgWage: detail.finalAvgWage,
          ocrBaseAvgWage: detail.baseAvgWage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "매칭 실패");
      setMatchResult(data);

      // 단일 매칭이면 promoteForm 자동 채움
      if (data.matched && data.matchedCase) {
        setPromoteForm((prev) => ({
          ...prev,
          caseId: data.matchedCase.caseId,
          tfName: data.matchedCase.tfName ?? prev.tfName,
          patientName: data.matchedCase.patientName ?? prev.patientName,
          caseType: data.matchedCase.caseType ?? prev.caseType,
        }));
      }
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setMatching(false);
    }
  };

  /* ── promote ── */
  const handlePromote = async () => {
    if (!detail) return;
    if (!promoteForm.tfName.trim() || !promoteForm.patientName.trim() || !promoteForm.caseType.trim()) {
      setToast({ kind: "err", msg: "TF / 재해자명 / 상병종류는 필수입니다." });
      return;
    }
    setPromoting(true);
    try {
      const res = await fetch(`/api/avg-wage/${detail.id}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tfName: promoteForm.tfName.trim(),
          patientName: promoteForm.patientName.trim(),
          caseType: promoteForm.caseType.trim(),
          caseId: promoteForm.caseId.trim() || null,
          reviewManagerName: promoteForm.reviewManagerName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "promote 실패");
      setToast({ kind: "ok", msg: `WageReviewData 생성 완료 (id=${data.wageReviewId})` });
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setPromoting(false);
    }
  };

  /* ── 삭제 ── */
  const handleDelete = async () => {
    if (!detail) return;
    if (!confirm(`정말 삭제하시겠습니까?\n파일: ${detail.fileName}`)) return;
    try {
      const res = await fetch(`/api/avg-wage/list?id=${detail.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      setToast({ kind: "ok", msg: "삭제 완료" });
      setSelectedId(null);
      setDetail(null);
      await loadList();
    } catch (e) {
      setToast({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    }
  };

  /* ── 클라이언트 사이드 status 필터 ── */
  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((it) => {
      if (statusFilter === "promoted") return !!it.wageReviewId;
      if (statusFilter === "matched") return !!it.caseId && !it.wageReviewId;
      if (statusFilter === "unmatched") return !it.caseId;
      return true;
    });
  }, [items, statusFilter]);

  /* ── 헤더 통계 ── */
  const headerStats = useMemo(() => {
    const total = items.length;
    const needs = items.filter((i) => i.needsCorrection).length;
    const promoted = items.filter((i) => !!i.wageReviewId).length;
    return { total, needs, promoted };
  }, [items]);

  /* ═══════════════════════════════════════════════════════════════
     렌더
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#1e293b" }}>
      {/* ── 페이지 헤더 ── */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>평균임금 산정내역서 OCR 인입</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
          공단 평균임금산정내역서 PDF를 업로드하면 자동으로 텍스트를 추출하고 핵심 필드를 인입합니다. 정정청구 검토가 필요한 건은 자동 표시됩니다.
        </p>
      </div>

      {/* ── 토스트 ── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 70,
            right: 24,
            background: toast.kind === "ok" ? "#dcfce7" : "#fef2f2",
            border: `1px solid ${toast.kind === "ok" ? "#86efac" : "#fecaca"}`,
            color: toast.kind === "ok" ? "#166534" : "#991b1b",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            maxWidth: 420,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── 통계 헤더 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="총 인입" value={headerStats.total} color={PRIMARY} />
        <StatCard label="정정청구 검토 필요" value={headerStats.needs} color={WARN} />
        <StatCard label="WageReviewData 변환 완료" value={headerStats.promoted} color={OK} />
      </div>

      {/* ── 섹션 1: 업로드 ── */}
      <div style={card}>
        <div style={cardHead}>1. PDF 업로드 & OCR 인입</div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              disabled={uploading}
              style={{ fontSize: 13 }}
            />
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              style={btnPrimary(uploading || files.length === 0)}
            >
              {uploading ? "OCR 인입 중..." : `OCR 인입 (${files.length}건)`}
            </button>
            {files.length > 0 && !uploading && (
              <button onClick={() => setFiles([])} style={btnGhost}>선택 해제</button>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
            * 한 파일당 15MB 이하. 여러 파일 한 번에 업로드 가능 (순차 처리).
          </p>
          {parseStats && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              결과 — 총 {parseStats.total}건 중 인입 {parseStats.saved} / 정정청구 {parseStats.needsCorrection} / 실패 {parseStats.failed}
            </div>
          )}
        </div>
      </div>

      {/* ── 섹션 2: 필터 ── */}
      <div style={{ ...card, padding: "10px 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="재해자명 검색 (정확히 일치)"
            style={input}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={needsOnly}
              onChange={(e) => setNeedsOnly(e.target.checked)}
            />
            정정청구 검토 필요만 보기
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={input}
          >
            <option value="all">전체 상태</option>
            <option value="unmatched">미매칭</option>
            <option value="matched">매칭됨 (promote 전)</option>
            <option value="promoted">promoted</option>
          </select>
          <button onClick={loadList} disabled={loading} style={btnSecondary(loading)}>
            {loading ? "로드 중..." : "새로고침"}
          </button>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
            {filteredItems.length} / {items.length}건 표시
          </span>
        </div>
      </div>

      {/* ── 섹션 3: 메인 테이블 + 사이드 패널 ── */}
      <div style={{ display: "grid", gridTemplateColumns: detail ? "1fr 460px" : "1fr", gap: 16, marginTop: 16 }}>
        {/* 왼쪽: 테이블 */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflow: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0 }}>
                  <th style={th}>재해자</th>
                  <th style={th}>산정사유일</th>
                  <th style={th}>사업장</th>
                  <th style={th}>임금산정형태</th>
                  <th style={thRight}>근기법평임</th>
                  <th style={thRight}>특례임금</th>
                  <th style={thRight}>적용평임</th>
                  <th style={thCenter}>정정청구</th>
                  <th style={thCenter}>상태</th>
                  <th style={th}>인입일</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                      {loading ? "로드 중..." : "데이터 없음"}
                    </td>
                  </tr>
                )}
                {filteredItems.map((it) => {
                  const isSelected = it.id === selectedId;
                  const status = it.wageReviewId ? "promoted" : it.caseId ? "matched" : "pending";
                  return (
                    <tr
                      key={it.id}
                      onClick={() => setSelectedId(it.id)}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        cursor: "pointer",
                        background: isSelected ? "#e0f2fe" : it.needsCorrection ? "#fffbeb" : "white",
                      }}
                    >
                      <td style={td}>{it.workerName ?? "—"}</td>
                      <td style={td}>{fmtDate(it.diagnosisDate)}</td>
                      <td style={td} title={it.workplaceName ?? ""}>
                        {it.workplaceName ? (it.workplaceName.length > 16 ? it.workplaceName.slice(0, 16) + "…" : it.workplaceName) : "—"}
                      </td>
                      <td style={td}>{it.wageCalcType ?? "—"}</td>
                      <td style={tdRight}>{KRW(it.baseAvgWage)}</td>
                      <td style={tdRight}>{KRW(it.statWageBase)}</td>
                      <td style={tdRight}>{KRW(it.finalAvgWage)}</td>
                      <td style={tdCenter}>
                        {it.needsCorrection ? (
                          <span style={{ ...badge, background: WARN, color: "white" }}>필요</span>
                        ) : (
                          <span style={{ ...badge, background: "#f3f4f6", color: "#6b7280" }}>—</span>
                        )}
                      </td>
                      <td style={tdCenter}>
                        {status === "promoted" && <span style={{ ...badge, background: OK, color: "white" }}>완료</span>}
                        {status === "matched" && <span style={{ ...badge, background: PRIMARY, color: "white" }}>매칭</span>}
                        {status === "pending" && <span style={{ ...badge, background: "#94a3b8", color: "white" }}>미매칭</span>}
                      </td>
                      <td style={td}>{fmtDate(it.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 상세 패널 */}
        {detail && (
          <div style={{ ...card, padding: 0, alignSelf: "start", maxHeight: "70vh", overflow: "auto" }}>
            <div style={{ ...cardHead, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>상세 — {detail.workerName ?? "(이름 없음)"}</span>
              <button onClick={() => setSelectedId(null)} style={{ ...btnGhost, padding: "4px 10px" }}>닫기</button>
            </div>

            <div style={{ padding: 14 }}>
              {detailLoading ? (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>로드 중...</div>
              ) : (
                <>
                  {/* 기본 정보 */}
                  <Section title="기본 정보">
                    <Row k="파일명" v={detail.fileName} />
                    <Row k="관리번호" v={detail.managementNo ?? "—"} />
                    <Row k="산정사유발생일" v={fmtDate(detail.diagnosisDate)} />
                    <Row k="사업장" v={detail.workplaceName ?? "—"} />
                    <Row k="사업종류" v={detail.businessType ?? "—"} />
                    <Row k="직종" v={detail.occupation ?? "—"} />
                    <Row k="채용일" v={fmtDate(detail.hireDate)} />
                  </Section>

                  {/* 임금 정보 */}
                  <Section title="임금 정보">
                    <Row k="임금산정형태" v={detail.wageCalcType ?? "—"} />
                    <Row k="일당" v={KRW(detail.dailyWage)} />
                    <Row k="통상근로계수" v={detail.commuteCoef !== null ? String(detail.commuteCoef) : "—"} />
                    <Row k="근기법 평균임금" v={KRW(detail.baseAvgWage)} />
                    <Row k="특례임금" v={KRW(detail.statWageBase)} />
                    <Row k="적용평균임금" v={KRW(detail.finalAvgWage)} bold />
                    <Row k="적용일자" v={fmtDate(detail.finalApplyDate)} />
                    <Row k="통계분기" v={detail.statQuarter ?? "—"} />
                    <Row k="통계규모" v={detail.statSize ?? "—"} />
                  </Section>

                  {/* 정정청구 트리거 */}
                  {detail.needsCorrection && (
                    <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>⚠ 정정청구 검토 필요</div>
                      <div style={{ color: "#78350f" }}>{detail.correctionReason ?? "비교 결과 적용임금이 부족합니다."}</div>
                    </div>
                  )}

                  {/* 매칭 / promote */}
                  <Section title="사건 매칭 & WageReviewData 변환">
                    {detail.wageReviewId ? (
                      <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, padding: 10, fontSize: 12, color: "#166534" }}>
                        ✓ 이미 WageReviewData로 변환됨 (id={detail.wageReviewId.slice(0, 10)}…)
                      </div>
                    ) : (
                      <>
                        <button onClick={handleMatch} disabled={matching} style={{ ...btnSecondary(matching), marginBottom: 10 }}>
                          {matching ? "매칭 중..." : "사건 매칭 검색"}
                        </button>

                        {matchResult && (
                          <div style={{ marginBottom: 10, padding: 10, background: "#f8fafc", borderRadius: 6, fontSize: 12 }}>
                            <div style={{ marginBottom: 6, color: "#475569" }}>{matchResult.message}</div>
                            {matchResult.matched && matchResult.matchedCase && (
                              <div style={{ color: "#166534" }}>
                                ✓ 매칭: {matchResult.matchedCase.patientName} / {matchResult.matchedCase.caseType} / {matchResult.matchedCase.tfName ?? "-"}
                              </div>
                            )}
                            {matchResult.candidates.length > 0 && (
                              <div style={{ marginTop: 6 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>후보 {matchResult.candidates.length}건:</div>
                                {matchResult.candidates.map((c) => (
                                  <button
                                    key={c.caseId}
                                    onClick={() => setPromoteForm((p) => ({ ...p, caseId: c.caseId, tfName: c.tfName ?? p.tfName, patientName: c.patientName, caseType: c.caseType }))}
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", marginBottom: 4, border: "1px solid #e5e7eb", borderRadius: 4, background: promoteForm.caseId === c.caseId ? "#dbeafe" : "white", cursor: "pointer", fontSize: 11 }}
                                  >
                                    {c.patientName} | {CASE_TYPE_LABELS[c.caseType] ?? c.caseType} | {c.tfName ?? "-"} | {c.status}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: "grid", gap: 6 }}>
                          <Field label="caseId (선택)">
                            <input
                              type="text"
                              value={promoteForm.caseId}
                              onChange={(e) => setPromoteForm({ ...promoteForm, caseId: e.target.value })}
                              placeholder="cuid…"
                              style={input}
                            />
                          </Field>
                          <Field label="TF *">
                            <input
                              type="text"
                              value={promoteForm.tfName}
                              onChange={(e) => setPromoteForm({ ...promoteForm, tfName: e.target.value })}
                              placeholder="예: 더보상TF"
                              style={input}
                            />
                          </Field>
                          <Field label="재해자명 *">
                            <input
                              type="text"
                              value={promoteForm.patientName}
                              onChange={(e) => setPromoteForm({ ...promoteForm, patientName: e.target.value })}
                              style={input}
                            />
                          </Field>
                          <Field label="상병종류 *">
                            <select
                              value={promoteForm.caseType}
                              onChange={(e) => setPromoteForm({ ...promoteForm, caseType: e.target.value })}
                              style={input}
                            >
                              {Object.entries(CASE_TYPE_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>{label} ({k})</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="검토자명 (선택)">
                            <input
                              type="text"
                              value={promoteForm.reviewManagerName}
                              onChange={(e) => setPromoteForm({ ...promoteForm, reviewManagerName: e.target.value })}
                              style={input}
                            />
                          </Field>
                          <button onClick={handlePromote} disabled={promoting} style={{ ...btnPrimary(promoting), marginTop: 6 }}>
                            {promoting ? "변환 중..." : "WageReviewData로 변환"}
                          </button>
                        </div>
                      </>
                    )}
                  </Section>

                  {/* 액션 */}
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={handleDelete} style={btnDanger}>삭제</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   서브 컴포넌트
   ═══════════════════════════════════════════════════════════════ */

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #e5e7eb" }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", fontSize: 12, padding: "3px 0" }}>
      <span style={{ width: 110, color: "#6b7280", flexShrink: 0 }}>{k}</span>
      <span style={{ color: "#1e293b", fontWeight: bold ? 700 : 400, wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12 }}>
      <span style={{ display: "block", color: "#6b7280", marginBottom: 2 }}>{label}</span>
      {children}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════
   스타일
   ═══════════════════════════════════════════════════════════════ */

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  marginBottom: 12,
};

const cardHead: React.CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 14,
  fontWeight: 700,
  color: "#1e293b",
  background: "#f8fafc",
  borderTopLeftRadius: 8,
  borderTopRightRadius: 8,
};

const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#475569", whiteSpace: "nowrap" };
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const thCenter: React.CSSProperties = { ...th, textAlign: "center" };
const td: React.CSSProperties = { padding: "8px 10px", whiteSpace: "nowrap" };
const tdRight: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const tdCenter: React.CSSProperties = { ...td, textAlign: "center" };

const input: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
};

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#9ca3af" : PRIMARY,
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
});

const btnSecondary = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#e5e7eb" : "white",
  color: disabled ? "#9ca3af" : "#1e293b",
  border: `1px solid ${disabled ? "#e5e7eb" : "#d1d5db"}`,
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
});

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#6b7280",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  background: "white",
  color: DANGER,
  border: `1px solid ${DANGER}`,
  borderRadius: 6,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
