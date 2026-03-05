"use client";

import { useState, FormEvent } from "react";

/* ─────────────────────────────────────
   Props
───────────────────────────────────── */
interface TimelineInputProps {
  caseId: number;
  /** 등록 성공 후 부모 컴포넌트에서 목록을 갱신할 수 있도록 콜백 제공 */
  onSuccess?: () => void;
}

/* ─────────────────────────────────────
   Component
───────────────────────────────────── */
export default function TimelineInput({ caseId, onSuccess }: TimelineInputProps) {
  const [title,      setTitle]      = useState("");
  const [date,       setDate]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // 클라이언트 사이드 유효성 검사
    if (!title.trim()) { setError("제목을 입력해주세요."); return; }
    if (!date)          { setError("날짜를 선택해주세요.");  return; }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/timelines/${caseId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), date }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `서버 오류 (${res.status})`);
      }

      // 성공 — 필드 초기화
      setTitle("");
      setDate("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000); // 3초 후 메시지 숨김

      onSuccess?.(); // 부모에서 목록 새로고침 트리거

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <p style={styles.sectionLabel}>타임라인 추가</p>

      <form onSubmit={handleSubmit} noValidate style={styles.form}>
        {/* 제목 */}
        <div style={styles.fieldGroup}>
          <label htmlFor="tl-title" style={styles.label}>제목</label>
          <input
            id="tl-title"
            type="text"
            placeholder="예: 병원 방문"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={submitting}
            style={styles.input}
          />
        </div>

        {/* 날짜 */}
        <div style={styles.fieldGroup}>
          <label htmlFor="tl-date" style={styles.label}>날짜</label>
          <input
            id="tl-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            disabled={submitting}
            style={styles.input}
          />
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            ...styles.button,
            ...(submitting ? styles.buttonDisabled : {}),
          }}
        >
          {submitting ? "저장 중…" : "등록"}
        </button>
      </form>

      {/* 에러 메시지 */}
      {error && (
        <p role="alert" style={styles.errorMsg}>
          ⚠ {error}
        </p>
      )}

      {/* 성공 메시지 */}
      {success && (
        <p role="status" style={styles.successMsg}>
          ✓ 타임라인이 등록되었습니다.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   Inline styles
───────────────────────────────────── */
const styles = {
  wrapper: {
    background:   "#f9fafb",
    border:       "1px solid #e5e7eb",
    borderRadius: 12,
    padding:      "16px 20px",
  } satisfies React.CSSProperties,

  sectionLabel: {
    margin:       "0 0 12px 0",
    fontSize:     11,
    fontWeight:   700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color:        "#6b7280",
  } satisfies React.CSSProperties,

  form: {
    display:   "flex",
    flexWrap:  "wrap" as const,
    gap:       10,
    alignItems: "flex-end",
  } satisfies React.CSSProperties,

  fieldGroup: {
    display:       "flex",
    flexDirection: "column" as const,
    gap:           4,
    flex:          "1 1 160px",
  } satisfies React.CSSProperties,

  label: {
    fontSize:   12,
    fontWeight: 600,
    color:      "#374151",
  } satisfies React.CSSProperties,

  input: {
    padding:      "8px 10px",
    fontSize:     14,
    border:       "1px solid #d1d5db",
    borderRadius: 8,
    outline:      "none",
    color:        "#111827",
    background:   "#fff",
    width:        "100%",
    boxSizing:    "border-box" as const,
  } satisfies React.CSSProperties,

  button: {
    padding:      "9px 20px",
    fontSize:     14,
    fontWeight:   700,
    border:       "none",
    borderRadius: 8,
    background:   "#0f172a",
    color:        "#fff",
    cursor:       "pointer",
    flexShrink:   0,
    height:       38,
    alignSelf:    "flex-end",
    transition:   "background 0.15s",
  } satisfies React.CSSProperties,

  buttonDisabled: {
    background: "#94a3b8",
    cursor:     "not-allowed",
  } satisfies React.CSSProperties,

  errorMsg: {
    marginTop:  10,
    fontSize:   13,
    color:      "#dc2626",
    margin:     "10px 0 0",
    fontWeight: 500,
  } satisfies React.CSSProperties,

  successMsg: {
    marginTop:  10,
    fontSize:   13,
    color:      "#16a34a",
    margin:     "10px 0 0",
    fontWeight: 600,
  } satisfies React.CSSProperties,
} as const;
