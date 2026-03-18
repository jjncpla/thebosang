"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";
import { TF_BY_BRANCH } from "@/lib/constants/tf";
import {
  FILTER_DEFINITIONS_BY_TYPE,
  FilterField,
} from "@/lib/constants/case-filter-definitions";

// ─── Types ───────────────────────────────────────────────────────────────────

type Patient = { id: string; name: string; ssn: string; phone: string | null };
type HearingLoss = {
  status: string;
  firstClinic: string | null;
  specialClinic: string | null;
  disposalType: string | null;
  grade: number | null;
  gradeType: string | null;
};
type DetailStatus = { status: string } | null;
type Case = {
  id: string;
  patientId: string;
  patient: Patient;
  caseType: string;
  caseNumber: string | null;
  tfName: string | null;
  branch: string | null;
  salesManager: string | null;
  caseManager: string | null;
  receptionDate: string | null;
  createdAt: string;
  hearingLoss: HearingLoss | null;
  copd: DetailStatus;
  pneumoconiosis: DetailStatus;
  musculoskeletal: DetailStatus;
  occupationalAccident: DetailStatus;
  occupationalCancer: DetailStatus;
  bereaved: DetailStatus;
};

function getCaseStatus(c: Case): string {
  if (c.caseType === "HEARING_LOSS") return c.hearingLoss?.status ?? "-";
  if (c.caseType === "COPD") return c.copd?.status ?? "-";
  if (c.caseType === "PNEUMOCONIOSIS") return c.pneumoconiosis?.status ?? "-";
  if (c.caseType === "MUSCULOSKELETAL") return c.musculoskeletal?.status ?? "-";
  if (c.caseType === "OCCUPATIONAL_ACCIDENT") return c.occupationalAccident?.status ?? "-";
  if (c.caseType === "OCCUPATIONAL_CANCER") return c.occupationalCancer?.status ?? "-";
  if (c.caseType === "BEREAVED") return c.bereaved?.status ?? "-";
  return "-";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_COLOR: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  "접수대기":    { bg: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA", dot: "#29ABE2" },
  "접수완료":    { bg: "#DCEEFA", color: "#1480B0", border: "1px solid #50BDEA", dot: "#29ABE2" },
  "특진예정":    { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "특진중":      { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "특진완료":    { bg: "#D0EAD9", color: "#006838", border: "1px solid #00854A", dot: "#006838" },
  "재특진예정":  { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재특진중":    { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재특진완료":  { bg: "#D0EAD9", color: "#005530", border: "1px solid #006838", dot: "#005530" },
  "재재특진예정":{ bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "재재특진중":  { bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "재재특진완료":{ bg: "#E8F5EE", color: "#004025", border: "1px solid #005530", dot: "#005530" },
  "전문예정":    { bg: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", dot: "#F59E0B" },
  "전문완료":    { bg: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", dot: "#F59E0B" },
  "승인":        { bg: "#E8F5D0", color: "#5A8A1F", border: "1px solid #A2D158", dot: "#8DC63F" },
  "불승인":      { bg: "#FEF2F2", color: "#b91c1c", border: "1px solid #FECACA", dot: "#EF4444" },
  "반려":        { bg: "#FEF2F2", color: "#b91c1c", border: "1px solid #FECACA", dot: "#EF4444" },
  "보류":        { bg: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", dot: "#94A3B8" },
  "파기":        { bg: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", dot: "#94A3B8" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOR[status] ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

// ─── Jurisdiction Modal ───────────────────────────────────────────────────────

function JurisdictionModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "white", borderRadius: 12, padding: 24, zIndex: 1000,
        maxWidth: 720, width: "90%", maxHeight: "80vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>관할표</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#6b7280", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>지사</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#6b7280", borderBottom: "2px solid #e5e7eb" }}>담당 TF</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(TF_BY_BRANCH).map(([branch, tfs]) => (
              <tr key={branch} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{branch}</td>
                <td style={{ padding: "8px 12px", color: "#6b7280", lineHeight: 1.7 }}>{tfs.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Filter value key helpers ─────────────────────────────────────────────────

function paramKey(f: FilterField, suffix?: string): string {
  const base = f.table === "hearingLoss" ? `hl_${f.field}` : f.field;
  return suffix ? `${base}_${suffix}` : base;
}

// ─── Single filter control ────────────────────────────────────────────────────

function FilterControl({
  field,
  value,
  onChange,
}: {
  field: FilterField;
  value: Record<string, string>;
  onChange: (updates: Record<string, string>) => void;
}) {
  const [dateMode, setDateMode] = useState<"single" | "range">("single");

  const inputStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 12,
    color: "#374151",
    background: "#f9fafb",
    outline: "none",
  };

  if (field.type === "multi_select") {
    const key = paramKey(field);
    const current = value[key] ?? "";
    const selected = current ? current.split(",").filter(Boolean) : [];

    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt];
      onChange({ [key]: next.join(",") });
    };

    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(field.options ?? []).map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  borderRadius: 999,
                  border: active ? "1px solid #29ABE2" : "1px solid #e5e7eb",
                  background: active ? "#eff6ff" : "#f9fafb",
                  color: active ? "#29ABE2" : "#374151",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    const key = paramKey(field);
    const listId = `dl-${field.table}-${field.field}`;
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            list={listId}
            style={{ ...inputStyle, width: 200 }}
            placeholder={`${field.label} 검색...`}
            value={value[key] ?? ""}
            onChange={(e) => onChange({ [key]: e.target.value })}
          />
          {value[key] && (
            <button
              onClick={() => onChange({ [key]: "" })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>
        <datalist id={listId}>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </div>
    );
  }

  if (field.type === "text") {
    const key = paramKey(field);
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <input
          style={{ ...inputStyle, width: 140 }}
          placeholder={field.label}
          value={value[key] ?? ""}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    const key = paramKey(field);
    const cur = value[key] ?? "";
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["", "true", "false"].map((v) => {
            const label = v === "" ? "전체" : v === "true" ? "예" : "아니오";
            const active = cur === v;
            return (
              <button
                key={v}
                onClick={() => onChange({ [key]: v })}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  borderRadius: 999,
                  border: active ? "1px solid #29ABE2" : "1px solid #e5e7eb",
                  background: active ? "#eff6ff" : "#f9fafb",
                  color: active ? "#29ABE2" : "#374151",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "number_range") {
    const minKey = paramKey(field, "min");
    const maxKey = paramKey(field, "max");
    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            style={{ ...inputStyle, width: 70 }}
            placeholder="최소"
            value={value[minKey] ?? ""}
            onChange={(e) => onChange({ [minKey]: e.target.value })}
          />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>~</span>
          <input
            type="number"
            style={{ ...inputStyle, width: 70 }}
            placeholder="최대"
            value={value[maxKey] ?? ""}
            onChange={(e) => onChange({ [maxKey]: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (field.type === "date_single_or_range") {
    const fromKey = paramKey(field, "from");
    const toKey = paramKey(field, "to");

    const handleModeChange = (mode: "single" | "range") => {
      setDateMode(mode);
      onChange({ [fromKey]: "", [toKey]: "" });
    };

    return (
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{field.label}</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 5 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
            <input
              type="radio"
              name={`mode-${field.table}-${field.field}`}
              checked={dateMode === "single"}
              onChange={() => handleModeChange("single")}
              style={{ cursor: "pointer" }}
            />
            단일
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
            <input
              type="radio"
              name={`mode-${field.table}-${field.field}`}
              checked={dateMode === "range"}
              onChange={() => handleModeChange("range")}
              style={{ cursor: "pointer" }}
            />
            범위
          </label>
        </div>
        {dateMode === "single" ? (
          <input
            type="date"
            style={{ ...inputStyle, width: 130 }}
            value={value[fromKey] ?? ""}
            onChange={(e) => onChange({ [fromKey]: e.target.value, [toKey]: e.target.value })}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="date"
              style={{ ...inputStyle, width: 130 }}
              value={value[fromKey] ?? ""}
              onChange={(e) => onChange({ [fromKey]: e.target.value })}
            />
            <span style={{ color: "#9ca3af", fontSize: 12 }}>~</span>
            <input
              type="date"
              style={{ ...inputStyle, width: 130 }}
              value={value[toKey] ?? ""}
              onChange={(e) => onChange({ [toKey]: e.target.value })}
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel, confirming }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", borderRadius: 12, padding: 28, zIndex: 1000, minWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 12 }}>삭제 확인</div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 8, whiteSpace: "pre-line" }}>{message}</div>
        <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 24 }}>이 작업은 되돌릴 수 없습니다.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={confirming} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, color: "#374151", background: "white", cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} disabled={confirming} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: confirming ? 0.6 : 1 }}>
            {confirming ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Body Part Data ───────────────────────────────────────────────────────────

const BODY_DISEASES: Record<string, string[]> = {
  "경추": ["추간판탈출증", "협착증", "경추 골절"],
  "어깨": ["회전근개파열", "충돌증후군", "관절와순손상", "석회화건염"],
  "상완/팔꿈치": ["외측상과염", "내측상과염", "주관절 골절"],
  "흉추": ["추간판탈출증", "압박골절"],
  "요추": ["추간판탈출증", "협착증", "척추전방전위증", "골절"],
  "골반/고관절": ["고관절 골절", "대퇴골두무혈성괴사", "골관절염"],
  "슬관절": ["골관절염", "반월상연골판손상", "인공관절", "전방십자인대손상"],
  "족관절/발": ["족저근막염", "골절", "연골손상"],
};

const CANCER_TYPES = ["폐암", "방광암", "혈액암", "중피종", "기타"];

// ─── Body Part Panel ──────────────────────────────────────────────────────────

function BodyPartPanel({
  selectedPart,
  onPartClick,
  onCaseTypeChange,
  selectedCaseType,
}: {
  selectedPart: string | null;
  onPartClick: (part: string | null) => void;
  onCaseTypeChange: (type: string) => void;
  selectedCaseType: string;
}) {
  const PLANNED = [
    { key: "HEARING_LOSS", label: "소음성난청" },
    { key: "COPD", label: "COPD" },
    { key: "PNEUMOCONIOSIS", label: "진폐증" },
  ];

  // SVG body parts — coordinates for simple human silhouette
  const svgParts: { id: string; label: string; shape: React.ReactNode }[] = [
    { id: "머리", label: "머리", shape: <ellipse cx="60" cy="22" rx="18" ry="20" /> },
    { id: "경추", label: "경추", shape: <rect x="53" y="43" width="14" height="14" rx="3" /> },
    { id: "어깨", label: "어깨(좌)", shape: <ellipse cx="30" cy="62" rx="14" ry="10" /> },
    { id: "어깨R", label: "어깨(우)", shape: <ellipse cx="90" cy="62" rx="14" ry="10" /> },
    { id: "흉추", label: "흉부", shape: <rect x="43" y="58" width="34" height="36" rx="5" /> },
    { id: "상완/팔꿈치", label: "팔(좌)", shape: <rect x="14" y="72" width="12" height="34" rx="6" /> },
    { id: "상완/팔꿈치R", label: "팔(우)", shape: <rect x="94" y="72" width="12" height="34" rx="6" /> },
    { id: "요추", label: "요추", shape: <rect x="46" y="96" width="28" height="24" rx="4" /> },
    { id: "골반/고관절", label: "골반", shape: <ellipse cx="60" cy="130" rx="24" ry="12" /> },
    { id: "슬관절", label: "슬관절(좌)", shape: <rect x="38" y="148" width="14" height="28" rx="6" /> },
    { id: "슬관절R", label: "슬관절(우)", shape: <rect x="68" y="148" width="14" height="28" rx="6" /> },
    { id: "족관절/발", label: "발목(좌)", shape: <rect x="38" y="180" width="14" height="18" rx="4" /> },
    { id: "족관절/발R", label: "발목(우)", shape: <rect x="68" y="180" width="14" height="18" rx="4" /> },
  ];

  const normalizePartId = (id: string) => id.replace(/R$/, "");
  const activePart = selectedPart;

  return (
    <div style={{ padding: "14px 16px" }}>
      {/* 기획사건 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>기획사건</div>
        <div style={{ display: "flex", gap: 6 }}>
          {PLANNED.map(p => (
            <button
              key={p.key}
              onClick={() => { onCaseTypeChange(p.key); onPartClick(null); }}
              style={{
                padding: "6px 16px", fontSize: 13, borderRadius: 6, cursor: "pointer",
                border: selectedCaseType === p.key ? "1px solid #29ABE2" : "1px solid #e5e7eb",
                background: selectedCaseType === p.key ? "#eff6ff" : "#f9fafb",
                color: selectedCaseType === p.key ? "#29ABE2" : "#374151",
                fontWeight: selectedCaseType === p.key ? 700 : 400,
              }}
            >{p.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* SVG Body */}
        <div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>일반산재 — 부위 선택</div>
          <svg width="120" height="210" viewBox="0 0 120 210" style={{ display: "block" }}>
            {svgParts.map(p => {
              const baseId = normalizePartId(p.id);
              const isActive = activePart === baseId;
              return (
                <g key={p.id} onClick={() => { onCaseTypeChange("MUSCULOSKELETAL"); onPartClick(isActive && p.id === baseId ? null : baseId); }} style={{ cursor: "pointer" }}>
                  <g fill={isActive ? "#29ABE2" : "#94a3b8"} fillOpacity={isActive ? 0.85 : 0.5} stroke={isActive ? "#1A95C8" : "#64748b"} strokeWidth="1">
                    {p.shape}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Disease list for selected part */}
        <div style={{ flex: 1 }}>
          {activePart && BODY_DISEASES[activePart] && (
            <div>
              <div style={{ fontSize: 11, color: "#374151", fontWeight: 700, marginBottom: 8 }}>{activePart} — 상병 선택</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {BODY_DISEASES[activePart].map(d => (
                  <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", cursor: "pointer" }}>
                    <input type="checkbox" style={{ cursor: "pointer" }} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
          )}
          {!activePart && (
            <div style={{ color: "#9ca3af", fontSize: 12 }}>좌측 인체 부위를 클릭하면<br />해당 부위의 상병 목록이 표시됩니다.</div>
          )}
        </div>

        {/* 직업성 암 */}
        <div>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>직업성 암</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {CANCER_TYPES.map(c => (
              <button
                key={c}
                onClick={() => { onCaseTypeChange("OCCUPATIONAL_CANCER"); onPartClick(null); }}
                style={{
                  padding: "5px 14px", fontSize: 12, borderRadius: 5, cursor: "pointer", textAlign: "left",
                  border: "1px solid #e5e7eb", background: selectedCaseType === "OCCUPATIONAL_CANCER" ? "#fdf4ff" : "#f9fafb",
                  color: selectedCaseType === "OCCUPATIONAL_CANCER" ? "#7c3aed" : "#374151",
                }}
              >{c}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedTf, setSelectedTf] = useState("");
  const [selectedCaseType, setSelectedCaseType] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showJurisdiction, setShowJurisdiction] = useState(false);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [showBodyPanel, setShowBodyPanel] = useState(false);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);

  const tfList = selectedBranch ? TF_BY_BRANCH[selectedBranch] ?? [] : [];
  const filterFields: FilterField[] = selectedCaseType
    ? FILTER_DEFINITIONS_BY_TYPE[selectedCaseType] ?? []
    : [];

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTf) params.set("tfName", selectedTf);
      if (selectedCaseType) params.set("caseType", selectedCaseType);
      if (search) params.set("search", search);

      for (const [k, v] of Object.entries(activeFilters)) {
        if (v) params.set(k, v);
      }

      const res = await fetch(`/api/cases?${params}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: Case[] = await res.json();
      setCases(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [selectedTf, selectedCaseType, search, activeFilters]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const updateFilter = (updates: Record<string, string>) => {
    setActiveFilters((prev) => ({ ...prev, ...updates }));
  };

  const resetFilters = () => {
    setActiveFilters({});
    setSearch("");
  };

  const allChecked = cases.length > 0 && checkedIds.size === cases.length;
  const toggleAll = () => {
    setCheckedIds(allChecked ? new Set() : new Set(cases.map(c => c.id)));
  };
  const toggleOne = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setDeleteConfirming(true);
    try {
      const res = await fetch("/api/cases/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: [...checkedIds] }),
      });
      if (!res.ok) throw new Error("삭제 실패");
      setCheckedIds(new Set());
      setDeleteModal(false);
      fetchCases();
    } catch {
      alert("삭제 중 오류가 발생했습니다");
    } finally {
      setDeleteConfirming(false);
      setDeleteModal(false);
    }
  };

  // ─── Columns ─────────────────────────────────────────────────────────────
  const isHearingLoss = selectedCaseType === "HEARING_LOSS";
  const COLUMNS = isHearingLoss
    ? ["연번", "성명", "TF", "영업담당자", "실무담당자", "진행상황", "초진병원", "특진병원", "처분결과", "장해등급", "접수일자"]
    : ["연번", "성명", "사건유형", "TF", "담당자", "진행상황", "접수일자"];

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      {showJurisdiction && <JurisdictionModal onClose={() => setShowJurisdiction(false)} />}
      {deleteModal && (
        <ConfirmModal
          message={`선택한 ${checkedIds.size}건의 사건을 삭제합니다.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setDeleteModal(false)}
          confirming={deleteConfirming}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>CASE MANAGEMENT</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: 0 }}>사건 목록</h1>
            {!loading && !error && (
              <span style={{ background: "#e0e7ff", color: "#3730a3", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999 }}>
                {cases.length}건
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {checkedIds.size > 0 && (
            <button
              onClick={() => setDeleteModal(true)}
              style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              선택 {checkedIds.size}건 삭제
            </button>
          )}
          <button
            onClick={() => setShowJurisdiction(true)}
            style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            관할표 보기
          </button>
          <button
            onClick={() => router.push("/cases/new")}
            style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            + 새 사건 등록
          </button>
        </div>
      </div>

      {/* Step 1 & 2: 지사 → TF 선택 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>지사 선택</label>
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setSelectedTf(""); }}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer", minWidth: 200 }}
            >
              <option value="">전체 지사</option>
              {Object.keys(TF_BY_BRANCH).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {selectedBranch && (
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, display: "block", marginBottom: 4 }}>TF 선택</label>
              <select
                value={selectedTf}
                onChange={(e) => setSelectedTf(e.target.value)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer", minWidth: 180 }}
              >
                <option value="">전체 TF</option>
                {tfList.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: 상병 선택 */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>상병 선택</div>
          <button
            onClick={() => setShowBodyPanel(v => !v)}
            style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 5, cursor: "pointer",
              border: showBodyPanel ? "1px solid #29ABE2" : "1px solid #e5e7eb",
              background: showBodyPanel ? "#eff6ff" : "#f9fafb",
              color: showBodyPanel ? "#29ABE2" : "#6b7280",
              fontWeight: showBodyPanel ? 700 : 400,
            }}
          >🫀 상병으로 보기</button>
        </div>
        {showBodyPanel && (
          <BodyPartPanel
            selectedPart={selectedBodyPart}
            onPartClick={setSelectedBodyPart}
            onCaseTypeChange={(type) => { setSelectedCaseType(type); setActiveFilters({}); }}
            selectedCaseType={selectedCaseType}
          />
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setSelectedCaseType(""); setActiveFilters({}); }}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              borderRadius: 6,
              border: selectedCaseType === "" ? "1px solid #29ABE2" : "1px solid #e5e7eb",
              background: selectedCaseType === "" ? "#eff6ff" : "#f9fafb",
              color: selectedCaseType === "" ? "#29ABE2" : "#374151",
              cursor: "pointer",
              fontWeight: selectedCaseType === "" ? 700 : 400,
            }}
          >
            전체
          </button>
          {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => { setSelectedCaseType(k); setActiveFilters({}); }}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                borderRadius: 6,
                border: selectedCaseType === k ? "1px solid #29ABE2" : "1px solid #e5e7eb",
                background: selectedCaseType === k ? "#eff6ff" : "#f9fafb",
                color: selectedCaseType === k ? "#29ABE2" : "#374151",
                cursor: "pointer",
                fontWeight: selectedCaseType === k ? 700 : 400,
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Filters */}
      {filterFields.length > 0 && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {filterFields.map((f) => (
              <FilterControl
                key={`${f.table}_${f.field}`}
                field={f}
                value={activeFilters}
                onChange={updateFilter}
              />
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              onClick={resetFilters}
              style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "#6b7280", background: "#f9fafb", cursor: "pointer" }}
            >
              필터 초기화
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <input
          type="text"
          placeholder="이름, 주민번호, 전화번호 뒷 4자리 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", outline: "none", width: 280, background: "#f9fafb" }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {error && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", fontSize: 13, borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10 }}>
            ⚠ {error}
            <button onClick={fetchCases} style={{ color: "#29ABE2", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>다시 시도</button>
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ padding: "10px 12px", width: 36 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: "pointer" }} />
              </th>
              {COLUMNS.map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "14px 12px" }} />
                {COLUMNS.map((_, j) => (
                  <td key={j} style={{ padding: "14px 16px" }}>
                    <div style={{ height: 12, background: "#f1f5f9", borderRadius: 4, width: 60 + (j % 3) * 20 }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && cases.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} style={{ padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  등록된 사건이 없습니다
                </td>
              </tr>
            )}
            {!loading && cases.map((c, idx) => (
              <tr
                key={c.id}
                onClick={() => router.push(c.caseType === "HEARING_LOSS" ? `/cases/${c.id}` : `/patients/${c.patient.id}?tab=${c.caseType}`)}
                style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: checkedIds.has(c.id) ? "#fef2f2" : "white" }}
                onMouseEnter={(e) => { if (!checkedIds.has(c.id)) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = checkedIds.has(c.id) ? "#fef2f2" : "white"; }}
              >
                <td style={{ padding: "12px 12px" }} onClick={(e) => { e.stopPropagation(); toggleOne(c.id); }}>
                  <input type="checkbox" checked={checkedIds.has(c.id)} onChange={() => toggleOne(c.id)} style={{ cursor: "pointer" }} />
                </td>
                {isHearingLoss ? (
                  <>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{c.patient.name}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.tfName ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.salesManager ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.caseManager ?? "-"}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={getCaseStatus(c)} /></td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.hearingLoss?.firstClinic ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.hearingLoss?.specialClinic ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.hearingLoss?.disposalType ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>
                      {c.hearingLoss?.grade != null ? `${c.hearingLoss.grade}급` : "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(c.receptionDate ?? c.createdAt)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{c.patient.name}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{CASE_TYPE_LABELS[c.caseType] ?? c.caseType}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.tfName ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.caseManager ?? "-"}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={getCaseStatus(c)} /></td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(c.receptionDate ?? c.createdAt)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
