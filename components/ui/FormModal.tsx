"use client";

import { useEffect, useState } from "react";

/**
 * FormModal
 *
 * 간단한 입력 폼 모달. window.prompt() 시리즈 대체용.
 *
 * 사용 예:
 *   const [open, setOpen] = useState(false);
 *   <FormModal
 *     open={open}
 *     title="평균임금 정정청구서 입력"
 *     fields={[
 *       { key: "additionalReason", label: "추가 청구 사유 (선택)", type: "textarea", placeholder: "비우면 자동 생성" },
 *       { key: "bankName", label: "수령 은행 (선택)", type: "text" },
 *       ...
 *     ]}
 *     submitLabel="PDF 다운로드"
 *     onCancel={() => setOpen(false)}
 *     onSubmit={async (values) => { ... }}
 *   />
 *
 * 주의:
 * - 외부 npm 패키지 사용 안 함 (인라인 스타일 + 표준 React).
 * - 빈 입력값은 빈 문자열 그대로 onSubmit 콜백에 전달.
 * - required 필드만 검증, 나머지는 모두 선택.
 */

export type FormModalField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "select";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  options?: { value: string; label: string }[]; // type === "select"
  helpText?: string;
};

interface Props {
  open: boolean;
  title: string;
  description?: string;
  fields: FormModalField[];
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onCancel: () => void;
}

export default function FormModal({
  open,
  title,
  description,
  fields,
  submitLabel = "확인",
  cancelLabel = "취소",
  submitting = false,
  onSubmit,
  onCancel,
}: Props) {
  // 필드별 값 state. open 변경 시 defaultValue로 초기화.
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const f of fields) initial[f.key] = f.defaultValue ?? "";
      setValues(initial);
      setErrors({});
    }
  }, [open, fields]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  function update(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit() {
    // 필수 검증
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !(values[f.key] ?? "").trim()) {
        newErrors[f.key] = "필수 입력 항목입니다.";
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(values);
  }

  // 스타일
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  };
  const modalStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 12,
    width: "92vw",
    maxWidth: 560,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };
  const headerStyle: React.CSSProperties = {
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    flexShrink: 0,
  };
  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: 20,
  };
  const footerStyle: React.CSSProperties = {
    padding: "12px 20px",
    borderTop: "1px solid #e5e7eb",
    background: "#f9fafb",
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    color: "#374151",
    fontWeight: 500,
    marginBottom: 4,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const helpStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 4,
  };
  const errStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 4,
  };
  const requiredMark: React.CSSProperties = {
    color: "#dc2626",
    marginLeft: 2,
  };

  return (
    <div
      style={overlayStyle}
      onClick={() => {
        if (!submitting) onCancel();
      }}
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>{title}</h3>
          {description && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{description}</p>
          )}
        </div>

        {/* 본문 */}
        <div style={bodyStyle}>
          {fields.map((f) => {
            const v = values[f.key] ?? "";
            const err = errors[f.key];
            return (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>
                  {f.label}
                  {f.required && <span style={requiredMark}>*</span>}
                </label>

                {f.type === "textarea" ? (
                  <textarea
                    style={{ ...inputStyle, height: 80, resize: "vertical" }}
                    value={v}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    disabled={submitting}
                  />
                ) : f.type === "select" ? (
                  <select
                    style={inputStyle}
                    value={v}
                    onChange={(e) => update(f.key, e.target.value)}
                    disabled={submitting}
                  >
                    <option value="">선택...</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    style={inputStyle}
                    type={f.type ?? "text"}
                    value={v}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    disabled={submitting}
                  />
                )}

                {f.helpText && !err && <div style={helpStyle}>{f.helpText}</div>}
                {err && <div style={errStyle}>{err}</div>}
              </div>
            );
          })}
        </div>

        {/* 푸터 */}
        <div style={footerStyle}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: "8px 14px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              color: "#374151",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 6,
              background: submitting ? "#9ca3af" : "#3b82f6",
              color: "#fff",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {submitting ? "처리 중..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
