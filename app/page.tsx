"use client";

import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   [타입 정의]
   ═══════════════════════════════════════════════════════════════ */
type TaskType = "정산요청" | "이의제기" | "제척임박" | "일반업무";

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  type: string;
  isDone: boolean;
  patientName: string | null;
  memo: string | null;
}

const TYPE_MAP: Record<string, TaskType> = {
  OBJECTION_DEADLINE: "이의제기",
  WAGE_REQUEST: "정산요청",
  GENERAL: "일반업무",
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);

const TYPE_COLORS: Record<TaskType, { bg: string; color: string }> = {
  정산요청: { bg: "#dbeafe", color: "#1e40af" },
  이의제기: { bg: "#fce7f3", color: "#9d174d" },
  제척임박: { bg: "#fee2e2", color: "#991b1b" },
  일반업무: { bg: "#d1fae5", color: "#065f46" },
};

const ALL_TYPES: TaskType[] = ["정산요청", "이의제기", "제척임박", "일반업무"];

/* ═══════════════════════════════════════════════════════════════
   [메인 컴포넌트]
   ═══════════════════════════════════════════════════════════════ */
export default function TodoPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(fmt(now));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Set<TaskType>>(new Set(ALL_TYPES));
  const [memoText, setMemoText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", dueDate: "", memo: "" });
  const [stats, setStats] = useState<{
    total: number; done: number; rate: number;
    byType: Record<string, { total: number; done: number }>;
  } | null>(null);

  useEffect(() => {
    const n = new Date();
    fetch(`/api/todos/stats?year=${n.getFullYear()}&month=${n.getMonth() + 1}`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error("Todo 로드 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTodos(); }, []);

  const handleToggleDone = async (id: string, isDone: boolean) => {
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !isDone }),
    });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, isDone: !isDone } : t));
  };

  const handleAddTodo = async () => {
    if (!addForm.title || !addForm.dueDate) return;
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: addForm.title, dueDate: addForm.dueDate, type: "GENERAL", memo: addForm.memo || null }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setAddForm({ title: "", dueDate: selectedDate || "", memo: "" });
        fetchTodos();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!confirm("이 업무를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/todos/${todoId}`, { method: "DELETE" });
      if (res.ok) fetchTodos();
    } catch (e) { console.error(e); }
  };

  const todayStr = fmt(now);

  /* 달력 계산 */
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // 6행 고정을 위해 42칸 맞춤
  while (cells.length < 42) cells.push(null);

  const dateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const getTaskDate = (t: Task) => t.dueDate ? t.dueDate.slice(0, 10) : null;
  const getTaskType = (t: Task): TaskType => TYPE_MAP[t.type] ?? "일반업무";

  const hasTasks = (d: number) => tasks.some(t => getTaskDate(t) === dateStr(d));

  /* 선택된 날짜의 필터된 할일 */
  const dayTasks = tasks.filter(
    t => getTaskDate(t) === selectedDate && filters.has(getTaskType(t))
  );

  const toggleFilter = (type: TaskType) => {
    setFilters(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const toggleAll = () => {
    setFilters(prev => prev.size === ALL_TYPES.length ? new Set() : new Set(ALL_TYPES));
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const MONTH_LABEL = `${year}년 ${month + 1}월`;

  if (loading) return <div style={{ padding: 32, color: "#94a3b8" }}>불러오는 중...</div>;

  return (
    <div style={wrap}>
      <div style={layout}>

        {/* ── 좌측: 달력 + 할일 목록 ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          {/* 달력 카드 */}
          <div style={card}>
            {/* 헤더 */}
            <div style={calHeader}>
              <button onClick={prevMonth} style={calNavBtn}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{MONTH_LABEL}</span>
              <button onClick={nextMonth} style={calNavBtn}>›</button>
            </div>

            {/* 요일 헤더 */}
            <div style={calGrid}>
              {DAYS.map((d, i) => (
                <div key={d} style={{ ...calDayHeader, color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#64748b" }}>
                  {d}
                </div>
              ))}

              {/* 날짜 셀 */}
              {cells.map((d, idx) => {
                if (!d) return <div key={idx} />;
                const ds = dateStr(d);
                const isToday = ds === todayStr;
                const isSelected = ds === selectedDate;
                const dotVisible = hasTasks(d);
                const dayOfWeek = (firstDay + d - 1) % 7;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(ds)}
                    style={{
                      ...calDayBtn,
                      background: isSelected ? "#29ABE2" : isToday ? "#eff6ff" : "transparent",
                      color: isSelected ? "#fff" : isToday ? "#29ABE2" : dayOfWeek === 0 ? "#ef4444" : dayOfWeek === 6 ? "#3b82f6" : "#1e293b",
                      fontWeight: isToday || isSelected ? 700 : 400,
                      borderRadius: "50%",
                      position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    {d}
                    {dotVisible && (
                      <span style={{
                        position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
                        width: 4, height: 4, borderRadius: "50%",
                        background: isSelected ? "#bfdbfe" : "#29ABE2",
                        display: "block",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택 날짜 할일 목록 */}
          <div style={card}>
            <div style={listHeader}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                {selectedDate} 업무 목록
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{dayTasks.length}건</span>
                <button onClick={() => { setAddForm({ title: "", dueDate: selectedDate || "", memo: "" }); setShowAddModal(true); }} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ 업무 추가</button>
              </div>
            </div>
            <div style={{ padding: "8px 16px 16px" }}>
              {dayTasks.length === 0 ? (
                <div style={empty}>등록된 업무가 없습니다.</div>
              ) : (
                dayTasks.map(t => {
                  const tt = getTaskType(t);
                  return (
                    <div key={t.id} style={{ ...taskRow, opacity: t.isDone ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        checked={t.isDone}
                        onChange={() => handleToggleDone(t.id, t.isDone)}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ ...badge, background: TYPE_COLORS[tt].bg, color: TYPE_COLORS[tt].color }}>
                        {tt}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: "#1e293b", textDecoration: t.isDone ? "line-through" : "none" }}>
                        {t.title}
                        {t.patientName && <span style={{ color: "#6b7280", marginLeft: 4 }}>({t.patientName})</span>}
                      </span>
                      <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {t.dueDate ? `기한 ${t.dueDate.slice(0, 10)}` : ""}
                      </span>
                      <button onClick={() => handleDeleteTodo(t.id)} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: "2px 4px" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.4"}>삭제</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── 우측: 필터 + 메모 ── */}
        <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 수행율 위젯 */}
          {stats && (
            <div style={card}>
              <div style={sideCardH}>이번 달 수행율</div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>완료 {stats.done}건 / 전체 {stats.total}건</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#29ABE2" }}>{stats.rate}%</span>
                </div>
                <div style={{ width: "100%", background: "#e2e8f0", borderRadius: 999, height: 8, marginBottom: 12 }}>
                  <div style={{ width: `${stats.rate}%`, background: "#29ABE2", borderRadius: 999, height: 8, transition: "width 0.3s" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ea580c" }}>
                      {stats.byType.OBJECTION_DEADLINE?.done ?? 0}/{stats.byType.OBJECTION_DEADLINE?.total ?? 0}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>제척임박</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
                      {stats.byType.WAGE_REQUEST?.done ?? 0}/{stats.byType.WAGE_REQUEST?.total ?? 0}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>정산요청</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                      {stats.byType.GENERAL?.done ?? 0}/{stats.byType.GENERAL?.total ?? 0}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>일반업무</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 필터 */}
          <div style={card}>
            <div style={sideCardH}>유형별 필터</div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={checkRow}>
                <input
                  type="checkbox"
                  checked={filters.size === ALL_TYPES.length}
                  onChange={toggleAll}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>전체</span>
              </label>
              {ALL_TYPES.map(type => (
                <label key={type} style={checkRow}>
                  <input
                    type="checkbox"
                    checked={filters.has(type)}
                    onChange={() => toggleFilter(type)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ ...badge, background: TYPE_COLORS[type].bg, color: TYPE_COLORS[type].color }}>
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div style={card}>
            <div style={sideCardH}>메모</div>
            <div style={{ padding: "12px 16px" }}>
              <textarea
                value={memoText}
                onChange={e => setMemoText(e.target.value)}
                placeholder="메모를 입력하세요..."
                style={memoArea}
              />
            </div>
          </div>

        </div>
      </div>

      {/* 업무 추가 모달 */}
      {showAddModal && (
        <>
          <div onClick={() => setShowAddModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 24, zIndex: 1000, width: 400, maxWidth: "95%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>업무 추가</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 4 }}>업무명 *</label>
                <input type="text" value={addForm.title} onChange={e => setAddForm(p => ({ ...p, title: e.target.value }))} placeholder="업무 내용을 입력하세요" style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 4 }}>기한 *</label>
                <input type="date" value={addForm.dueDate} onChange={e => setAddForm(p => ({ ...p, dueDate: e.target.value }))} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 4 }}>메모</label>
                <textarea value={addForm.memo} onChange={e => setAddForm(p => ({ ...p, memo: e.target.value }))} placeholder="메모 (선택)" rows={3} style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowAddModal(false)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
              <button onClick={handleAddTodo} disabled={!addForm.title || !addForm.dueDate} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!addForm.title || !addForm.dueDate) ? 0.5 : 1 }}>저장</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   [스타일]
   ═══════════════════════════════════════════════════════════════ */
const wrap: React.CSSProperties = {
  padding: 24,
  background: "#f1f5f9",
  minHeight: "100vh",
  fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
};
const layout: React.CSSProperties = {
  display: "flex",
  gap: 24,
  alignItems: "flex-start",
};
const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
};
const calHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid #f1f5f9",
};
const calNavBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: "4px 12px",
  fontSize: 18,
  cursor: "pointer",
  color: "#475569",
  lineHeight: 1,
};
const calGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 2,
  padding: "8px 10px 12px",
};
const calDayHeader: React.CSSProperties = {
  textAlign: "center",
  fontSize: 12,
  fontWeight: 600,
  padding: "6px 0",
};
const calDayBtn: React.CSSProperties = {
  textAlign: "center",
  fontSize: 13,
  padding: "6px 0",
  lineHeight: "20px",
  minHeight: 32,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};
const listHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid #f1f5f9",
};
const taskRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 0",
  borderBottom: "1px solid #f8fafc",
};
const badge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 12,
  whiteSpace: "nowrap",
};
const empty: React.CSSProperties = {
  textAlign: "center",
  padding: "32px 0",
  color: "#94a3b8",
  fontSize: 13,
};
const sideCardH: React.CSSProperties = {
  padding: "12px 16px",
  fontWeight: 700,
  fontSize: 13,
  color: "#475569",
  borderBottom: "1px solid #f1f5f9",
  background: "#f8fafc",
};
const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};
const memoArea: React.CSSProperties = {
  width: "100%",
  minHeight: 160,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: "#1e293b",
  resize: "vertical",
  fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
