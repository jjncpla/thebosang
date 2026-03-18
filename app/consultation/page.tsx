"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TF_BY_BRANCH } from "@/lib/constants/tf";

// ─── Types ───────────────────────────────────────────────────────────────────

type Manager = { id: string; name: string };
type Consultation = {
  id: string;
  name: string;
  phone: string;
  ssn: string | null;
  address: string | null;
  caseTypes: string[];
  manager: Manager | null;
  managerId: string | null;
  routeMain: string | null;
  routeSub: string | null;
  routeDetail: string | null;
  visitDate: string | null;
  status: string;
  memo: string | null;
  progressNote: string | null;
  reminderDate: string | null;
  linkedCaseId: string | null;
  branchName: string | null;
  tfName: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = { total: number; contract: number; waiting: number; closed: number };

const CASE_TYPE_OPTIONS = ["소음성난청", "COPD", "근골격계", "업무상사고", "직업성암", "뇌심혈관계", "유족", "기타"];
const STATUS_OPTIONS = ["진행중", "약정", "종결", "연락대기"];
const ROUTE_MAIN_OPTIONS = ["간판", "소개", "홍보", "기타"];

const ROUTE_SUB_MAP: Record<string, string[]> = {
  간판: ["워킹"],
  소개: ["기진행자", "지인", "기타"],
  홍보: ["온라인", "오프라인"],
  기타: [],
};

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  약정: { bg: "#E8F5D0", color: "#5A8A1F", border: "1px solid #A2D158" },
  종결: { bg: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1" },
  연락대기: { bg: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" },
  진행중: { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569" };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      {status}
    </span>
  );
}

function CaseTypeBadge({ type }: { type: string }) {
  return (
    <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#eff6ff", color: "#29ABE2", border: "1px solid #bfdbfe", marginRight: 3 }}>
      {type}
    </span>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toInputDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type FormData = {
  name: string;
  phone: string;
  ssn: string;
  address: string;
  caseTypes: string[];
  managerId: string;
  routeMain: string;
  routeSub: string;
  routeDetail: string;
  visitDate: string;
  status: string;
  memo: string;
  progressNote: string;
  reminderDate: string;
};

const emptyForm: FormData = {
  name: "",
  phone: "",
  ssn: "",
  address: "",
  caseTypes: [],
  managerId: "",
  routeMain: "",
  routeSub: "",
  routeDetail: "",
  visitDate: "",
  status: "진행중",
  memo: "",
  progressNote: "",
  reminderDate: "",
};

function ConsultationModal({
  initial,
  managers,
  onClose,
  onSave,
}: {
  initial: Consultation | null;
  managers: Manager[];
  onClose: () => void;
  onSave: (data: FormData, id?: string) => Promise<void>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(() => {
    if (!initial) return emptyForm;
    return {
      name: initial.name,
      phone: initial.phone,
      ssn: initial.ssn ?? "",
      address: initial.address ?? "",
      caseTypes: initial.caseTypes,
      managerId: initial.managerId ?? "",
      routeMain: initial.routeMain ?? "",
      routeSub: initial.routeSub ?? "",
      routeDetail: initial.routeDetail ?? "",
      visitDate: toInputDate(initial.visitDate),
      status: initial.status,
      memo: initial.memo ?? "",
      progressNote: initial.progressNote ?? "",
      reminderDate: toInputDate(initial.reminderDate),
    };
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormData, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCaseType = (t: string) => {
    set("caseTypes", form.caseTypes.includes(t) ? form.caseTypes.filter((x) => x !== t) : [...form.caseTypes, t]);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.phone) { alert("성명과 연락처는 필수입니다."); return; }
    setSaving(true);
    try {
      await onSave(form, initial?.id);
      onClose();
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "#374151", background: "#f9fafb", outline: "none", width: "100%" };
  const labelStyle = { fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 };

  const subOptions = ROUTE_SUB_MAP[form.routeMain] ?? [];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "white", borderRadius: 12, padding: 28, zIndex: 1000,
        maxWidth: 640, width: "95%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>{initial ? "상담 수정" : "상담 등록"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <div>
            <label style={labelStyle}>성명 <span style={{ color: "#dc2626" }}>*</span></label>
            <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="홍길동" />
          </div>
          <div>
            <label style={labelStyle}>연락처 <span style={{ color: "#dc2626" }}>*</span></label>
            <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" />
          </div>
          <div>
            <label style={labelStyle}>주민번호</label>
            <input style={inputStyle} value={form.ssn} onChange={(e) => set("ssn", e.target.value)} placeholder="선택 입력" />
          </div>
          <div>
            <label style={labelStyle}>주소</label>
            <input style={inputStyle} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="주소" />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>사건종류 (다중 선택)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CASE_TYPE_OPTIONS.map((t) => {
              const active = form.caseTypes.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleCaseType(t)}
                  style={{
                    padding: "4px 12px", fontSize: 12, borderRadius: 999, cursor: "pointer",
                    border: active ? "1px solid #29ABE2" : "1px solid #e5e7eb",
                    background: active ? "#eff6ff" : "#f9fafb",
                    color: active ? "#29ABE2" : "#374151",
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px", marginTop: 14 }}>
          <div>
            <label style={labelStyle}>담당자</label>
            <select style={{ ...inputStyle }} value={form.managerId} onChange={(e) => set("managerId", e.target.value)}>
              <option value="">선택 안 함</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>방문(연락)일자</label>
            <input type="date" style={inputStyle} value={form.visitDate} onChange={(e) => set("visitDate", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>상담경로 대분류</label>
            <select style={{ ...inputStyle }} value={form.routeMain} onChange={(e) => { set("routeMain", e.target.value); set("routeSub", ""); }}>
              <option value="">선택</option>
              {ROUTE_MAIN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>상담경로 중분류</label>
            {subOptions.length > 0 ? (
              <select style={{ ...inputStyle }} value={form.routeSub} onChange={(e) => set("routeSub", e.target.value)}>
                <option value="">선택</option>
                {subOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input style={inputStyle} value={form.routeSub} onChange={(e) => set("routeSub", e.target.value)} placeholder="직접 입력" />
            )}
          </div>
          <div>
            <label style={labelStyle}>상담경로 소분류</label>
            <input style={inputStyle} value={form.routeDetail} onChange={(e) => set("routeDetail", e.target.value)} placeholder="소분류" />
          </div>
          <div>
            <label style={labelStyle}>사건수임</label>
            <select style={{ ...inputStyle }} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>알림 지정일 (비워두면 3주 자동)</label>
            <input type="date" style={inputStyle} value={form.reminderDate} onChange={(e) => set("reminderDate", e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>비고</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.memo} onChange={(e) => set("memo", e.target.value)} placeholder="비고 메모" />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>기준 진행경과</label>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.progressNote} onChange={(e) => set("progressNote", e.target.value)} placeholder="진행경과 메모" />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20, alignItems: "center" }}>
          {initial && form.status === "약정" && (
            <button
              onClick={() => router.push(`/cases/new?from=consultation&id=${initial.id}`)}
              style={{ border: "1px solid #15803d", borderRadius: 6, padding: "8px 14px", fontSize: 13, color: "#15803d", background: "#f0fdf4", cursor: "pointer", fontWeight: 600 }}
            >
              재해자 등록하기
            </button>
          )}
          <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </>
  );
}

// 상담관리는 더보상TF만 표시 (이산TF 제외)
const THEBOSANG_TF_LIST: string[] = Object.entries(TF_BY_BRANCH)
  .flatMap(([, tfs]) => tfs)
  .filter((tf) => !tf.startsWith("이산"));

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConsultationPage() {
  const [items, setItems] = useState<Consultation[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, contract: 0, waiting: 0, closed: 0 });
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [filterStatus, setFilterStatus] = useState("");
  const [filterCaseType, setFilterCaseType] = useState("");
  const [filterManagerId, setFilterManagerId] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Consultation | null>(null);

  const fetchManagers = async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setManagers(Array.isArray(data) ? data : data.users ?? []);
    }
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterStatus) p.set("status", filterStatus);
      if (filterCaseType) p.set("caseType", filterCaseType);
      if (filterManagerId) p.set("managerId", filterManagerId);
      if (filterTf) p.set("tfName", filterTf);
      if (filterRoute) p.set("routeMain", filterRoute);
      if (filterDateFrom) p.set("dateFrom", filterDateFrom);
      if (filterDateTo) p.set("dateTo", filterDateTo);
      if (search) p.set("search", search);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));

      const res = await fetch(`/api/consultation?${p}`);
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { total: 0, contract: 0, waiting: 0, closed: 0 });
    } catch {
      alert("데이터 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCaseType, filterManagerId, filterTf, filterRoute, filterDateFrom, filterDateTo, search, page]);

  useEffect(() => { fetchManagers(); }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSave = async (form: FormData, id?: string) => {
    const method = id ? "PATCH" : "POST";
    const url = id ? `/api/consultation/${id}` : "/api/consultation";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error("저장 실패");
    await fetchItems();
  };

  const totalPages = Math.ceil(total / pageSize);

  const statCards = [
    { label: "총 상담 건수", value: stats.total, color: "#29ABE2" },
    { label: "약정 건수", value: stats.contract, color: "#16a34a" },
    { label: "연락대기 건수", value: stats.waiting, color: "#ea580c" },
    { label: "종결 건수", value: stats.closed, color: "#6b7280" },
  ];

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      {modalOpen && (
        <ConsultationModal
          initial={editTarget}
          managers={managers}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSave={handleSave}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>CONSULTATION MANAGEMENT</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: 0 }}>상담 관리</h1>
        </div>
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + 상담 등록
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>사건수임 상태</label>
            <div style={{ display: "flex", gap: 4 }}>
              {["", ...STATUS_OPTIONS].map((s) => (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setPage(1); }}
                  style={{
                    padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                    border: filterStatus === s ? "1px solid #29ABE2" : "1px solid #e5e7eb",
                    background: filterStatus === s ? "#eff6ff" : "#f9fafb",
                    color: filterStatus === s ? "#29ABE2" : "#374151",
                    fontWeight: filterStatus === s ? 700 : 400,
                  }}
                >
                  {s || "전체"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>사건종류</label>
            <select
              value={filterCaseType}
              onChange={(e) => { setFilterCaseType(e.target.value); setPage(1); }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}
            >
              <option value="">전체</option>
              {CASE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>담당자</label>
            <select
              value={filterManagerId}
              onChange={(e) => { setFilterManagerId(e.target.value); setPage(1); }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}
            >
              <option value="">전체</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>TF</label>
            <select
              value={filterTf}
              onChange={(e) => { setFilterTf(e.target.value); setPage(1); }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}
            >
              <option value="">전체</option>
              {THEBOSANG_TF_LIST.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>상담경로</label>
            <select
              value={filterRoute}
              onChange={(e) => { setFilterRoute(e.target.value); setPage(1); }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb" }}
            >
              <option value="">전체</option>
              {ROUTE_MAIN_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>방문일자</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#374151", background: "#f9fafb" }} />
              <span style={{ color: "#9ca3af", fontSize: 12 }}>~</span>
              <input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#374151", background: "#f9fafb" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>검색 (성명/연락처)</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="검색..."
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#374151", background: "#f9fafb", width: 160 }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
              {["성명", "연락처", "사건종류", "담당자", "상담경로", "방문일자", "사건수임", "비고"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} style={{ padding: "14px" }}>
                    <div style={{ height: 12, background: "#f1f5f9", borderRadius: 4, width: 50 + (j % 3) * 20 }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  등록된 상담이 없습니다
                </td>
              </tr>
            )}
            {!loading && items.map((item) => (
              <tr
                key={item.id}
                onClick={() => { setEditTarget(item); setModalOpen(true); }}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
              >
                <td style={{ padding: "12px 14px", fontWeight: 600, color: "#111827" }}>{item.name}</td>
                <td style={{ padding: "12px 14px", color: "#374151", fontFamily: "monospace" }}>{item.phone}</td>
                <td style={{ padding: "12px 14px" }}>
                  {item.caseTypes.length > 0 ? item.caseTypes.map((t) => <CaseTypeBadge key={t} type={t} />) : <span style={{ color: "#9ca3af" }}>-</span>}
                </td>
                <td style={{ padding: "12px 14px", color: "#374151" }}>{item.manager?.name ?? "-"}</td>
                <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 12 }}>
                  {[item.routeMain, item.routeSub, item.routeDetail].filter(Boolean).join(" / ") || "-"}
                </td>
                <td style={{ padding: "12px 14px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{formatDate(item.visitDate)}</td>
                <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} /></td>
                <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.memo || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "white", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}
          >
            이전
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                border: p === page ? "1px solid #29ABE2" : "1px solid #e5e7eb",
                borderRadius: 6, padding: "6px 12px", fontSize: 13,
                color: p === page ? "#29ABE2" : "#374151",
                background: p === page ? "#eff6ff" : "white",
                cursor: "pointer", fontWeight: p === page ? 700 : 400,
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "white", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
