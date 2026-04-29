"use client";

import { useState, useEffect } from "react";

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

const TYPE_BADGE: Record<TaskType, string> = {
  정산요청: "badge-sky",
  이의제기: "badge-deep",
  제척임박: "badge-red",
  일반업무: "badge-lime",
};

// badge-* classes are self-contained — don't add base .badge to avoid style conflicts

const ALL_TYPES: TaskType[] = ["정산요청", "이의제기", "제척임박", "일반업무"];

export default function TodoPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
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
    const cacheKey = `tbss:page-cache:v1:todo-stats:${n.getFullYear()}-${n.getMonth() + 1}`;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(cacheKey);
        if (raw) setStats(JSON.parse(raw));
      } catch { /* ignore */ }
    }
    fetch(`/api/todos/stats?year=${n.getFullYear()}&month=${n.getMonth() + 1}`)
      .then(r => r.json())
      .then((d) => {
        setStats(d);
        if (typeof window !== "undefined") {
          try { window.localStorage.setItem(cacheKey, JSON.stringify(d)) } catch { /* quota */ }
        }
      })
      .catch(() => {});
  }, []);

  const fetchTodos = async () => {
    const cacheKey = "tbss:page-cache:v1:todos";
    let hadCache = false;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(cacheKey);
        if (raw) { setTasks(JSON.parse(raw)); hadCache = true; }
      } catch { /* ignore */ }
    }
    if (hadCache) setLoading(false);
    try {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
        if (typeof window !== "undefined") {
          try { window.localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota */ }
        }
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
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  const dateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const getTaskDate = (t: Task) => t.dueDate ? t.dueDate.slice(0, 10) : null;
  const getTaskType = (t: Task): TaskType => TYPE_MAP[t.type] ?? "일반업무";

  const hasTasks = (d: number) => tasks.some(t => getTaskDate(t) === dateStr(d));

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

  if (loading) return <div className="page-content" style={{ color: "var(--ink-400)" }}>불러오는 중...</div>;

  return (
    <div className="page-content">
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* ── Left: Calendar + Task list ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          {/* Calendar */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--paper-line)" }}>
              <button
                onClick={prevMonth}
                className="btn btn-ghost btn-sm"
                style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
              >‹</button>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-900)" }}>{MONTH_LABEL}</span>
              <button
                onClick={nextMonth}
                className="btn btn-ghost btn-sm"
                style={{ padding: "4px 10px", fontSize: 16, lineHeight: 1 }}
              >›</button>
            </div>

            <div className="cal" style={{ padding: "10px 12px 14px" }}>
              {DAYS.map((d, i) => (
                <div key={d} className="h" style={{ color: i === 0 ? "#B04A40" : i === 6 ? "#3E7EA1" : undefined }}>
                  {d}
                </div>
              ))}
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
                    className={`d${isToday ? " today" : ""}${dayOfWeek === 0 ? " sun" : ""}${dayOfWeek === 6 ? " sat" : ""}`}
                    onClick={() => setSelectedDate(ds)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "var(--sky)" : undefined,
                      borderRadius: isSelected ? "50%" : undefined,
                    }}
                  >
                    <span className="num" style={{ color: isSelected ? "#fff" : undefined, fontWeight: isSelected ? 700 : undefined }}>
                      {d}
                    </span>
                    {dotVisible && (
                      <span className="pill" style={{ background: isSelected ? "rgba(255,255,255,.6)" : undefined }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task list for selected day */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--paper-line)" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-900)" }}>
                {selectedDate} 업무 목록
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--ink-400)", fontWeight: 400 }}>{dayTasks.length}건</span>
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setAddForm({ title: "", dueDate: selectedDate || "", memo: "" }); setShowAddModal(true); }}
              >
                + 업무 추가
              </button>
            </div>
            <div style={{ padding: "8px 18px 16px" }}>
              {dayTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-400)", fontSize: 13 }}>
                  등록된 업무가 없습니다.
                </div>
              ) : (
                dayTasks.map(t => {
                  const tt = getTaskType(t);
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 0", borderBottom: "1px solid var(--paper-line)",
                        opacity: t.isDone ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={t.isDone}
                        onChange={() => handleToggleDone(t.id, t.isDone)}
                        style={{ cursor: "pointer" }}
                      />
                      <span className={TYPE_BADGE[tt]}>{tt}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--ink-900)", textDecoration: t.isDone ? "line-through" : "none" }}>
                        {t.title}
                        {t.patientName && <span style={{ color: "var(--ink-500)", marginLeft: 4 }}>({t.patientName})</span>}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-400)", whiteSpace: "nowrap" }}>
                        {t.dueDate ? `기한 ${t.dueDate.slice(0, 10)}` : ""}
                      </span>
                      <button
                        onClick={() => handleDeleteTodo(t.id)}
                        style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: "2px 4px" }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; }}
                      >삭제</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: 256, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Monthly stats */}
          {stats && (
            <div className="card card-pad">
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-400)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
                이번 달 수행율
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--sky)", lineHeight: 1 }}>{stats.rate}</span>
                <span style={{ fontSize: 16, color: "var(--sky)", marginBottom: 2 }}>%</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-400)", marginBottom: 12 }}>
                {stats.done}건 완료 / {stats.total}건 전체
              </div>
              <div style={{ width: "100%", background: "var(--paper-line)", borderRadius: 999, height: 6, marginBottom: 14 }}>
                <div style={{ width: `${stats.rate}%`, background: "var(--sky)", borderRadius: 999, height: 6, transition: "width .4s" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sky-ink)" }}>
                    {stats.byType.WAGE_REQUEST?.done ?? 0}/{stats.byType.WAGE_REQUEST?.total ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-400)", marginTop: 2 }}>정산요청</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--deep)" }}>
                    {stats.byType.OBJECTION_DEADLINE?.done ?? 0}/{stats.byType.OBJECTION_DEADLINE?.total ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-400)", marginTop: 2 }}>이의제기</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--lime-ink)" }}>
                    {stats.byType.GENERAL?.done ?? 0}/{stats.byType.GENERAL?.total ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-400)", marginTop: 2 }}>일반업무</div>
                </div>
              </div>
            </div>
          )}

          {/* Type filter */}
          <div className="card card-pad">
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-400)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
              유형별 필터
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={filters.size === ALL_TYPES.length}
                  onChange={toggleAll}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, color: "var(--ink-900)", fontWeight: 600 }}>전체</span>
              </label>
              {ALL_TYPES.map(type => (
                <label key={type} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={filters.has(type)}
                    onChange={() => toggleFilter(type)}
                    style={{ cursor: "pointer" }}
                  />
                  <span className={TYPE_BADGE[type]}>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Memo */}
          <div className="card card-pad">
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-400)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              메모
            </div>
            <textarea
              value={memoText}
              onChange={e => setMemoText(e.target.value)}
              placeholder="메모를 입력하세요..."
              style={{
                width: "100%",
                minHeight: 140,
                border: "1px solid var(--paper-line)",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
                color: "var(--ink-900)",
                resize: "vertical",
                fontFamily: "inherit",
                background: "var(--surface)",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {/* Add task modal */}
      {showAddModal && (
        <>
          <div
            onClick={() => setShowAddModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 1000, width: 400, maxWidth: "95%",
          }} className="card card-pad">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)", marginBottom: 16 }}>업무 추가</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--ink-500)", fontWeight: 600, display: "block", marginBottom: 4 }}>업무명 *</label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={e => setAddForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="업무 내용을 입력하세요"
                  style={{ width: "100%", border: "1px solid var(--paper-line)", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--ink-500)", fontWeight: 600, display: "block", marginBottom: 4 }}>기한 *</label>
                <input
                  type="date"
                  value={addForm.dueDate}
                  onChange={e => setAddForm(p => ({ ...p, dueDate: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--paper-line)", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--ink-500)", fontWeight: 600, display: "block", marginBottom: 4 }}>메모</label>
                <textarea
                  value={addForm.memo}
                  onChange={e => setAddForm(p => ({ ...p, memo: e.target.value }))}
                  placeholder="메모 (선택)"
                  rows={3}
                  style={{ width: "100%", border: "1px solid var(--paper-line)", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>취소</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddTodo}
                disabled={!addForm.title || !addForm.dueDate}
                style={{ opacity: (!addForm.title || !addForm.dueDate) ? 0.5 : 1 }}
              >저장</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
