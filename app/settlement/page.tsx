"use client";

import { useEffect, useState, useCallback } from "react";
import { ALL_TF_LIST } from "@/lib/constants/tf";

const TF_UNASSIGNED = "TF미지정";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "미정산" | "정산예정";

type SettlementItem = {
  id: string;
  tfGroup: string;
  category: Category;
  isPaid: boolean;
  victimName: string;
  grade: string | null;
  branchName: string | null;
  managerName: string | null;
  decisionDate: string | null;
  scheduledDate: string | null;
  status: string | null;
  isInstallment: boolean;
  totalAmount: number | null;
  paidAmount: number | null;
  memo: string | null;
  sortOrder: number;
};

const EMPTY_FORM: Omit<SettlementItem, "id" | "sortOrder"> = {
  tfGroup: TF_UNASSIGNED,
  category: "정산예정",
  isPaid: false,
  victimName: "",
  grade: "",
  branchName: "",
  managerName: "",
  decisionDate: null,
  scheduledDate: null,
  status: "",
  isInstallment: false,
  totalAmount: null,
  paidAmount: null,
  memo: "",
};

// ─── Text Parser ─────────────────────────────────────────────────────────────

function parseSettlementText(text: string): Array<Omit<SettlementItem, "id" | "sortOrder">> {
  const lines = text.split("\n");
  const results: Array<Omit<SettlementItem, "id" | "sortOrder">> = [];
  let currentCategory: Category = "정산예정";
  let hasSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("■") || line.startsWith("★ >") || line.startsWith("---")) continue;

    // 섹션 헤더: <... 미정산 리스트> 또는 <... 정산 예정자>
    const sectionMatch = line.match(/^<(.+?)\s*(미정산\s*리스트|정산\s*예정자)>/);
    if (sectionMatch) {
      currentCategory = sectionMatch[2].replace(/\s/g, "").includes("미정산") ? "미정산" : "정산예정";
      hasSection = true;
      continue;
    }

    if (!line.startsWith("-")) continue;

    const entryLine = line.slice(1).trim();
    const isPaid = entryLine.startsWith("★");
    const withoutStar = isPaid ? entryLine.slice(1).trim() : entryLine;

    // name(grade/branch/manager) : rest
    const parenMatch = withoutStar.match(/^(.+?)\((.+?)\)\s*:\s*(.+)$/);
    if (!parenMatch) continue;

    const victimName = parenMatch[1].trim();
    const innerParts = parenMatch[2].split("/");
    const grade = innerParts[0]?.trim() || null;
    const branchName = innerParts[1]?.trim() || null;
    const managerName = innerParts[2]?.trim() || null;
    let remainder = parenMatch[3].trim();

    // 날짜 파싱: 2025.06.26. 또는 26.03.24.
    let dateStr: string | null = null;
    const dateMatch = remainder.match(/^(\d{2,4})\.(\d{2})\.(\d{2})\./);
    if (dateMatch) {
      const year = dateMatch[1].length === 2 ? `20${dateMatch[1]}` : dateMatch[1];
      dateStr = `${year}-${dateMatch[2]}-${dateMatch[3]}`;
      remainder = remainder.slice(dateMatch[0].length).trim();
    }

    // 상태 파싱: (분할 납부중) 등
    let isInstallment = false;
    let status: string | null = null;
    const statusMatch = remainder.match(/^\(([^)]+)\)/);
    if (statusMatch) {
      status = statusMatch[1].trim();
      if (status.replace(/\s/g, "").includes("분할")) isInstallment = true;
      remainder = remainder.slice(statusMatch[0].length).trim();
    }

    // 분할납부 금액: 1900/2200
    let paidAmount: number | null = null;
    let totalAmount: number | null = null;
    const amtMatch = remainder.match(/^(\d+)\s*\/\s*(\d+)/);
    if (amtMatch) {
      paidAmount = parseInt(amtMatch[1]);
      totalAmount = parseInt(amtMatch[2]);
      isInstallment = true;
    }

    // 항상 TF미지정으로 — 관리자가 직접 TF 배정
    results.push({
      tfGroup: TF_UNASSIGNED,
      category: hasSection ? currentCategory : "정산예정",
      isPaid,
      victimName,
      grade,
      branchName,
      managerName,
      decisionDate: currentCategory === "미정산" ? dateStr : null,
      scheduledDate: currentCategory === "정산예정" ? dateStr : null,
      status,
      isInstallment,
      totalAmount,
      paidAmount,
      memo: null,
    });
  }
  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}.`;
}

function toInput(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function todayKR() {
  const d = new Date();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}. (${week})`;
}

function entryLabel(item: SettlementItem) {
  const parts = [item.grade, item.branchName, item.managerName].filter(Boolean);
  return parts.length ? `(${parts.join("/")})` : "";
}

// ─── TF Selector ─────────────────────────────────────────────────────────────

function TfSelect({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, ...style }}>
      <option value={TF_UNASSIGNED}>{TF_UNASSIGNED}</option>
      <optgroup label="더보상 TF">
        {ALL_TF_LIST.filter((tf) => tf.startsWith("더보상")).sort().map((tf) => (
          <option key={tf} value={tf}>{tf}</option>
        ))}
      </optgroup>
      <optgroup label="이산 TF">
        {ALL_TF_LIST.filter((tf) => tf.startsWith("이산")).sort().map((tf) => (
          <option key={tf} value={tf}>{tf}</option>
        ))}
      </optgroup>
      <optgroup label="기타">
        {ALL_TF_LIST.filter((tf) => !tf.startsWith("더보상") && !tf.startsWith("이산")).sort().map((tf) => (
          <option key={tf} value={tf}>{tf}</option>
        ))}
      </optgroup>
    </select>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({
  onImport,
  onClose,
}: {
  onImport: (items: Array<Omit<SettlementItem, "id" | "sortOrder">>) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Array<Omit<SettlementItem, "id" | "sortOrder">> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  function handleParse() {
    if (!text.trim()) { setError("텍스트를 입력해주세요."); return; }
    const result = parseSettlementText(text);
    if (result.length === 0) {
      setError("인식된 항목이 없습니다. 양식을 확인해주세요.\n예: <울산/울동 TF 미정산 리스트>\n- ★김수옥(6급(근골)/울산지사/홍) : 2025.06.26.");
    } else {
      setError("");
      setParsed(result);
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    setSaving(true);
    setSaveError("");
    try {
      await onImport(parsed);
      onClose();
    } catch (err: any) {
      setSaveError(err.message ?? "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 10, padding: 28, width: 640, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>텍스트 가져오기</h3>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>
          기존 정산 관리 텍스트를 그대로 붙여넣으면 항목을 자동으로 인식합니다.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
          ※ 가져온 항목은 모두 <strong>TF미지정</strong>으로 분류됩니다. 이후 각 항목에서 TF를 직접 지정해주세요.
        </p>

        {!parsed ? (
          <>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(""); }}
              rows={14}
              placeholder={`<울산/울동 TF 미정산 리스트>\n\n- ★김수옥(6급(근골)/울산지사/홍) : 2025.06.26. (분할 납부중) 1900/2200\n\n<울산동부/울산남부/울산북부/양산TF 정산 예정자>\n\n- 이주영(10급(예)/울산지사/지윤) : 26.03.24.`}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db", borderRadius: 7, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }}
            />
            {error && (
              <pre style={{ margin: "8px 0 0", fontSize: 12, color: "#ef4444", whiteSpace: "pre-wrap" }}>{error}</pre>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={onClose} style={btnSecondary}>취소</button>
              <button onClick={handleParse} style={btnPrimary}>인식하기</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "10px 14px", marginBottom: 14 }}>
              <strong style={{ fontSize: 13, color: "#166534" }}>✓ {parsed.length}개 항목 인식됨 — 모두 TF미지정으로 저장됩니다</strong>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 7, overflow: "hidden", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["구분", "★", "재해자", "등급", "지사", "담당", "날짜", "분할납부"].map((h) => (
                      <th key={h} style={{ padding: "7px 8px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, background: item.category === "미정산" ? "#fef2f2" : "#eff6ff", color: item.category === "미정산" ? "#dc2626" : "#2563eb", fontWeight: 600 }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px", color: item.isPaid ? "#eab308" : "#d1d5db", fontSize: 14 }}>★</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{item.victimName}</td>
                      <td style={{ padding: "6px 8px", color: "#6b7280" }}>{item.grade || "-"}</td>
                      <td style={{ padding: "6px 8px", color: "#6b7280" }}>{item.branchName || "-"}</td>
                      <td style={{ padding: "6px 8px", color: "#6b7280" }}>{item.managerName || "-"}</td>
                      <td style={{ padding: "6px 8px", color: "#374151", whiteSpace: "nowrap" }}>
                        {fmtDate(item.decisionDate || item.scheduledDate)}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#9333ea" }}>
                        {item.isInstallment ? `${item.paidAmount ?? "?"}/${item.totalAmount ?? "?"}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {saveError && (
              <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#dc2626" }}>
                ⚠ 저장 실패: {saveError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setParsed(null)} style={btnSecondary}>다시 붙여넣기</button>
              <button onClick={handleConfirm} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                {saving ? "저장 중..." : `${parsed.length}개 저장`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({
  form,
  onChange,
  onSave,
  onClose,
  isEdit,
}: {
  form: Omit<SettlementItem, "id" | "sortOrder">;
  onChange: (f: Omit<SettlementItem, "id" | "sortOrder">) => void;
  onSave: () => void;
  onClose: () => void;
  isEdit: boolean;
}) {
  const set = (key: keyof typeof form, val: unknown) => onChange({ ...form, [key]: val });

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 10, padding: 28, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>
          {isEdit ? "항목 수정" : "항목 추가"}
        </h3>

        {/* TF 선택 */}
        <label style={labelStyle}>TF *</label>
        <TfSelect value={form.tfGroup} onChange={(v) => set("tfGroup", v)} style={{ marginBottom: 12 }} />

        {/* 구분 */}
        <label style={labelStyle}>구분 *</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["미정산", "정산예정"] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => set("category", c)}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "1.5px solid",
                borderColor: form.category === c ? "#2563eb" : "#d1d5db",
                background: form.category === c ? "#eff6ff" : "#fff",
                color: form.category === c ? "#2563eb" : "#374151",
                fontWeight: form.category === c ? 700 : 400,
                cursor: "pointer", fontSize: 13,
              }}
            >
              {c === "미정산" ? "미정산 리스트" : "정산 예정자"}
            </button>
          ))}
        </div>

        {/* 지급완료 ★ */}
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={form.isPaid}
            onChange={(e) => set("isPaid", e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>★ 지급완료 (결정·지급 완료된 건)</span>
        </label>

        {/* 재해자명 */}
        <label style={labelStyle}>재해자명 *</label>
        <input
          value={form.victimName}
          onChange={(e) => set("victimName", e.target.value)}
          placeholder="예: 김수옥, 망 윤일균"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        {/* 등급/유형 */}
        <label style={labelStyle}>등급/유형</label>
        <input
          value={form.grade ?? ""}
          onChange={(e) => set("grade", e.target.value)}
          placeholder="예: 6급(근골), 10급(예), 유족급여,장례비"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        {/* 지사 / 담당자 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>지사명</label>
            <input
              value={form.branchName ?? ""}
              onChange={(e) => set("branchName", e.target.value)}
              placeholder="예: 울산지사"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>담당자 (약칭)</label>
            <input
              value={form.managerName ?? ""}
              onChange={(e) => set("managerName", e.target.value)}
              placeholder="예: 홍, 지윤"
              style={inputStyle}
            />
          </div>
        </div>

        {/* 날짜 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>결정·지급일</label>
            <input
              type="date"
              value={toInput(form.decisionDate)}
              onChange={(e) => set("decisionDate", e.target.value || null)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>정산 예정일</label>
            <input
              type="date"
              value={toInput(form.scheduledDate)}
              onChange={(e) => set("scheduledDate", e.target.value || null)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* 분할납부 */}
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={form.isInstallment}
            onChange={(e) => set("isInstallment", e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>분할 납부</span>
        </label>
        {form.isInstallment && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>납부액 (만원)</label>
              <input
                type="number"
                value={form.paidAmount ?? ""}
                onChange={(e) => set("paidAmount", e.target.value ? Number(e.target.value) : null)}
                placeholder="1900"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>총액 (만원)</label>
              <input
                type="number"
                value={form.totalAmount ?? ""}
                onChange={(e) => set("totalAmount", e.target.value ? Number(e.target.value) : null)}
                placeholder="2200"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* 상태 */}
        <label style={labelStyle}>상태</label>
        <input
          value={form.status ?? ""}
          onChange={(e) => set("status", e.target.value)}
          placeholder="예: 분할 납부중, 정산 비협조 중"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        {/* 메모 */}
        <label style={labelStyle}>메모</label>
        <textarea
          value={form.memo ?? ""}
          onChange={(e) => set("memo", e.target.value)}
          rows={2}
          style={{ ...inputStyle, marginBottom: 20, resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>취소</button>
          <button onClick={onSave} style={btnPrimary}>
            {isEdit ? "수정 저장" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({
  item,
  onEdit,
  onDelete,
  onTogglePaid,
  onAssignTf,
  isUnassigned,
}: {
  item: SettlementItem;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid: () => void;
  onAssignTf: (tf: string) => void;
  isUnassigned: boolean;
}) {
  const [tfSelectOpen, setTfSelectOpen] = useState(false);
  const dateStr = item.category === "미정산" ? fmtDate(item.decisionDate) : fmtDate(item.scheduledDate);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 6,
      padding: "5px 8px", borderRadius: 4,
      background: item.isPaid ? "#f0fdf4" : "transparent",
    }}>
      {/* star */}
      <button
        onClick={onTogglePaid}
        title={item.isPaid ? "지급완료 해제" : "지급완료 표시"}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, marginTop: 1, color: item.isPaid ? "#eab308" : "#d1d5db" }}
      >★</button>

      {/* content */}
      <span style={{ flex: 1, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>
        <span style={{ fontWeight: 600 }}>{item.victimName}</span>
        <span style={{ color: "#6b7280" }}>{entryLabel(item)}</span>
        {dateStr !== "-" && <span style={{ color: "#374151" }}> : {dateStr}</span>}
        {item.isInstallment && (
          <span style={{ color: "#9333ea", fontWeight: 500 }}>
            {" "}(분할 납부중)
            {item.paidAmount != null && item.totalAmount != null && <> {item.paidAmount}/{item.totalAmount}</>}
          </span>
        )}
        {item.status && !item.isInstallment && (
          <span style={{ color: "#6b7280" }}> ({item.status})</span>
        )}
        {item.memo && <span style={{ color: "#9ca3af", fontSize: 12 }}> — {item.memo}</span>}
      </span>

      {/* TF미지정 전용: TF 지정 인라인 셀렉트 */}
      {isUnassigned && (
        <div style={{ flexShrink: 0 }}>
          {tfSelectOpen ? (
            <select
              autoFocus
              defaultValue=""
              onChange={(e) => { if (e.target.value) { onAssignTf(e.target.value); setTfSelectOpen(false); } }}
              onBlur={() => setTfSelectOpen(false)}
              style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #2563eb", borderRadius: 4 }}
            >
              <option value="" disabled>TF 선택...</option>
              {ALL_TF_LIST.filter((tf) => tf.startsWith("더보상")).sort().map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
              {ALL_TF_LIST.filter((tf) => tf.startsWith("이산")).sort().map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
              {ALL_TF_LIST.filter((tf) => !tf.startsWith("더보상") && !tf.startsWith("이산")).sort().map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setTfSelectOpen(true)}
              style={{ ...actionBtn, color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 600 }}
            >
              TF 지정
            </button>
          )}
        </div>
      )}

      {/* actions */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={onEdit} style={actionBtn}>수정</button>
        <button
          onClick={() => { if (confirm(`"${item.victimName}" 항목을 삭제하시겠습니까?`)) onDelete(); }}
          style={{ ...actionBtn, color: "#ef4444" }}
        >삭제</button>
      </div>
    </div>
  );
}

// ─── Section (미정산 or 정산예정) ─────────────────────────────────────────────

function Section({
  title,
  items,
  onEdit,
  onDelete,
  onTogglePaid,
  onAssignTf,
  onAdd,
  isUnassigned,
}: {
  title: string;
  items: SettlementItem[];
  onEdit: (item: SettlementItem) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (item: SettlementItem) => void;
  onAssignTf: (item: SettlementItem, tf: string) => void;
  onAdd: () => void;
  isUnassigned: boolean;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>{title}</span>
        <span style={{ fontSize: 11, background: "#eff6ff", color: "#2563eb", borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>
          {items.length}건
        </span>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 4px 24px" }}>항목 없음</p>
      ) : (
        items.map((item) => (
          <EntryRow
            key={item.id}
            item={item}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item.id)}
            onTogglePaid={() => onTogglePaid(item)}
            onAssignTf={(tf) => onAssignTf(item, tf)}
            isUnassigned={isUnassigned}
          />
        ))
      )}
      <button onClick={onAdd} style={{ marginTop: 4, marginLeft: 24, fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        + 항목 추가
      </button>
      <div style={{ marginTop: 8, borderTop: "1px dashed #e5e7eb" }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettlementPage() {
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SettlementItem | null>(null);
  const [form, setForm] = useState<Omit<SettlementItem, "id" | "sortOrder">>(EMPTY_FORM);

  const load = useCallback(async () => {
    const res = await fetch("/api/settlement");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 실제 TF 목록: DB에 있는 것 중 ALL_TF_LIST에 속한 것만 (순서 유지)
  const activeTfs = ALL_TF_LIST.filter((tf) =>
    items.some((i) => i.tfGroup === tf)
  );
  const hasUnassigned = items.some((i) => !i.tfGroup || i.tfGroup === TF_UNASSIGNED || !ALL_TF_LIST.includes(i.tfGroup));

  function openAdd(tfGroup: string, category: Category) {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, tfGroup, category });
    setModalOpen(true);
  }

  function openEdit(item: SettlementItem) {
    setEditTarget(item);
    setForm({
      tfGroup: item.tfGroup ?? TF_UNASSIGNED,
      category: item.category,
      isPaid: item.isPaid,
      victimName: item.victimName,
      grade: item.grade,
      branchName: item.branchName,
      managerName: item.managerName,
      decisionDate: item.decisionDate,
      scheduledDate: item.scheduledDate,
      status: item.status,
      isInstallment: item.isInstallment,
      totalAmount: item.totalAmount,
      paidAmount: item.paidAmount,
      memo: item.memo,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.victimName.trim()) { alert("재해자명을 입력해주세요."); return; }

    if (editTarget) {
      await fetch(`/api/settlement/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setModalOpen(false);
    load();
  }

  async function handleImport(parsed: Array<Omit<SettlementItem, "id" | "sortOrder">>) {
    const res = await fetch("/api/settlement/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/settlement/${id}`, { method: "DELETE" });
    load();
  }

  async function handleTogglePaid(item: SettlementItem) {
    await fetch(`/api/settlement/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: !item.isPaid }),
    });
    load();
  }

  async function handleAssignTf(item: SettlementItem, tf: string) {
    await fetch(`/api/settlement/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tfGroup: tf }),
    });
    load();
  }

  const getItems = (tf: string, category: Category) =>
    items.filter((i) => i.tfGroup === tf && i.category === category);

  const getUnassignedItems = (category: Category) =>
    items.filter((i) => (
      (!i.tfGroup || i.tfGroup === TF_UNASSIGNED || !ALL_TF_LIST.includes(i.tfGroup))
      && i.category === category
    ));

  const renderTfCard = (tf: string, isUnassigned = false) => {
    const unsettled = isUnassigned ? getUnassignedItems("미정산") : getItems(tf, "미정산");
    const upcoming = isUnassigned ? getUnassignedItems("정산예정") : getItems(tf, "정산예정");
    const totalCount = unsettled.length + upcoming.length;
    if (totalCount === 0) return null;

    return (
      <div
        key={tf}
        style={{
          background: "#fff", borderRadius: 10,
          border: isUnassigned ? "2px dashed #fbbf24" : "1px solid #e5e7eb",
          padding: "16px 20px", marginBottom: 16,
          boxShadow: isUnassigned ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, marginBottom: 14, borderBottom: `2px solid ${isUnassigned ? "#fef3c7" : "#f3f4f6"}` }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: isUnassigned ? "#d97706" : "#111827" }}>
            {isUnassigned ? "⚠ TF미지정" : tf}
          </span>
          <span style={{ fontSize: 11, background: isUnassigned ? "#fef3c7" : "#f3f4f6", color: isUnassigned ? "#92400e" : "#6b7280", borderRadius: 10, padding: "2px 8px" }}>
            총 {totalCount}건
          </span>
          {isUnassigned && (
            <span style={{ fontSize: 11, color: "#b45309" }}>— 각 항목의 [TF 지정] 버튼으로 TF를 배정해주세요</span>
          )}
        </div>

        <Section
          title={`〈${isUnassigned ? "TF미지정" : tf} 미정산 리스트〉`}
          items={unsettled}
          onEdit={openEdit}
          onDelete={handleDelete}
          onTogglePaid={handleTogglePaid}
          onAssignTf={handleAssignTf}
          onAdd={() => openAdd(isUnassigned ? TF_UNASSIGNED : tf, "미정산")}
          isUnassigned={isUnassigned}
        />
        <Section
          title={`〈${isUnassigned ? "TF미지정" : tf} 정산 예정자〉`}
          items={upcoming}
          onEdit={openEdit}
          onDelete={handleDelete}
          onTogglePaid={handleTogglePaid}
          onAssignTf={handleAssignTf}
          onAdd={() => openAdd(isUnassigned ? TF_UNASSIGNED : tf, "정산예정")}
          isUnassigned={isUnassigned}
        />
      </div>
    );
  };

  const isEmpty = !loading && activeTfs.length === 0 && !hasUnassigned;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>정산 관리</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
            ■ {todayKR()} 기준&nbsp;&nbsp;★ = 지급완료
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setImportModalOpen(true)} style={btnSecondary}>
            📋 텍스트 가져오기
          </button>
          <button
            onClick={() => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }}
            style={btnPrimary}
          >
            + 새 항목 추가
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280", textAlign: "center", marginTop: 60 }}>불러오는 중...</p>
      ) : isEmpty ? (
        <div style={{ textAlign: "center", padding: "60px 0", background: "#f9fafb", borderRadius: 10, border: "2px dashed #e5e7eb" }}>
          <p style={{ color: "#9ca3af", fontSize: 15, margin: "0 0 16px" }}>등록된 정산 항목이 없습니다</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => setImportModalOpen(true)} style={btnSecondary}>📋 텍스트 가져오기</button>
            <button onClick={() => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }} style={btnPrimary}>첫 항목 추가하기</button>
          </div>
        </div>
      ) : (
        <>
          {/* TF별 카드 (ALL_TF_LIST 순서 유지) */}
          {activeTfs.map((tf) => renderTfCard(tf))}

          {/* TF미지정 섹션 — 항상 맨 아래 */}
          {hasUnassigned && renderTfCard(TF_UNASSIGNED, true)}

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button
              onClick={() => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }}
              style={{ ...btnSecondary, fontSize: 13 }}
            >
              + 새 항목 추가
            </button>
          </div>
        </>
      )}

      {importModalOpen && (
        <ImportModal onImport={handleImport} onClose={() => setImportModalOpen(false)} />
      )}

      {modalOpen && (
        <Modal
          form={form}
          onChange={setForm}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          isEdit={!!editTarget}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid #d1d5db",
  borderRadius: 6, fontSize: 13, boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 18px", background: "#2563eb", color: "#fff",
  border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 13,
};

const btnSecondary: React.CSSProperties = {
  padding: "7px 16px", background: "#fff", color: "#374151",
  border: "1.5px solid #d1d5db", borderRadius: 7, cursor: "pointer", fontSize: 13,
};

const actionBtn: React.CSSProperties = {
  padding: "2px 8px", fontSize: 11, background: "none",
  border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#6b7280",
};
