"use client";

import { useEffect, useState } from "react";
import SettlementTab from './_components/SettlementTab'

/* ─── Types ─── */
type PolicyDoc = {
  id: string; title: string; category: string; version: string | null;
  content: string | null; isLatest: boolean; createdAt: string;
};
type Evaluation = {
  id: string; userId: string; period: string; score: number | null;
  performanceScore: number | null; attendanceScore: number | null; attitudeScore: number | null;
  isPromotionTarget: boolean; promotionGrade: string | null; memo: string | null;
  createdAt: string; user: { id: string; name: string; email: string };
};
type WorkOrder = {
  id: string; title: string; content: string; dueDate: string | null;
  priority: string; isActive: boolean; createdAt: string; author: { name: string };
};
type StaffUser = { id: string; name: string; email: string };

type Tab = "POLICY" | "EVALUATION" | "WORK_ORDER" | "SETTLEMENT";

const CATEGORIES = [
  { value: "ALL", label: "전체" },
  { value: "OPERATION_RULE", label: "운영규정" },
  { value: "WORK_RULE", label: "취업규칙" },
  { value: "OTHER", label: "기타" },
];
const CATEGORY_LABELS: Record<string, string> = {
  OPERATION_RULE: "운영규정", WORK_RULE: "취업규칙", OTHER: "기타",
};

export default function BranchManagementPage() {
  const [tab, setTab] = useState<Tab>("POLICY");

  /* ─── 운영규정·취업규칙 ─── */
  const [policies, setPolicies] = useState<PolicyDoc[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ title: "", category: "OPERATION_RULE", version: "", content: "" });
  const [policySaving, setPolicySaving] = useState(false);

  /* ─── 인사평가 ─── */
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [showPromotionOnly, setShowPromotionOnly] = useState(false);
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [newEval, setNewEval] = useState({
    userId: "", period: "", score: "", performanceScore: "", attendanceScore: "", attitudeScore: "",
    isPromotionTarget: false, promotionGrade: "", memo: "",
  });
  const [evalSaving, setEvalSaving] = useState(false);

  /* ─── 업무지시 게시판 ─── */
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [newOrder, setNewOrder] = useState({ title: "", content: "", dueDate: "", priority: "NORMAL" });
  const [orderSaving, setOrderSaving] = useState(false);

  const [msg, setMsg] = useState("");

  /* ─── Fetch ─── */
  async function fetchPolicies() {
    const url = selectedCategory === "ALL" ? "/api/admin/policy" : `/api/admin/policy?category=${selectedCategory}`;
    const res = await fetch(url);
    if (res.ok) setPolicies(await res.json());
  }
  async function fetchEvaluations() {
    const url = showPromotionOnly ? "/api/admin/evaluation?promotionOnly=true" : "/api/admin/evaluation";
    const res = await fetch(url);
    if (res.ok) setEvaluations(await res.json());
  }
  async function fetchWorkOrders() {
    const res = await fetch("/api/admin/work-orders");
    if (res.ok) setWorkOrders(await res.json());
  }
  async function fetchStaff() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const users = await res.json();
      setStaffList(users.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
    }
  }

  useEffect(() => { fetchPolicies(); }, [selectedCategory]);
  useEffect(() => { fetchEvaluations(); }, [showPromotionOnly]);
  useEffect(() => { fetchWorkOrders(); }, []);
  useEffect(() => { if (showEvalForm && staffList.length === 0) fetchStaff(); }, [showEvalForm]);

  /* ─── Handlers ─── */
  async function handleAddPolicy() {
    setPolicySaving(true); setMsg("");
    const res = await fetch("/api/admin/policy", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPolicy),
    });
    if (res.ok) {
      setMsg("문서가 등록되었습니다.");
      setNewPolicy({ title: "", category: "OPERATION_RULE", version: "", content: "" });
      setShowPolicyForm(false);
      await fetchPolicies();
    } else setMsg("등록 실패");
    setPolicySaving(false);
  }

  async function handleAddEval() {
    setEvalSaving(true); setMsg("");
    const body = {
      userId: newEval.userId, period: newEval.period,
      score: newEval.score ? Number(newEval.score) : null,
      performanceScore: newEval.performanceScore ? Number(newEval.performanceScore) : null,
      attendanceScore: newEval.attendanceScore ? Number(newEval.attendanceScore) : null,
      attitudeScore: newEval.attitudeScore ? Number(newEval.attitudeScore) : null,
      isPromotionTarget: newEval.isPromotionTarget,
      promotionGrade: newEval.promotionGrade || null,
      memo: newEval.memo || null,
    };
    const res = await fetch("/api/admin/evaluation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMsg("평가가 등록되었습니다.");
      setNewEval({ userId: "", period: "", score: "", performanceScore: "", attendanceScore: "", attitudeScore: "", isPromotionTarget: false, promotionGrade: "", memo: "" });
      setShowEvalForm(false);
      await fetchEvaluations();
    } else setMsg("등록 실패");
    setEvalSaving(false);
  }

  async function handleAddOrder() {
    setOrderSaving(true); setMsg("");
    const res = await fetch("/api/admin/work-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newOrder.title, content: newOrder.content,
        dueDate: newOrder.dueDate || null, priority: newOrder.priority,
      }),
    });
    if (res.ok) {
      setMsg("업무 지시가 등록되었습니다.");
      setNewOrder({ title: "", content: "", dueDate: "", priority: "NORMAL" });
      setShowOrderForm(false);
      await fetchWorkOrders();
    } else setMsg("등록 실패");
    setOrderSaving(false);
  }

  /* ─── Render ─── */
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={s.pageTitle}>지사장 관리·운영</h1>

      {/* 탭 */}
      <div style={s.tabRow}>
        {([["POLICY", "운영규정·취업규칙"], ["EVALUATION", "인사평가"], ["WORK_ORDER", "업무 지시 게시판"], ["SETTLEMENT", "1분기 결산"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setMsg(""); }} style={{ ...s.tab, ...(tab === key ? s.tabActive : {}) }}>{label}</button>
        ))}
      </div>

      {msg && <p style={{ fontSize: 13, color: msg.includes("실패") ? "#dc2626" : "#065f46", marginBottom: 12 }}>{msg}</p>}

      {/* ── 탭1: 운영규정·취업규칙 ── */}
      {tab === "POLICY" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setSelectedCategory(c.value)}
                  style={{ ...s.filterBtn, ...(selectedCategory === c.value ? s.filterBtnActive : {}) }}>
                  {c.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPolicyForm(!showPolicyForm)} style={s.primaryBtn}>
              {showPolicyForm ? "취소" : "+ 문서 등록"}
            </button>
          </div>

          {showPolicyForm && (
            <div style={s.formBox}>
              <h3 style={s.formTitle}>새 문서 등록</h3>
              <div style={s.formGrid}>
                <div>
                  <label style={s.label}>제목</label>
                  <input style={s.inp} value={newPolicy.title} onChange={e => setNewPolicy({ ...newPolicy, title: e.target.value })} placeholder="문서 제목" />
                </div>
                <div>
                  <label style={s.label}>카테고리</label>
                  <select style={s.inp} value={newPolicy.category} onChange={e => setNewPolicy({ ...newPolicy, category: e.target.value })}>
                    <option value="OPERATION_RULE">운영규정</option>
                    <option value="WORK_RULE">취업규칙</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>버전</label>
                  <input style={s.inp} value={newPolicy.version} onChange={e => setNewPolicy({ ...newPolicy, version: e.target.value })} placeholder="예: 2026-01" />
                </div>
              </div>
              <label style={s.label}>내용</label>
              <textarea style={s.textarea} rows={6} value={newPolicy.content} onChange={e => setNewPolicy({ ...newPolicy, content: e.target.value })} placeholder="문서 내용을 입력하세요." />
              <button onClick={handleAddPolicy} disabled={policySaving || !newPolicy.title} style={{ ...s.primaryBtn, marginTop: 10 }}>
                {policySaving ? "저장 중…" : "등록"}
              </button>
            </div>
          )}

          <div style={s.section}>
            {policies.length === 0 ? (
              <p style={s.empty}>등록된 문서가 없습니다.</p>
            ) : (
              policies.map(doc => (
                <div key={doc.id} style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...s.badge, background: doc.category === "OPERATION_RULE" ? "#dbeafe" : doc.category === "WORK_RULE" ? "#dcfce7" : "#f3f4f6", color: doc.category === "OPERATION_RULE" ? "#1e40af" : doc.category === "WORK_RULE" ? "#065f46" : "#374151" }}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                      <span style={s.cardTitle}>{doc.title}</span>
                      {doc.version && <span style={s.cardVersion}>v{doc.version}</span>}
                    </div>
                    <span style={s.cardDate}>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                  {doc.content && <p style={s.cardContent}>{doc.content}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 탭2: 인사평가 ── */}
      {tab === "EVALUATION" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={showPromotionOnly} onChange={e => setShowPromotionOnly(e.target.checked)} />
              승진 대상자만 보기
            </label>
            <button onClick={() => setShowEvalForm(!showEvalForm)} style={s.primaryBtn}>
              {showEvalForm ? "취소" : "+ 평가 등록"}
            </button>
          </div>

          {showEvalForm && (
            <div style={s.formBox}>
              <h3 style={s.formTitle}>인사평가 등록</h3>
              <div style={s.formGrid}>
                <div>
                  <label style={s.label}>대상 직원</label>
                  <select style={s.inp} value={newEval.userId} onChange={e => setNewEval({ ...newEval, userId: e.target.value })}>
                    <option value="">선택</option>
                    {staffList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>평가 기간</label>
                  <input style={s.inp} value={newEval.period} onChange={e => setNewEval({ ...newEval, period: e.target.value })} placeholder="예: 2026-Q1" />
                </div>
                <div>
                  <label style={s.label}>총점 (100점)</label>
                  <input style={s.inp} type="number" value={newEval.score} onChange={e => setNewEval({ ...newEval, score: e.target.value })} placeholder="0~100" />
                </div>
                <div>
                  <label style={s.label}>업무성과 점수</label>
                  <input style={s.inp} type="number" value={newEval.performanceScore} onChange={e => setNewEval({ ...newEval, performanceScore: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>근태 점수</label>
                  <input style={s.inp} type="number" value={newEval.attendanceScore} onChange={e => setNewEval({ ...newEval, attendanceScore: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>태도 점수</label>
                  <input style={s.inp} type="number" value={newEval.attitudeScore} onChange={e => setNewEval({ ...newEval, attitudeScore: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 10 }}>
                <label style={{ fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={newEval.isPromotionTarget} onChange={e => setNewEval({ ...newEval, isPromotionTarget: e.target.checked })} />
                  승진 대상
                </label>
                <div>
                  <label style={s.label}>승진 대상 직급</label>
                  <input style={{ ...s.inp, width: 160 }} value={newEval.promotionGrade} onChange={e => setNewEval({ ...newEval, promotionGrade: e.target.value })} placeholder="예: 차장" />
                </div>
              </div>
              <label style={{ ...s.label, marginTop: 10 }}>메모</label>
              <textarea style={s.textarea} rows={3} value={newEval.memo} onChange={e => setNewEval({ ...newEval, memo: e.target.value })} placeholder="평가 메모" />
              <button onClick={handleAddEval} disabled={evalSaving || !newEval.userId || !newEval.period} style={{ ...s.primaryBtn, marginTop: 10 }}>
                {evalSaving ? "저장 중…" : "등록"}
              </button>
            </div>
          )}

          <div style={s.section}>
            {evaluations.length === 0 ? (
              <p style={s.empty}>등록된 평가가 없습니다.</p>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>직원</th>
                    <th style={s.th}>기간</th>
                    <th style={s.th}>총점</th>
                    <th style={s.th}>업무</th>
                    <th style={s.th}>근태</th>
                    <th style={s.th}>태도</th>
                    <th style={s.th}>승진대상</th>
                    <th style={s.th}>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map(ev => (
                    <tr key={ev.id}>
                      <td style={s.td}>{ev.user.name}</td>
                      <td style={s.td}>{ev.period}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: (ev.score ?? 0) >= 80 ? "#065f46" : "#111827" }}>{ev.score ?? "-"}</td>
                      <td style={s.td}>{ev.performanceScore ?? "-"}</td>
                      <td style={s.td}>{ev.attendanceScore ?? "-"}</td>
                      <td style={s.td}>{ev.attitudeScore ?? "-"}</td>
                      <td style={s.td}>
                        {ev.isPromotionTarget ? (
                          <span style={{ color: "#065f46", fontWeight: 700 }}>대상 {ev.promotionGrade ? `(${ev.promotionGrade})` : ""}</span>
                        ) : "-"}
                      </td>
                      <td style={{ ...s.td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.memo || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── 탭3: 업무 지시 게시판 ── */}
      {tab === "WORK_ORDER" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => setShowOrderForm(!showOrderForm)} style={s.primaryBtn}>
              {showOrderForm ? "취소" : "+ 업무 지시 등록"}
            </button>
          </div>

          {showOrderForm && (
            <div style={s.formBox}>
              <h3 style={s.formTitle}>업무 지시 등록</h3>
              <div style={s.formGrid}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={s.label}>제목</label>
                  <input style={s.inp} value={newOrder.title} onChange={e => setNewOrder({ ...newOrder, title: e.target.value })} placeholder="업무 지시 제목" />
                </div>
                <div>
                  <label style={s.label}>기한</label>
                  <input style={s.inp} type="date" value={newOrder.dueDate} onChange={e => setNewOrder({ ...newOrder, dueDate: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>우선순위</label>
                  <select style={s.inp} value={newOrder.priority} onChange={e => setNewOrder({ ...newOrder, priority: e.target.value })}>
                    <option value="NORMAL">일반</option>
                    <option value="URGENT">긴급</option>
                  </select>
                </div>
              </div>
              <label style={s.label}>내용</label>
              <textarea style={s.textarea} rows={5} value={newOrder.content} onChange={e => setNewOrder({ ...newOrder, content: e.target.value })} placeholder="업무 지시 내용을 입력하세요." />
              <button onClick={handleAddOrder} disabled={orderSaving || !newOrder.title || !newOrder.content} style={{ ...s.primaryBtn, marginTop: 10 }}>
                {orderSaving ? "저장 중…" : "등록"}
              </button>
            </div>
          )}

          <div style={s.section}>
            {workOrders.length === 0 ? (
              <p style={s.empty}>등록된 업무 지시가 없습니다.</p>
            ) : (
              workOrders.map(order => (
                <div key={order.id} style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {order.priority === "URGENT" && (
                        <span style={{ ...s.badge, background: "#fef2f2", color: "#dc2626" }}>긴급</span>
                      )}
                      <span style={s.cardTitle}>{order.title}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {order.dueDate && (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>기한: {new Date(order.dueDate).toLocaleDateString("ko-KR")}</span>
                      )}
                      <span style={s.cardDate}>{order.author.name} · {new Date(order.createdAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>
                  <p style={s.cardContent}>{order.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "SETTLEMENT" && <SettlementTab />}
    </div>
  );
}

/* ─── Styles ─── */
const s = {
  pageTitle:      { fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 20px" } as React.CSSProperties,
  tabRow:         { display: "flex", gap: 0, marginBottom: 16 } as React.CSSProperties,
  tab:            { padding: "10px 24px", fontSize: 14, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer", color: "#6b7280" } as React.CSSProperties,
  tabActive:      { background: "#1e3a5f", color: "#fff", borderColor: "#1e3a5f" } as React.CSSProperties,
  section:        { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px" } as React.CSSProperties,
  formBox:        { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", marginBottom: 16 } as React.CSSProperties,
  formTitle:      { fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 14px" } as React.CSSProperties,
  formGrid:       { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 10 } as React.CSSProperties,
  label:          { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 } as React.CSSProperties,
  inp:            { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" as const } as React.CSSProperties,
  textarea:       { width: "100%", padding: "12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" as const, resize: "vertical" as const, fontFamily: "inherit" } as React.CSSProperties,
  primaryBtn:     { padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
  filterBtn:      { padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", color: "#374151" } as React.CSSProperties,
  filterBtnActive:{ background: "#1e3a5f", color: "#fff", borderColor: "#1e3a5f" } as React.CSSProperties,
  card:           { padding: "14px 0", borderBottom: "1px solid #f3f4f6" } as React.CSSProperties,
  cardTitle:      { fontSize: 14, fontWeight: 700, color: "#111827" } as React.CSSProperties,
  cardVersion:    { fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 } as React.CSSProperties,
  cardDate:       { fontSize: 12, color: "#9ca3af" } as React.CSSProperties,
  cardContent:    { fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap" as const, lineHeight: 1.6 } as React.CSSProperties,
  badge:          { fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 4 } as React.CSSProperties,
  empty:          { fontSize: 13, color: "#9ca3af", textAlign: "center" as const, padding: 40 } as React.CSSProperties,
  table:          { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 } as React.CSSProperties,
  th:             { textAlign: "left" as const, padding: "10px 8px", fontWeight: 700, color: "#374151", borderBottom: "2px solid #e5e7eb", fontSize: 12 } as React.CSSProperties,
  td:             { padding: "10px 8px", borderBottom: "1px solid #f3f4f6", color: "#111827" } as React.CSSProperties,
};
