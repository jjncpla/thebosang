"use client";

import { useCallback, useEffect, useState } from "react";

const TF_LIST = ["더보상울산TF", "울산동부TF", "울산남부TF", "울산북부TF"];

type TelegramMsg = {
  id: string;
  tfName: string;
  messageId: string | null;
  senderName: string | null;
  content: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  sentAt: string;
  isProcessed: boolean;
  linkedCaseId: string | null;
  createdAt: string;
};

type PatientOption = { id: string; name: string; phone: string | null };

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(iso: string, year: number, month: number, day: number) {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

// ─── DB 반영 미니팝업 ─────────────────────────────────────────────────────────

function LinkCasePopup({
  msgId,
  onClose,
  onLinked,
}: {
  msgId: string;
  onClose: () => void;
  onLinked: (msgId: string, caseId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/inquiry?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      // flatten to patient options
      setResults(data.map((p: { id: string; name: string; phone: string | null }) => ({ id: p.id, name: p.name, phone: p.phone })));
    } catch {
      alert("조회 실패");
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    if (!selectedCaseId) { alert("재해자를 선택하세요."); return; }
    setLinking(true);
    try {
      const res = await fetch(`/api/tf/messages/${msgId}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedCaseId: selectedCaseId }),
      });
      if (!res.ok) throw new Error();
      onLinked(msgId, selectedCaseId);
      onClose();
    } catch {
      alert("반영 실패");
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1100 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "white", borderRadius: 10, padding: 20, zIndex: 1200,
        minWidth: 340, boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif",
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: "#111827" }}>재해자 DB 반영</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="성명 또는 전화번호"
            style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          />
          <button onClick={search} disabled={searching}
            style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>
            검색
          </button>
        </div>
        {results.length > 0 && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 12, maxHeight: 180, overflowY: "auto" }}>
            {results.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedCaseId(p.id)}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 13,
                  background: selectedCaseId === p.id ? "#eff6ff" : "white",
                  color: selectedCaseId === p.id ? "#2563eb" : "#374151",
                  borderBottom: "1px solid #f1f5f9",
                  fontWeight: selectedCaseId === p.id ? 700 : 400,
                }}
              >
                {p.name} {p.phone ? `(${p.phone})` : ""}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 14px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={handleLink} disabled={!selectedCaseId || linking}
            style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !selectedCaseId || linking ? 0.5 : 1 }}>
            {linking ? "반영 중..." : "DB 반영"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TFMonitorPage() {
  const today = new Date();
  const [selectedTf, setSelectedTf] = useState(TF_LIST[0]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [messages, setMessages] = useState<TelegramMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const [linkPopup, setLinkPopup] = useState<string | null>(null);

  // 달력에서 메시지가 있는 날짜 집합
  const daysWithMessages = new Set(
    messages.map((m) => new Date(m.sentAt).getDate())
  );

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ tfName: selectedTf, year: String(year), month: String(month + 1) });
      const res = await fetch(`/api/tf/messages?${p}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedTf, year, month]);

  const fetchUnprocessed = useCallback(async () => {
    const res = await fetch(`/api/tf/unprocessed?tf=${encodeURIComponent(selectedTf)}`);
    if (res.ok) {
      const data = await res.json();
      setUnprocessedCount(data.count ?? 0);
    }
  }, [selectedTf]);

  useEffect(() => {
    fetchMessages();
    fetchUnprocessed();
  }, [fetchMessages, fetchUnprocessed]);

  const filteredMessages = selectedDay
    ? messages.filter((m) => isSameDay(m.sentAt, year, month, selectedDay))
    : messages;

  const handleLinked = (msgId: string) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isProcessed: true } : m));
    setUnprocessedCount((c) => Math.max(0, c - 1));
  };

  const weeks = buildCalendar(year, month);
  const monthLabel = `${year}년 ${month + 1}월`;

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      {linkPopup && (
        <LinkCasePopup
          msgId={linkPopup}
          onClose={() => setLinkPopup(null)}
          onLinked={handleLinked}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>TF MONITORING</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>담당TF 모니터링</h1>
          {unprocessedCount > 0 && (
            <span style={{ background: "#dc2626", color: "white", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "2px 10px" }}>
              미처리 {unprocessedCount}건
            </span>
          )}
        </div>
      </div>

      {/* TF 선택 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TF_LIST.map((tf) => (
          <button
            key={tf}
            onClick={() => { setSelectedTf(tf); setSelectedDay(null); }}
            style={{
              padding: "6px 16px", fontSize: 13, borderRadius: 6, cursor: "pointer",
              border: selectedTf === tf ? "1px solid #2563eb" : "1px solid #e5e7eb",
              background: selectedTf === tf ? "#eff6ff" : "white",
              color: selectedTf === tf ? "#2563eb" : "#374151",
              fontWeight: selectedTf === tf ? 700 : 400,
            }}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Layout */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left: Calendar */}
        <div style={{ width: 260, flexShrink: 0, background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
            <button
              onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedDay(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 0 }}
            >‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{monthLabel}</span>
            <button
              onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedDay(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6b7280", padding: 0 }}
            >›</button>
          </div>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "6px 6px 2px" }}>
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#9ca3af", padding: "2px 0" }}>{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "2px 6px" }}>
              {week.map((day, di) => {
                const isToday = day !== null && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                const isSelected = day !== null && day === selectedDay;
                const hasMsg = day !== null && daysWithMessages.has(day);
                return (
                  <div
                    key={di}
                    onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                    style={{
                      textAlign: "center", fontSize: 12, padding: "4px 2px", borderRadius: 6,
                      cursor: day ? "pointer" : "default",
                      background: isSelected ? "#2563eb" : isToday ? "#eff6ff" : "transparent",
                      color: isSelected ? "white" : di === 0 ? "#ef4444" : di === 6 ? "#3b82f6" : "#374151",
                      fontWeight: isToday || isSelected ? 700 : 400,
                      position: "relative",
                    }}
                  >
                    {day ?? ""}
                    {hasMsg && !isSelected && (
                      <span style={{ display: "block", width: 4, height: 4, borderRadius: "50%", background: "#2563eb", margin: "1px auto 0" }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ padding: "8px 12px 12px", textAlign: "center" }}>
            {selectedDay ? (
              <button onClick={() => setSelectedDay(null)} style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                전체 보기
              </button>
            ) : (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>날짜를 클릭하면 해당일 메시지를 봅니다</span>
            )}
          </div>
        </div>

        {/* Right: Message Feed */}
        <div style={{ flex: 1, background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
              {selectedDay ? `${year}년 ${month + 1}월 ${selectedDay}일 메시지` : `${monthLabel} 전체 메시지`}
              <span style={{ marginLeft: 8, fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>{filteredMessages.length}건</span>
            </span>
          </div>

          <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto", padding: "12px 16px" }}>
            {loading && (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: 40, fontSize: 13 }}>불러오는 중...</div>
            )}
            {!loading && filteredMessages.length === 0 && (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: 40, fontSize: 13 }}>메시지가 없습니다.</div>
            )}
            {!loading && filteredMessages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  marginBottom: 12, padding: "12px 14px", borderRadius: 8,
                  background: msg.isProcessed ? "#f0fdf4" : "#f8fafc",
                  border: msg.isProcessed ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{msg.senderName ?? "알 수 없음"}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(msg.sentAt)} {formatTime(msg.sentAt)}</span>
                    {msg.isProcessed && (
                      <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>✓ DB반영완료</span>
                    )}
                  </div>
                  {!msg.isProcessed && (
                    <button
                      onClick={() => setLinkPopup(msg.id)}
                      style={{ border: "1px solid #2563eb", borderRadius: 5, padding: "3px 10px", fontSize: 11, color: "#2563eb", background: "#eff6ff", cursor: "pointer", fontWeight: 600 }}
                    >
                      DB 반영
                    </button>
                  )}
                </div>
                {msg.content && (
                  <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
                )}
                {msg.mediaType && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>📎 첨부파일 ({msg.mediaType})</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
