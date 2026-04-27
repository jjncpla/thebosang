"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FORM_FIELDS, type FieldEntry } from "@/lib/formFields";

const FORMS = [
  { type: "DISABILITY_CLAIM",   label: "장해급여 청구서",                    pages: 1 },
  { type: "NOISE_WORK_CONFIRM", label: "소음작업 종사 사실 확인서",           pages: 1 },
  { type: "AGENT_APPOINTMENT",  label: "대리인 선임신고서",                   pages: 1 },
  { type: "POWER_OF_ATTORNEY",  label: "위임장",                              pages: 1 },
  { type: "SPECIAL_CLINIC",     label: "특진의료기관 선택 확인서 (특진)",      pages: 1 },
  { type: "EXPERT_CLINIC",      label: "특진의료기관 선택 확인서 (전문조사)",  pages: 1 },
  { type: "WORK_HISTORY",       label: "직업력 조사 표준문답서",               pages: 3 },
  { type: "INFO_DISCLOSURE",        label: "정보공개 청구서",             pages: 1 },
  { type: "INFO_DISCLOSURE_PROXY",  label: "정보공개청구 위임장",         pages: 1, badge: "공통" },
  { type: "LABOR_ATTORNEY_RECORD",  label: "공인노무사 업무처리부",       pages: 1 },
  { type: "THIRD_PARTY_INFO",       label: "본인정보 제3자 제공요구서",   pages: 1, badge: "공통" },
  { type: "MEDICAL_BENEFIT",        label: "요양급여신청서",              pages: 1, badge: "공통" },
  { type: "SICK_LEAVE_BENEFIT",     label: "휴업급여신청서",              pages: 1, badge: "공통" },
  { type: "PENSION_CHOICE",         label: "연금·일시금 선택확인서",      pages: 1, badge: "공통" },
  { type: "BEREAVED_CLAIM",         label: "유족급여·장례비청구서",       pages: 1, badge: "유족 전용" },
  { type: "EX_WORKER_HEALTH_EXAM",  label: "이직자 건강진단 신청서",      pages: 1, badge: "진폐 전용" },
  { type: "DUST_WORK_CONFIRM",      label: "분진작업종사사실확인서",      pages: 1, badge: "진폐 전용" },
];

// FORM_FIELDS: @/lib/formFields import
// pdf-lib pt 좌표계 (좌하단 원점, A4=595×841)
const PDF_W = 595;
const PDF_H = 841;

export default function FormsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && (session.user as { role?: string }).role !== "ADMIN") { router.replace("/"); return; }
  }, [status, session, router]);

  const [selectedForm, setSelectedForm]   = useState<string | null>(null);
  const [previewPage, setPreviewPage]     = useState(1);
  const [selectedField, setSelectedField] = useState<FieldEntry | null>(null);
  const [coordFields, setCoordFields]     = useState<Record<string, FieldEntry[]>>({});
  const [coordOutput, setCoordOutput]     = useState("");
  const [testValues, setTestValues]       = useState<Record<string, string>>({});
  const [testLoading, setTestLoading]     = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState('');

  // 개발 요청 패널
  const [reqPanelOpen, setReqPanelOpen]   = useState(false);
  const [reqList, setReqList]             = useState<any[]>([]);
  const [reqFilter, setReqFilter]         = useState<string>("pending");
  const [reqDraft, setReqDraft]           = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/forms/requests?status=${reqFilter}`);
      if (res.ok) {
        const d = await res.json();
        setReqList(d.items ?? []);
      }
    } catch {}
  }, [reqFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const updateRequest = async (id: string, patch: { status?: string; resolution?: string }) => {
    const res = await fetch(`/api/forms/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) loadRequests();
    else alert('처리 실패');
  };

  const pendingCount = reqList.filter(r => r.status === 'pending').length;

  useEffect(() => { setTestValues({}); setSaveMsg(''); }, [selectedForm]);

  // 서식 선택 시 DB 좌표 로드 — FORM_FIELDS 기준 뼈대에 DB x/y만 override (label 불변)
  useEffect(() => {
    if (!selectedForm) return;
    fetch(`/api/forms/coordinates?type=${selectedForm}`)
      .then(r => r.json())
      .then(data => {
        const baseFields = FORM_FIELDS[selectedForm] ?? [];
        const dbFields: Array<{ key: string; x: number; y: number }> =
          Array.isArray(data?.fields) ? data.fields : [];
        const dbMap = new Map(dbFields.map(f => [f.key, f]));

        const merged = baseFields.map(f => {
          const saved = dbMap.get(f.key);
          return saved ? { ...f, x: saved.x, y: saved.y } : { ...f };
        });

        setCoordFields(prev => ({ ...prev, [selectedForm]: merged }));
      })
      .catch(() => {});
  }, [selectedForm]);

  // PNG 미리보기 상태
  const [imgSize, setImgSize]             = useState<{ w: number; h: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewType, setPreviewType]     = useState<"png" | "pdf">("png");

  const imgRef       = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 서식 선택
  const handleSelectForm = (type: string) => {
    setSelectedForm(type);
    setPreviewPage(1);
    setSelectedField(null);
    setImgSize(null);
    setPreviewType("png");
    if (!coordFields[type]) {
      setCoordFields(prev => ({
        ...prev,
        [type]: (FORM_FIELDS[type] ?? []).map(f => ({ ...f })),
      }));
    }
  };

  const updateCoordOutput = useCallback((form: string, fields: FieldEntry[]) => {
    const lines = fields.map(f => `{ key: '${f.key}', label: '${f.label}', x: ${f.x}, y: ${f.y} },`).join("\n");
    setCoordOutput(lines);
  }, []);

  const updateFieldCoord = useCallback((axis: "x" | "y", value: number) => {
    setSelectedField(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [axis]: value };
      setCoordFields(cf => {
        if (!selectedForm) return cf;
        const newFields = (cf[selectedForm] ?? []).map(f => f.key === updated.key ? updated : f);
        updateCoordOutput(selectedForm, newFields);
        return { ...cf, [selectedForm]: newFields };
      });
      return updated;
    });
  }, [selectedForm, updateCoordOutput]);

  // 필드 선택 + 컨테이너 포커스
  const handleSelectField = (key: string) => {
    if (!selectedForm) return;
    const f = coordFields[selectedForm]?.find(f => f.key === key) ?? null;
    setSelectedField(f);
    setTimeout(() => containerRef.current?.focus(), 50);
  };

  // 이미지 클릭 → 마커 이동
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedField || !imgRef.current || !imgSize) return;
    const rect = imgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    const pdfX = Math.round(clickX * scaleX * (PDF_W / imgSize.w));
    const pdfY = Math.round(PDF_H - (clickY * scaleY * (PDF_H / imgSize.h)));
    updateFieldCoord("x", pdfX);
    updateFieldCoord("y", pdfY);
  };

  // 방향키 핸들러 (컨테이너 div)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedField) return;
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!arrows.includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    switch (e.key) {
      case "ArrowLeft":  updateFieldCoord("x", selectedField.x - step); break;
      case "ArrowRight": updateFieldCoord("x", selectedField.x + step); break;
      case "ArrowUp":    updateFieldCoord("y", selectedField.y + step); break;
      case "ArrowDown":  updateFieldCoord("y", selectedField.y - step); break;
    }
  };

  const handleLoadCoords = () => {
    if (!selectedForm) return;
    const fields = coordFields[selectedForm] ?? (FORM_FIELDS[selectedForm] ?? []).map(f => ({ ...f }));
    setCoordFields(prev => ({ ...prev, [selectedForm]: fields }));
    updateCoordOutput(selectedForm, fields);
  };

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(coordOutput);
    alert("좌표가 클립보드에 복사되었습니다.");
  };

  const handleSaveCoordinates = async () => {
    if (!selectedForm) return;
    const currentFields = coordFields[selectedForm] ?? [];
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/forms/coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formKey: selectedForm, fields: currentFields }),
      });
      if (res.ok) {
        setSaveMsg('✅ 저장 완료');
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        setSaveMsg('❌ 저장 실패');
      }
    } catch {
      setSaveMsg('❌ 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleTestGenerate = async () => {
    if (!selectedForm) return;
    setTestLoading(true);
    try {
      const res = await fetch("/api/forms/test-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formKey: selectedForm, fields: testValues }),
      });
      if (!res.ok) { const d = await res.json(); alert("오류: " + d.error); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `test_${selectedForm}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("오류: " + e.message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleBlankPrint = async (type: string, label: string) => {
    const res = await fetch(`/api/forms/blank?type=${type}`);
    if (!res.ok) { alert("공란 인쇄 실패"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `[공란]${label}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  if (status === "loading") return <div style={{ padding: 40, color: "#9ca3af" }}>불러오는 중…</div>;

  const currentFormMeta = FORMS.find(f => f.type === selectedForm);
  const previewUrl = selectedForm
    ? `/api/forms/preview?type=${selectedForm}&page=${previewPage}&t=${Date.now()}`
    : "";

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif", fontSize: 13 }}>

      {/* ── 우상단 플로팅 버튼: 개발 요청 목록 ── */}
      <button
        onClick={() => setReqPanelOpen(true)}
        style={{
          position: "fixed", top: 110, right: 20, zIndex: 30,
          padding: "8px 14px", fontSize: 12, fontWeight: 700,
          background: "#fff7ed", color: "#c2410c",
          border: "1px solid #fdba74", borderRadius: 20, cursor: "pointer",
          boxShadow: "0 4px 10px rgba(0,0,0,.08)",
        }}
        title="유저들이 보낸 서식 생성 요청 목록"
      >
        📋 개발 요청 {pendingCount > 0 && (
          <span style={{
            display: "inline-block", marginLeft: 4, padding: "1px 6px",
            background: "#dc2626", color: "#fff", borderRadius: 8, fontSize: 10,
          }}>{pendingCount}</span>
        )}
      </button>

      {/* ── 개발 요청 모달 ── */}
      {reqPanelOpen && (
        <div
          onClick={() => setReqPanelOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 720, maxHeight: "85vh", overflowY: "auto",
              background: "#fff", borderRadius: 12, padding: 20,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>📋 사용자 개발 요청</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["pending", "in_progress", "done", "rejected", "all"] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => setReqFilter(k)}
                    style={{
                      padding: "4px 10px", fontSize: 11, borderRadius: 4, cursor: "pointer",
                      background: reqFilter === k ? "#1e40af" : "#fff",
                      color: reqFilter === k ? "#fff" : "#374151",
                      border: "1px solid " + (reqFilter === k ? "#1e40af" : "#d1d5db"),
                    }}
                  >
                    {k === "pending" ? "접수" : k === "in_progress" ? "진행중" : k === "done" ? "완료" : k === "rejected" ? "반려" : "전체"}
                  </button>
                ))}
                <button
                  onClick={() => setReqPanelOpen(false)}
                  style={{ padding: "4px 10px", fontSize: 11, background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }}
                >닫기</button>
              </div>
            </div>

            {reqList.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>요청이 없습니다.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reqList.map(r => {
                  const formLabel = FORMS.find(f => f.type === r.formType)?.label;
                  return (
                    <div key={r.id} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                          background: r.status === "done" ? "#dcfce7" : r.status === "rejected" ? "#fee2e2" : r.status === "in_progress" ? "#dbeafe" : "#fef3c7",
                          color:      r.status === "done" ? "#166534" : r.status === "rejected" ? "#991b1b" : r.status === "in_progress" ? "#1e40af" : "#854d0e",
                        }}>
                          {r.status === "done" ? "완료" : r.status === "rejected" ? "반려" : r.status === "in_progress" ? "진행중" : "접수"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{r.title}</span>
                        {formLabel && (
                          <span style={{ fontSize: 10, color: "#6b7280" }}>({formLabel})</span>
                        )}
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>
                          {new Date(r.createdAt).toLocaleString("ko-KR")}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                        요청자: {r.requestedBy}{r.branch ? ` (${r.branch})` : ""} · {r.requestedByEmail ?? "-"}
                      </div>
                      {r.description && (
                        <div style={{ fontSize: 12, color: "#374151", whiteSpace: "pre-wrap", padding: 8, background: "#f9fafb", borderRadius: 6, marginBottom: 8 }}>
                          {r.description}
                        </div>
                      )}
                      {r.resolution && (
                        <div style={{ fontSize: 11, color: "#1e40af", padding: "6px 8px", background: "#eff6ff", borderRadius: 4, marginBottom: 8 }}>
                          답변: {r.resolution}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="답변/메모 입력 후 상태 변경"
                          value={reqDraft[r.id] ?? ""}
                          onChange={(e) => setReqDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                          style={{ flex: 1, padding: "5px 8px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4 }}
                        />
                        <button onClick={() => updateRequest(r.id, { status: 'in_progress', resolution: reqDraft[r.id] ?? r.resolution })}
                          style={{ padding: "5px 10px", fontSize: 11, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer" }}>진행중</button>
                        <button onClick={() => updateRequest(r.id, { status: 'done', resolution: reqDraft[r.id] ?? r.resolution })}
                          style={{ padding: "5px 10px", fontSize: 11, background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>완료</button>
                        <button onClick={() => updateRequest(r.id, { status: 'rejected', resolution: reqDraft[r.id] ?? r.resolution })}
                          style={{ padding: "5px 10px", fontSize: 11, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, cursor: "pointer" }}>반려</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 좌측 패널: 서식 목록 ── */}
      <div style={{ width: 260, borderRight: "1px solid #e5e7eb", padding: 16, overflowY: "auto", background: "#fafafa", flexShrink: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: "bold", marginBottom: 14, color: "#111827" }}>서식 목록</h2>
        {FORMS.map((form) => (
          <div
            key={form.type}
            onClick={() => handleSelectForm(form.type)}
            style={{
              padding: 10, marginBottom: 8, borderRadius: 6,
              border: `1px solid ${selectedForm === form.type ? "#29ABE2" : "#e5e7eb"}`,
              backgroundColor: selectedForm === form.type ? "#e8f7fd" : "white",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: "bold", fontSize: 12, color: "#111827" }}>{form.label}</span>
              {(form as any).badge && (
                <span style={{
                  fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 600,
                  backgroundColor: (form as any).badge === "진폐 전용" ? "#fef3c7" : (form as any).badge === "유족 전용" ? "#fce7f3" : "#e0f7fa",
                  color: (form as any).badge === "진폐 전용" ? "#92400e" : (form as any).badge === "유족 전용" ? "#9d174d" : "#006064",
                }}>
                  {(form as any).badge}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{form.pages}페이지</div>
            <button
              onClick={(e) => { e.stopPropagation(); handleBlankPrint(form.type, form.label); }}
              style={{ marginTop: 6, padding: "3px 8px", fontSize: 11, backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", color: "#374151" }}
            >
              🖨️ 공란 인쇄
            </button>
          </div>
        ))}
      </div>

      {/* ── 우측 패널: 에디터 ── */}
      <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: "bold", margin: 0, color: "#111827" }}>
            좌표 에디터{selectedForm ? ` — ${currentFormMeta?.label}` : ""}
          </h2>
          {selectedForm && (
            <button onClick={handleLoadCoords} style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", background: "white" }}>
              좌표 불러오기
            </button>
          )}
        </div>

        {!selectedForm ? (
          <div style={{ color: "#9ca3af", fontSize: 13, paddingTop: 60, textAlign: "center" }}>
            좌측에서 서식을 선택하세요.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flex: 1, overflow: "hidden" }}>

            {/* ── PDF 미리보기 컨테이너 ── */}
            <div
              ref={containerRef}
              style={{
                position: "relative",
                flex: 1,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                backgroundColor: "#666",
                overflow: "auto",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                outline: "none",
              }}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onClick={handleImageClick}
            >
              {previewType === "png" ? (
                <>
                  <img
                    ref={imgRef}
                    src={previewUrl}
                    alt="서식 미리보기"
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      cursor: selectedField ? "crosshair" : "default",
                      userSelect: "none",
                    }}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
                      setPreviewLoading(false);
                    }}
                    onLoadStart={() => setPreviewLoading(true)}
                    onError={() => setPreviewType("pdf")}
                    draggable={false}
                  />

                  {/* 마커 오버레이 */}
                  {selectedField && imgSize && imgRef.current && containerRef.current && (() => {
                    const containerRect = containerRef.current!.getBoundingClientRect();
                    const imgRect = imgRef.current.getBoundingClientRect();
                    const relLeft = imgRect.left - containerRect.left + containerRef.current!.scrollLeft;
                    const relTop  = imgRect.top  - containerRect.top  + containerRef.current!.scrollTop;
                    const scaleX = imgRect.width / imgSize.w;
                    const scaleY = imgRect.height / imgSize.h;
                    const pxPerPtX = imgSize.w / PDF_W;
                    const pxPerPtY = imgSize.h / PDF_H;
                    const markerX = selectedField.x * pxPerPtX * scaleX;
                    const markerY = (PDF_H - selectedField.y) * pxPerPtY * scaleY;

                    return (
                      <div
                        style={{
                          position: "absolute",
                          left: relLeft,
                          top: relTop,
                          width: imgRect.width,
                          height: imgRect.height,
                          pointerEvents: "none",
                        }}
                      >
                        {/* 십자선 */}
                        <div style={{ position: "absolute", left: markerX - 10, top: markerY - 10, width: 20, height: 20, pointerEvents: "none" }}>
                          <div style={{ position: "absolute", left: 0, top: 9, width: 20, height: 2, backgroundColor: "#FF0000", opacity: 0.9 }} />
                          <div style={{ position: "absolute", left: 9, top: 0, width: 2, height: 20, backgroundColor: "#FF0000", opacity: 0.9 }} />
                        </div>
                        {/* 라벨 */}
                        <div style={{
                          position: "absolute",
                          left: markerX + 12,
                          top: markerY - 18,
                          backgroundColor: "rgba(220,38,38,0.9)",
                          color: "white",
                          fontSize: 10,
                          padding: "1px 5px",
                          borderRadius: 3,
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                        }}>
                          {selectedField.label} ({selectedField.x}, {selectedField.y})
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                // fallback: pdftoppm 없는 환경
                <iframe
                  key={`${selectedForm}-${previewPage}`}
                  src={`/api/forms/blank?type=${selectedForm}`}
                  style={{ flex: 1, border: "none", width: "100%", height: "100%", minHeight: 600 }}
                  title="서식 미리보기"
                />
              )}

              {/* 로딩 오버레이 */}
              {previewLoading && previewType === "png" && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.7)",
                  fontSize: 14, color: "#666",
                }}>
                  로딩 중...
                </div>
              )}

              {/* 페이지 네비게이션 */}
              {(currentFormMeta?.pages ?? 1) > 1 && (
                <div style={{
                  position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
                  display: "flex", gap: 8, alignItems: "center",
                  background: "rgba(255,255,255,0.92)", padding: "4px 14px", borderRadius: 20, border: "1px solid #e5e7eb",
                }}>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewPage(p => Math.max(1, p - 1)); }} disabled={previewPage <= 1} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: previewPage <= 1 ? "#d1d5db" : "#374151" }}>◀</button>
                  <span style={{ fontSize: 12, color: "#374151" }}>{previewPage} / {currentFormMeta?.pages ?? 1}</span>
                  <button onClick={(e) => { e.stopPropagation(); setPreviewPage(p => Math.min(currentFormMeta?.pages ?? 1, p + 1)); }} disabled={previewPage >= (currentFormMeta?.pages ?? 1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: previewPage >= (currentFormMeta?.pages ?? 1) ? "#d1d5db" : "#374151" }}>▶</button>
                </div>
              )}

              {/* 힌트 */}
              {selectedField && previewType === "png" && (
                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 10, pointerEvents: "none", whiteSpace: "nowrap" }}>
                  클릭으로 마커 이동 · 방향키(Shift: 5pt)로 미세 조정
                </div>
              )}
            </div>

            {/* ── 우측 좌표 패널 ── */}
            <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flexShrink: 0 }}>

              {/* 필드 선택 */}
              <div>
                <label style={{ fontSize: 11, fontWeight: "bold", display: "block", marginBottom: 4, color: "#374151" }}>필드 선택</label>
                <select
                  value={selectedField?.key ?? ""}
                  onChange={(e) => handleSelectField(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }}
                >
                  <option value="">-- 필드 선택 --</option>
                  {(coordFields[selectedForm] ?? []).map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* 선택 필드 좌표 */}
              {selectedField && (
                <div style={{ padding: 10, border: "1px solid #29ABE2", borderRadius: 6, fontSize: 12, backgroundColor: "#e8f7fd" }}>
                  <div style={{ fontWeight: "bold", marginBottom: 6, color: "#29ABE2" }}>
                    📍 {selectedField.label}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 2 }}>x (pt)</label>
                      <input
                        type="number"
                        value={selectedField.x}
                        onChange={(e) => updateFieldCoord("x", Number(e.target.value))}
                        style={{ width: 70, padding: "4px 6px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, display: "block" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 2 }}>y (pt)</label>
                      <input
                        type="number"
                        value={selectedField.y}
                        onChange={(e) => updateFieldCoord("y", Number(e.target.value))}
                        style={{ width: 70, padding: "4px 6px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, display: "block" }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: "#888" }}>
                    이미지 클릭 또는 방향키(Shift: 5pt)로 이동
                  </div>
                </div>
              )}

              {/* 전체 좌표 복사 */}
              <button
                onClick={handleCopyCoords}
                style={{ padding: "7px 10px", fontSize: 12, backgroundColor: "#8DC63F", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}
              >
                📋 전체 좌표 복사
              </button>

              {/* 좌표 DB 저장 */}
              <button
                onClick={handleSaveCoordinates}
                disabled={saving}
                style={{ padding: "7px 10px", fontSize: 12, backgroundColor: "#006838", color: "white", border: "none", borderRadius: 4, cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "저장 중..." : "💾 좌표 DB 저장"}
              </button>
              {saveMsg && (
                <div style={{ fontSize: 11, textAlign: "center", color: saveMsg.startsWith("✅") ? "#006838" : "#dc2626" }}>
                  {saveMsg}
                </div>
              )}

              {/* 좌표 출력 */}
              <textarea
                value={coordOutput}
                readOnly
                rows={12}
                style={{ fontSize: 10, fontFamily: "monospace", resize: "vertical", padding: 8, border: "1px solid #e5e7eb", borderRadius: 4, color: "#374151", background: "#f9fafb" }}
                placeholder="필드를 선택하고 좌표를 입력하면 여기에 출력됩니다."
              />

              {/* 안내 */}
              <div style={{ fontSize: 10, color: "#9ca3af", padding: "8px 10px", background: "#f9fafb", borderRadius: 4, border: "1px solid #f3f4f6" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>사용 방법</div>
                <div>1. 서식 선택 → PNG 미리보기 표시</div>
                <div>2. 필드 선택 → 빨간 마커 표시</div>
                <div>3. 이미지 클릭 → 마커 이동</div>
                <div>4. 방향키(Shift: 5pt) 미세 조정</div>
                <div>5. 전체 좌표 복사 → PDF API에 적용</div>
                <div style={{ marginTop: 4, color: "#d97706" }}>※ 좌하단 원점, A4 = 595×841pt</div>
              </div>

              {/* 테스트 PDF 생성 패널 */}
              <div style={{ marginTop: 24, borderTop: "1px solid #ddd", paddingTop: 16 }}>
                <div style={{ fontWeight: "bold", marginBottom: 12, color: "#1A3A5C" }}>🧪 테스트 PDF 생성</div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>임의값 입력 후 PDF를 생성해 좌표를 확인하세요.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                  {(FORM_FIELDS[selectedForm] ?? []).map((f) => (
                    <div key={f.key} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{f.label}</div>
                      <input
                        type="text"
                        placeholder={f.label}
                        value={testValues[f.key] ?? ""}
                        onChange={(e) => setTestValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ width: "100%", padding: "4px 6px", fontSize: 11, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" as const }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleTestGenerate}
                  disabled={testLoading}
                  style={{ marginTop: 8, width: "100%", padding: "8px", backgroundColor: "#29ABE2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: "bold" }}
                >
                  {testLoading ? "생성 중..." : "📄 테스트 PDF 다운로드"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
