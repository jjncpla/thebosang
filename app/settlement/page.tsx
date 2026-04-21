"use client";

import { useEffect, useState, useCallback } from "react";

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
  tfGroup: "",
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

// label: "(6급(근골)/울산지사/홍)"
function entryLabel(item: SettlementItem) {
  const parts = [item.grade, item.branchName, item.managerName].filter(Boolean);
  return parts.length ? `(${parts.join("/")})` : "";
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({
  form,
  tfGroups,
  onChange,
  onSave,
  onClose,
  isEdit,
}: {
  form: Omit<SettlementItem, "id" | "sortOrder">;
  tfGroups: string[];
  onChange: (f: Omit<SettlementItem, "id" | "sortOrder">) => void;
  onSave: () => void;
  onClose: () => void;
  isEdit: boolean;
}) {
  const set = (key: keyof typeof form, val: unknown) => onChange({ ...form, [key]: val });

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 10, padding: 28, width: 480, maxWidth: "95vw",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>
          {isEdit ? "항목 수정" : "항목 추가"}
        </h3>

        {/* TF 그룹 */}
        <label style={labelStyle}>TF 그룹 *</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <input
            list="tf-group-list"
            value={form.tfGroup}
            onChange={(e) => set("tfGroup", e.target.value)}
            placeholder="예: 울산/울동 TF"
            style={{ ...inputStyle, flex: 1 }}
          />
          <datalist id="tf-group-list">
            {tfGroups.map((g) => <option key={g} value={g} />)}
          </datalist>
        </div>

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
}: {
  item: SettlementItem;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}) {
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
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 16, lineHeight: 1, padding: 0, marginTop: 1,
          color: item.isPaid ? "#eab308" : "#d1d5db",
        }}
      >★</button>

      {/* content */}
      <span style={{ flex: 1, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>
        <span style={{ fontWeight: 600 }}>{item.victimName}</span>
        <span style={{ color: "#6b7280" }}>{entryLabel(item)}</span>
        {dateStr !== "-" && (
          <span style={{ color: "#374151" }}> : {dateStr}</span>
        )}
        {item.isInstallment && (
          <span style={{ color: "#9333ea", fontWeight: 500 }}>
            {" "}(분할 납부중)
            {item.paidAmount != null && item.totalAmount != null && (
              <> {item.paidAmount}/{item.totalAmount}</>
            )}
          </span>
        )}
        {item.status && !item.isInstallment && (
          <span style={{ color: "#6b7280" }}> ({item.status})</span>
        )}
        {item.memo && (
          <span style={{ color: "#9ca3af", fontSize: 12 }}> — {item.memo}</span>
        )}
      </span>

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
  onAdd,
}: {
  title: string;
  items: SettlementItem[];
  onEdit: (item: SettlementItem) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (item: SettlementItem) => void;
  onAdd: () => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>{title}</span>
        <span style={{
          fontSize: 11, background: "#eff6ff", color: "#2563eb",
          borderRadius: 10, padding: "1px 8px", fontWeight: 600,
        }}>{items.length}건</span>
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
          />
        ))
      )}
      <button onClick={onAdd} style={{
        marginTop: 4, marginLeft: 24, fontSize: 12, color: "#2563eb",
        background: "none", border: "none", cursor: "pointer", padding: 0,
      }}>
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
  const [editTarget, setEditTarget] = useState<SettlementItem | null>(null);
  const [form, setForm] = useState<Omit<SettlementItem, "id" | "sortOrder">>(EMPTY_FORM);
  const [defaultTfGroup, setDefaultTfGroup] = useState("");
  const [defaultCategory, setDefaultCategory] = useState<Category>("정산예정");

  const load = useCallback(async () => {
    const res = await fetch("/api/settlement");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // TF 그룹 목록 (기존 + 기본 목록)
  const tfGroups = Array.from(new Set([
    ...items.map((i) => i.tfGroup),
    "울산/울동 TF",
    "울산동부/울산남부/울산북부/양산TF",
    "부산/부중 TF",
    "창원 TF",
    "포항/구미 TF",
    "대구 TF",
    "서울북부 TF",
    "동해 TF",
    "안산 TF",
    "의정부 TF",
    "대전 TF",
    "수원 TF",
    "경인 TF",
    "구로 TF",
  ])).filter(Boolean);

  // 그룹별 데이터
  const groupedTfs = Array.from(new Set(items.map((i) => i.tfGroup))).sort();

  function openAdd(tfGroup: string, category: Category) {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, tfGroup, category });
    setDefaultTfGroup(tfGroup);
    setDefaultCategory(category);
    setModalOpen(true);
  }

  function openEdit(item: SettlementItem) {
    setEditTarget(item);
    setForm({
      tfGroup: item.tfGroup,
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
    if (!form.tfGroup.trim()) { alert("TF 그룹을 입력해주세요."); return; }

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

  const getItems = (tfGroup: string, category: Category) =>
    items.filter((i) => i.tfGroup === tfGroup && i.category === category);

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
        <button
          onClick={() => {
            setEditTarget(null);
            setForm(EMPTY_FORM);
            setModalOpen(true);
          }}
          style={btnPrimary}
        >
          + 새 항목 추가
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280", textAlign: "center", marginTop: 60 }}>불러오는 중...</p>
      ) : groupedTfs.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 0", background: "#f9fafb",
          borderRadius: 10, border: "2px dashed #e5e7eb",
        }}>
          <p style={{ color: "#9ca3af", fontSize: 15, margin: "0 0 16px" }}>
            등록된 정산 항목이 없습니다
          </p>
          <button
            onClick={() => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }}
            style={btnPrimary}
          >
            첫 항목 추가하기
          </button>
        </div>
      ) : (
        groupedTfs.map((tfGroup) => {
          const unsettled = getItems(tfGroup, "미정산");
          const upcoming = getItems(tfGroup, "정산예정");
          const totalCount = unsettled.length + upcoming.length;

          return (
            <div
              key={tfGroup}
              style={{
                background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb",
                padding: "16px 20px", marginBottom: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {/* TF 그룹 헤더 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                paddingBottom: 12, marginBottom: 14, borderBottom: "2px solid #f3f4f6",
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                  &lt;{tfGroup}&gt;
                </span>
                <span style={{
                  fontSize: 11, background: "#f3f4f6", color: "#6b7280",
                  borderRadius: 10, padding: "2px 8px",
                }}>총 {totalCount}건</span>
              </div>

              {/* 미정산 리스트 */}
              <Section
                title={`〈${tfGroup} 미정산 리스트〉`}
                items={unsettled}
                onEdit={openEdit}
                onDelete={handleDelete}
                onTogglePaid={handleTogglePaid}
                onAdd={() => openAdd(tfGroup, "미정산")}
              />

              {/* 정산 예정자 */}
              <Section
                title={`〈${tfGroup} 정산 예정자〉`}
                items={upcoming}
                onEdit={openEdit}
                onDelete={handleDelete}
                onTogglePaid={handleTogglePaid}
                onAdd={() => openAdd(tfGroup, "정산예정")}
              />
            </div>
          );
        })
      )}

      {/* 새 TF 그룹 추가 버튼 */}
      {groupedTfs.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            onClick={() => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }}
            style={{ ...btnSecondary, fontSize: 13 }}
          >
            + 새 TF 그룹에 항목 추가
          </button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal
          form={form}
          tfGroups={tfGroups}
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
