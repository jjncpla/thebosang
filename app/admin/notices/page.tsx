"use client";

import { useEffect, useState } from "react";

type Notice = { id: string; type: string; title: string | null; content: string; updatedAt: string } | null;

export default function NoticesPage() {
  const [tab, setTab] = useState<"GREETING" | "NOTICE">("GREETING");
  const [greeting, setGreeting] = useState<Notice>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [greetingContent, setGreetingContent] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchNotices();
  }, []);

  async function fetchNotices() {
    const [gRes, nRes] = await Promise.all([
      fetch("/api/admin/notices?type=GREETING"),
      fetch("/api/admin/notices?type=NOTICE"),
    ]);
    const g = await gRes.json();
    const n = await nRes.json();
    setGreeting(g);
    setGreetingContent(g?.content ?? "");
    setNotice(n);
    setNoticeTitle(n?.title ?? "");
    setNoticeContent(n?.content ?? "");
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    const body = tab === "GREETING"
      ? { type: "GREETING", content: greetingContent }
      : { type: "NOTICE", title: noticeTitle, content: noticeContent };
    const res = await fetch("/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMsg("저장되었습니다.");
      await fetchNotices();
    } else {
      setMsg("저장 실패");
    }
    setSaving(false);
  }

  return (
    <div>
      {/* 탭 */}
      <div style={s.tabRow}>
        <button onClick={() => setTab("GREETING")} style={{ ...s.tab, ...(tab === "GREETING" ? s.tabActive : {}) }}>대표 인사말</button>
        <button onClick={() => setTab("NOTICE")} style={{ ...s.tab, ...(tab === "NOTICE" ? s.tabActive : {}) }}>관리자 공지</button>
      </div>

      <div style={s.section}>
        {tab === "GREETING" ? (
          <>
            <h2 style={s.sectionTitle}>대표 인사말</h2>
            <p style={s.hint}>로그인 페이지 좌측 박스에 표시됩니다.</p>
            {greeting && <p style={s.lastUpdated}>마지막 수정: {new Date(greeting.updatedAt).toLocaleString("ko-KR")}</p>}
            <textarea
              value={greetingContent}
              onChange={e => setGreetingContent(e.target.value)}
              style={s.textarea}
              placeholder="대표 인사말을 입력하세요."
              rows={8}
            />
          </>
        ) : (
          <>
            <h2 style={s.sectionTitle}>관리자 공지</h2>
            <p style={s.hint}>로그인 페이지 우측 박스에 표시됩니다.</p>
            {notice && <p style={s.lastUpdated}>마지막 수정: {new Date(notice.updatedAt).toLocaleString("ko-KR")}</p>}
            <div style={{ marginBottom: 10 }}>
              <label style={s.label}>제목</label>
              <input value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} style={s.inp} placeholder="공지 제목" />
            </div>
            <div>
              <label style={s.label}>내용</label>
              <textarea
                value={noticeContent}
                onChange={e => setNoticeContent(e.target.value)}
                style={s.textarea}
                placeholder="공지 내용을 입력하세요."
                rows={8}
              />
            </div>
          </>
        )}

        {msg && <p style={{ fontSize: 13, color: msg.includes("실패") ? "#dc2626" : "#065f46", marginTop: 8 }}>{msg}</p>}

        <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      {/* 미리보기 */}
      {tab === "GREETING" && greetingContent && (
        <div style={s.preview}>
          <p style={s.previewTitle}>미리보기</p>
          <p style={s.previewContent}>{greetingContent}</p>
        </div>
      )}
      {tab === "NOTICE" && noticeContent && (
        <div style={s.preview}>
          <p style={s.previewTitle}>{noticeTitle || "(제목 없음)"}</p>
          <p style={s.previewContent}>{noticeContent}</p>
        </div>
      )}
    </div>
  );
}

const s = {
  tabRow:         { display: "flex", gap: 0, marginBottom: 16 } as React.CSSProperties,
  tab:            { padding: "10px 24px", fontSize: 14, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer", color: "#6b7280" } as React.CSSProperties,
  tabActive:      { background: "#1e3a5f", color: "#fff", borderColor: "#1e3a5f" } as React.CSSProperties,
  section:        { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "24px 28px", marginBottom: 16 } as React.CSSProperties,
  sectionTitle:   { fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" } as React.CSSProperties,
  hint:           { fontSize: 12, color: "#9ca3af", margin: "0 0 12px" } as React.CSSProperties,
  lastUpdated:    { fontSize: 12, color: "#6b7280", margin: "0 0 10px" } as React.CSSProperties,
  label:          { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 } as React.CSSProperties,
  inp:            { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" as const, marginBottom: 10 } as React.CSSProperties,
  textarea:       { width: "100%", padding: "12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" as const, resize: "vertical" as const, fontFamily: "inherit" } as React.CSSProperties,
  saveBtn:        { marginTop: 14, padding: "10px 28px", fontSize: 14, fontWeight: 700, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" } as React.CSSProperties,
  preview:        { background: "#fff", border: "1px solid #d1d5db", borderRadius: 10, padding: "20px 24px" } as React.CSSProperties,
  previewTitle:   { fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" } as React.CSSProperties,
  previewContent: { fontSize: 13, color: "#374151", margin: 0, whiteSpace: "pre-wrap" as const } as React.CSSProperties,
};
