"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FORM_FIELDS, type FieldEntry } from "@/lib/formFields";

type FormMeta = { type: string; label: string; pages: number; badge?: string };

const FORMS: FormMeta[] = [
  { type: "DISABILITY_CLAIM",       label: "장해급여 청구서",                    pages: 1 },
  { type: "NOISE_WORK_CONFIRM",     label: "소음작업 종사 사실 확인서",            pages: 1 },
  { type: "AGENT_APPOINTMENT",      label: "대리인 선임신고서",                    pages: 1 },
  { type: "POWER_OF_ATTORNEY",      label: "위임장",                               pages: 1 },
  { type: "SPECIAL_CLINIC",         label: "특진의료기관 선택 확인서 (특진)",       pages: 1 },
  { type: "EXPERT_CLINIC",          label: "특진의료기관 선택 확인서 (전문조사)",   pages: 1 },
  { type: "WORK_HISTORY",           label: "직업력 조사 표준문답서",                pages: 3 },
  { type: "INFO_DISCLOSURE",        label: "정보공개 청구서",                       pages: 1 },
  { type: "LABOR_ATTORNEY_RECORD",  label: "공인노무사 업무처리부",                  pages: 1 },
  { type: "THIRD_PARTY_INFO",       label: "본인정보 제3자 제공요구서",              pages: 1, badge: "공통" },
  { type: "MEDICAL_BENEFIT",        label: "요양급여신청서",                         pages: 1, badge: "공통" },
  { type: "SICK_LEAVE_BENEFIT",     label: "휴업급여신청서",                         pages: 1, badge: "공통" },
  { type: "INFO_DISCLOSURE_PROXY",  label: "정보공개청구 위임장",                    pages: 1, badge: "공통" },
  { type: "PENSION_CHOICE",         label: "연금·일시금 선택확인서",                 pages: 1, badge: "공통" },
  { type: "BEREAVED_CLAIM",         label: "유족급여·장례비청구서",                  pages: 1, badge: "유족 전용" },
  { type: "EX_WORKER_HEALTH_EXAM",  label: "이직자 건강진단 신청서",                 pages: 1, badge: "진폐 전용" },
  { type: "DUST_WORK_CONFIRM",      label: "분진작업종사사실확인서",                 pages: 1, badge: "진폐 전용" },
];

type PatientHit = {
  id: string;
  name: string;
  ssn: string | null;
  phone: string | null;
  address: string | null;
};

export default function PracticalFormsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const [selectedForm, setSelectedForm]   = useState<string | null>(null);
  const [previewPage, setPreviewPage]     = useState(1);
  const [values, setValues]               = useState<Record<string, string>>({});
  const [generating, setGenerating]       = useState(false);
  const [previewType, setPreviewType]     = useState<"png" | "pdf">("png");

  // 검색 패널
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchHits,  setSearchHits]    = useState<PatientHit[]>([]);
  const [searchOpen,  setSearchOpen]    = useState(false);
  const [searching,   setSearching]     = useState(false);

  // 개발자 요청 모달
  const [reqOpen, setReqOpen] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqMsg, setReqMsg] = useState("");

  // 내가 보낸 요청 목록
  const [myRequests, setMyRequests] = useState<any[]>([]);

  const currentMeta = useMemo(
    () => FORMS.find(f => f.type === selectedForm) ?? null,
    [selectedForm]
  );

  const fields = useMemo<FieldEntry[]>(
    () => (selectedForm ? (FORM_FIELDS[selectedForm] ?? []) : []),
    [selectedForm]
  );

  const handleSelectForm = (type: string) => {
    setSelectedForm(type);
    setPreviewPage(1);
    setValues({});
    setPreviewType("png");
  };

  const setVal = (key: string, v: string) => setValues(prev => ({ ...prev, [key]: v }));

  const buildToday = useCallback(() => {
    const t = new Date();
    const yyyy = String(t.getFullYear());
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    setValues(prev => ({
      ...prev,
      todayYear: yyyy,
      todayMonth: mm,
      todayDay: dd,
      submitYear: yyyy,
      submitMonth: mm,
      submitDay: dd,
    }));
  }, []);

  // 검색 (debounce)
  useEffect(() => {
    if (searchQuery.trim().length < 1) { setSearchHits([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchHits(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {}
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const splitJumin = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    const c = raw.replace(/[-\s]/g, "");
    return c.split("");
  };

  const applyPatient = (p: PatientHit) => {
    const next: Record<string, string> = { ...values };
    next.name = p.name;
    next.ptName = p.name;
    next.claimantName = p.name;
    next.deceasedName = p.name;
    if (p.phone) {
      next.phone = p.phone;
      next.ptPhone = p.phone;
      next.claimantPhone = p.phone;
    }
    if (p.address) {
      next.address = p.address;
      next.ptAddress = p.address;
    }
    if (p.ssn) {
      next.ssn = p.ssn;
      next.ptSsn = p.ssn;
      // 주민번호 자릿값 매핑 (jumin1~13, ssn1~13)
      const ds = splitJumin(p.ssn);
      ds.forEach((d, i) => {
        next[`jumin${i + 1}`] = d;
        next[`ssn${i + 1}`] = d;
      });
    }
    setValues(next);
    setSearchOpen(false);
    setSearchQuery("");
  };

  // 인쇄: PDF를 새 창에 띄우고 print()
  const handlePrint = async () => {
    if (!selectedForm) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formKey: selectedForm, fields: values, mode: "inline" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert("오류: " + (d.error ?? res.statusText));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        w.onload = () => {
          try { w.focus(); w.print(); } catch {}
        };
      }
      // 30초 뒤 url 해제
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } finally {
      setGenerating(false);
    }
  };

  // PDF 다운로드
  const handleDownload = async () => {
    if (!selectedForm) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formKey: selectedForm, fields: values }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert("오류: " + (d.error ?? res.statusText));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const label = currentMeta?.label ?? selectedForm;
      a.href = url; a.download = `${label}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  // 공란 PDF
  const handleBlank = async () => {
    if (!selectedForm) return;
    const res = await fetch(`/api/forms/blank?type=${selectedForm}`);
    if (!res.ok) { alert("공란 PDF 로드 실패"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const label = currentMeta?.label ?? selectedForm;
    a.href = url; a.download = `[공란]${label}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  // 내 요청 로드
  const loadMyRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/forms/requests");
      if (res.ok) {
        const d = await res.json();
        setMyRequests(d.items ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => { if (status === "authenticated") loadMyRequests(); }, [status, loadMyRequests]);

  const submitRequest = async () => {
    if (!reqTitle.trim()) { setReqMsg("제목을 입력해주세요."); return; }
    setReqSubmitting(true);
    setReqMsg("");
    try {
      const res = await fetch("/api/forms/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reqTitle,
          description: reqDesc,
          formType: selectedForm ?? null,
        }),
      });
      if (res.ok) {
        setReqMsg("✅ 전송되었습니다. 개발팀이 확인 후 반영합니다.");
        setReqTitle(""); setReqDesc("");
        loadMyRequests();
        setTimeout(() => { setReqOpen(false); setReqMsg(""); }, 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        setReqMsg("❌ " + (d.error ?? "전송 실패"));
      }
    } finally {
      setReqSubmitting(false);
    }
  };

  if (status === "loading") {
    return <div style={{ padding: 40, color: "#9ca3af" }}>불러오는 중…</div>;
  }

  const previewUrl = selectedForm
    ? `/api/forms/preview?type=${selectedForm}&page=${previewPage}`
    : "";

  return (
    <div style={{ padding: 16, fontFamily: "'Pretendard','Noto Sans KR',sans-serif", maxWidth: 1320, margin: "0 auto" }}>

      {/* ── 상단 헤더 ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>📝 서식 작성</h1>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            서식을 선택하고 필요한 항목을 입력해 PDF 출력·인쇄하세요. 필드 좌표는 관리자 페이지에서 등록한 값을 사용합니다.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setReqOpen(true)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 700,
              background: "#fff7ed", color: "#c2410c",
              border: "1px solid #fdba74", borderRadius: 6, cursor: "pointer",
            }}
            title="추가가 필요한 서식·필드 등을 개발팀에 전달"
          >
            🛠 개발자에게 생성 요청
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, height: "calc(100vh - 160px)" }}>

        {/* ── 좌측: 서식 목록 ── */}
        <aside style={{
          width: 260, background: "#fafafa", border: "1px solid #e5e7eb",
          borderRadius: 8, padding: 12, overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>서식 목록</div>
          {FORMS.map(f => (
            <div
              key={f.type}
              onClick={() => handleSelectForm(f.type)}
              style={{
                padding: 8, marginBottom: 6, borderRadius: 6,
                border: `1px solid ${selectedForm === f.type ? "#1e40af" : "#e5e7eb"}`,
                background: selectedForm === f.type ? "#eff6ff" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{f.label}</span>
                {f.badge && (
                  <span style={{
                    fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 600,
                    background: f.badge === "진폐 전용" ? "#fef3c7" : f.badge === "유족 전용" ? "#fce7f3" : "#e0f7fa",
                    color: f.badge === "진폐 전용" ? "#92400e" : f.badge === "유족 전용" ? "#9d174d" : "#006064",
                  }}>{f.badge}</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{f.pages}페이지</div>
            </div>
          ))}
        </aside>

        {/* ── 중앙: 미리보기 ── */}
        <section style={{
          flex: 1, background: "#666", border: "1px solid #d1d5db",
          borderRadius: 8, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start",
          position: "relative", minWidth: 320,
        }}>
          {!selectedForm ? (
            <div style={{ alignSelf: "center", textAlign: "center", color: "#fff", padding: 40 }}>
              좌측에서 서식을 선택하세요.
            </div>
          ) : previewType === "png" ? (
            <img
              src={previewUrl}
              alt="서식 미리보기"
              style={{ display: "block", maxWidth: "100%", userSelect: "none" }}
              onError={() => setPreviewType("pdf")}
              draggable={false}
            />
          ) : (
            <iframe
              src={`/api/forms/blank?type=${selectedForm}`}
              style={{ width: "100%", height: "100%", border: "none", minHeight: 600, background: "#fff" }}
              title="서식 미리보기"
            />
          )}

          {/* 페이지 네비게이션 */}
          {selectedForm && (currentMeta?.pages ?? 1) > 1 && (
            <div style={{
              position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
              display: "flex", gap: 8, alignItems: "center",
              background: "rgba(255,255,255,0.95)", padding: "4px 14px", borderRadius: 20, border: "1px solid #e5e7eb",
            }}>
              <button onClick={() => setPreviewPage(p => Math.max(1, p - 1))} disabled={previewPage <= 1}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: previewPage <= 1 ? "#d1d5db" : "#374151" }}>◀</button>
              <span style={{ fontSize: 12 }}>{previewPage} / {currentMeta?.pages ?? 1}</span>
              <button onClick={() => setPreviewPage(p => Math.min(currentMeta?.pages ?? 1, p + 1))} disabled={previewPage >= (currentMeta?.pages ?? 1)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: previewPage >= (currentMeta?.pages ?? 1) ? "#d1d5db" : "#374151" }}>▶</button>
            </div>
          )}
        </section>

        {/* ── 우측: 입력/액션 패널 ── */}
        <aside style={{
          width: 320, background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 8, padding: 12, overflowY: "auto", flexShrink: 0,
        }}>
          {!selectedForm ? (
            <div style={{ color: "#9ca3af", fontSize: 13, padding: "40px 0", textAlign: "center" }}>
              서식을 선택하면 입력 항목이 표시됩니다.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                {currentMeta?.label}
              </div>

              {/* 검색 패널 */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                  📂 저장된 재해자 검색 (성명·주민번호·연락처)
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="검색어 입력 (DB 입력분 한정)"
                  style={{
                    width: "100%", padding: "6px 10px", fontSize: 12,
                    border: "1px solid #d1d5db", borderRadius: 4, boxSizing: "border-box",
                  }}
                />
                {searchOpen && searchQuery.trim().length >= 1 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
                    boxShadow: "0 8px 16px rgba(0,0,0,.08)", zIndex: 20,
                    maxHeight: 240, overflowY: "auto", marginTop: 2,
                  }}>
                    {searching ? (
                      <div style={{ padding: 10, fontSize: 11, color: "#9ca3af" }}>검색 중…</div>
                    ) : searchHits.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 11, color: "#9ca3af" }}>일치하는 데이터가 없습니다.</div>
                    ) : searchHits.map(p => (
                      <button
                        key={p.id}
                        onClick={() => applyPatient(p)}
                        style={{
                          display: "block", width: "100%", padding: "8px 10px", textAlign: "left",
                          border: "none", borderBottom: "1px solid #f3f4f6", background: "none", cursor: "pointer",
                          fontSize: 12, color: "#111827",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {p.name} <span style={{ color: "#9ca3af", fontWeight: 400 }}>{p.ssn ? p.ssn.replace(/(\d{6})-?(\d{7})/, "$1-*******") : ""}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>{p.phone ?? "-"}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button
                  onClick={buildToday}
                  style={{
                    flex: 1, padding: "6px", fontSize: 11, background: "#f3f4f6",
                    border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#374151",
                  }}
                >📅 오늘 날짜 채우기</button>
                <button
                  onClick={() => setValues({})}
                  style={{
                    flex: 1, padding: "6px", fontSize: 11, background: "#fff",
                    border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#dc2626",
                  }}
                >🗑 입력값 초기화</button>
              </div>

              {/* 입력 필드 */}
              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, maxHeight: "calc(100vh - 480px)", overflowY: "auto" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 6 }}>입력 항목</div>
                {fields.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>등록된 필드가 없습니다.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {fields.map(f => {
                      const isPositioned = !!(f.x && f.y);
                      return (
                        <div key={f.key}>
                          <div style={{
                            fontSize: 10, color: isPositioned ? "#6b7280" : "#d1d5db",
                            marginBottom: 2, display: "flex", justifyContent: "space-between",
                          }}>
                            <span>{f.label}</span>
                            {!isPositioned && <span style={{ color: "#d1d5db" }}>좌표 미설정</span>}
                          </div>
                          <input
                            type="text"
                            placeholder={f.label}
                            value={values[f.key] ?? ""}
                            onChange={(e) => setVal(f.key, e.target.value)}
                            disabled={!isPositioned}
                            style={{
                              width: "100%", padding: "5px 8px", fontSize: 12,
                              border: "1px solid " + (isPositioned ? "#d1d5db" : "#f3f4f6"),
                              borderRadius: 4, boxSizing: "border-box",
                              background: isPositioned ? "#fff" : "#fafafa",
                              color: isPositioned ? "#111827" : "#9ca3af",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  onClick={handlePrint}
                  disabled={generating}
                  style={{
                    padding: "10px", fontSize: 13, fontWeight: 700,
                    background: "#1e40af", color: "#fff", border: "none", borderRadius: 6,
                    cursor: generating ? "not-allowed" : "pointer", opacity: generating ? 0.6 : 1,
                  }}
                >🖨️ 인쇄</button>
                <button
                  onClick={handleDownload}
                  disabled={generating}
                  style={{
                    padding: "10px", fontSize: 13, fontWeight: 700,
                    background: "#059669", color: "#fff", border: "none", borderRadius: 6,
                    cursor: generating ? "not-allowed" : "pointer", opacity: generating ? 0.6 : 1,
                  }}
                >💾 PDF 저장</button>
                <button
                  onClick={handleBlank}
                  style={{
                    padding: "8px", fontSize: 12,
                    background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer",
                  }}
                >📄 공란 PDF 다운로드</button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── 내 요청 목록 ── */}
      <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>내가 보낸 개발 요청</div>
          <button
            onClick={loadMyRequests}
            style={{
              padding: "4px 10px", fontSize: 11, background: "#f3f4f6",
              border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#374151",
            }}
          >새로고침</button>
        </div>
        {myRequests.length === 0 ? (
          <div style={{ fontSize: 12, color: "#9ca3af", padding: "12px 0", textAlign: "center" }}>아직 보낸 요청이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {myRequests.slice(0, 10).map(r => (
              <div key={r.id} style={{ padding: "8px 10px", border: "1px solid #f3f4f6", borderRadius: 6, fontSize: 12, color: "#374151" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                    background: r.status === "done" ? "#dcfce7" : r.status === "rejected" ? "#fee2e2" : r.status === "in_progress" ? "#dbeafe" : "#fef3c7",
                    color:      r.status === "done" ? "#166534" : r.status === "rejected" ? "#991b1b" : r.status === "in_progress" ? "#1e40af" : "#854d0e",
                  }}>
                    {r.status === "done" ? "완료" : r.status === "rejected" ? "반려" : r.status === "in_progress" ? "진행중" : "접수"}
                  </span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{r.title}</span>
                  {r.formType && (
                    <span style={{ fontSize: 10, color: "#6b7280" }}>({FORMS.find(f => f.type === r.formType)?.label ?? r.formType})</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>
                    {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                {r.description && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280", whiteSpace: "pre-wrap" }}>{r.description}</div>
                )}
                {r.resolution && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#1e40af", padding: "4px 6px", background: "#eff6ff", borderRadius: 4 }}>
                    답변: {r.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 개발자 요청 모달 ── */}
      {reqOpen && (
        <div
          onClick={() => setReqOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480, background: "#fff", borderRadius: 12, padding: 20,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              🛠 개발자에게 생성 요청
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
              새 서식 추가, 필드 보정, 자동 입력 기능 등 필요한 점을 알려주세요.
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>제목 *</label>
              <input
                type="text"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="예: 산재요양신청서 추가 요청"
                style={{
                  width: "100%", padding: "8px 10px", fontSize: 13,
                  border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>상세 내용</label>
              <textarea
                rows={5}
                value={reqDesc}
                onChange={(e) => setReqDesc(e.target.value)}
                placeholder="필요한 양식 / 보정이 필요한 필드 / 사용 흐름 등을 자유롭게 적어주세요."
                style={{
                  width: "100%", padding: "8px 10px", fontSize: 12,
                  border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", resize: "vertical",
                }}
              />
            </div>

            {selectedForm && (
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>
                현재 선택된 서식 <b>{currentMeta?.label}</b>이(가) 자동 첨부됩니다.
              </div>
            )}

            {reqMsg && (
              <div style={{
                padding: "8px 10px", fontSize: 12, marginBottom: 10, borderRadius: 6,
                background: reqMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
                color:      reqMsg.startsWith("✅") ? "#166534" : "#991b1b",
              }}>{reqMsg}</div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                onClick={() => setReqOpen(false)}
                style={{
                  padding: "8px 14px", fontSize: 12, color: "#374151",
                  background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer",
                }}
              >취소</button>
              <button
                onClick={submitRequest}
                disabled={reqSubmitting}
                style={{
                  padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "#fff",
                  background: "#c2410c", border: "none", borderRadius: 6,
                  cursor: reqSubmitting ? "not-allowed" : "pointer", opacity: reqSubmitting ? 0.6 : 1,
                }}
              >{reqSubmitting ? "전송 중…" : "요청 보내기"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
