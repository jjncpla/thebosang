"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_TYPE_LABELS, CASE_STATUS_LABELS, CASE_STATUS_COLORS, DEFAULT_STATUS_COLOR } from "@/lib/constants/case";
import { useBranches } from "@/lib/hooks/useBranches";
import {
  FILTER_DEFINITIONS_BY_TYPE,
  FilterField,
} from "@/lib/constants/case-filter-definitions";

// ─── Types ───────────────────────────────────────────────────────────────────

type Patient = { id: string; name: string; ssn: string; phone: string | null };
type HearingLoss = {
  firstClinic: string | null;
  specialClinic: string | null;
  decisionType: string | null;     // 처분결과 (APPROVED/REJECTED)
  disabilityGrade: string | null;  // 장해등급
};
type DetailStatus = { status: string } | null;
type Case = {
  id: string;
  status: string;
  patientId: string;
  patient: Patient;
  caseType: string;
  tfName: string | null;
  branch: string | null;
  salesManager: string | null;
  caseManager: string | null;
  receptionDate: string | null;
  kwcOfficeName: string | null;
  kwcOfficerName: string | null;
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
  if (c.caseType === "HEARING_LOSS") return c.status;
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
  const displayStatus = CASE_STATUS_LABELS[status] ?? status;
  const enumColor = CASE_STATUS_COLORS[status];
  const labelColor = STATUS_COLOR[displayStatus];
  const s = enumColor
    ? { bg: enumColor.bg, color: enumColor.color, border: `1px solid ${enumColor.border}`, dot: enumColor.border }
    : labelColor ?? { bg: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dot: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {displayStatus}
    </span>
  );
}

// ─── Jurisdiction Modal ───────────────────────────────────────────────────────

function JurisdictionModal({ onClose }: { onClose: () => void }) {
  const { tfByBranch: TF_BY_BRANCH } = useBranches();
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
            <tr style={{ background: "#29ABE2" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#fff", borderBottom: "2px solid #1A8BBF", whiteSpace: "nowrap" }}>지사</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#fff", borderBottom: "2px solid #1A8BBF" }}>담당 TF</th>
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
                {CASE_STATUS_LABELS[opt] ?? opt}
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
// ─── Unscheduled Exam Panel ──────────────────────────────────────────────────

type UnscheduledItem = {
  id: string;
  examRequestReceivedAt: string;
  specialClinic: string | null;
  case: {
    id: string;
    patient: { name: string; phone: string | null };
  } | null;
};

function UnscheduledExamPanel({ onNavigate }: { onNavigate: (caseId: string) => void }) {
  const [grouped, setGrouped] = useState<Record<string, UnscheduledItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [filterClinic, setFilterClinic] = useState<string>("");

  useEffect(() => {
    fetch("/api/hearing-loss/unscheduled")
      .then((r) => r.json())
      .then((data) => { setGrouped(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const clinics = Object.keys(grouped);
  const totalCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
  const displayClinic = filterClinic || null;
  const displayGroups = displayClinic
    ? { [displayClinic]: grouped[displayClinic] ?? [] }
    : grouped;

  if (loading) return null;

  return (
    <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, marginBottom: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>1차 특진 일정 미정 재해자 현황</span>
          <span style={{ background: totalCount > 0 ? "#dc2626" : "#f97316", color: "white", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{totalCount}건</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>진찰요구서 수령 후 1차 특진일정이 없는 건</span>
        </div>
        <span style={{ fontSize: 12, color: "#c2410c" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {totalCount === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              조회된 내용이 없습니다. (모든 재해자의 1차 특진 일정이 등록되어 있거나, 진찰요구서 수령건이 없습니다)
            </div>
          ) : (
            <>
              {/* 병원별 필터 */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <button
                  onClick={() => setFilterClinic("")}
                  style={{ padding: "4px 12px", fontSize: 12, borderRadius: 999, border: !filterClinic ? "1px solid #ea580c" : "1px solid #e5e7eb", background: !filterClinic ? "#fff7ed" : "#f9fafb", color: !filterClinic ? "#c2410c" : "#374151", cursor: "pointer", fontWeight: !filterClinic ? 700 : 400 }}
                >전체</button>
                {clinics.map((clinic) => (
                  <button
                    key={clinic}
                    onClick={() => setFilterClinic(clinic === filterClinic ? "" : clinic)}
                    style={{ padding: "4px 12px", fontSize: 12, borderRadius: 999, border: filterClinic === clinic ? "1px solid #ea580c" : "1px solid #e5e7eb", background: filterClinic === clinic ? "#fff7ed" : "#f9fafb", color: filterClinic === clinic ? "#c2410c" : "#374151", cursor: "pointer", fontWeight: filterClinic === clinic ? 700 : 400 }}
                  >
                    {clinic} ({grouped[clinic].length}건)
                  </button>
                ))}
              </div>

              {/* 그룹별 표 */}
              {Object.entries(displayGroups).map(([clinic, items]) => (
                <div key={clinic} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#c2410c", marginBottom: 6, padding: "4px 10px", background: "#ffedd5", borderRadius: 5, display: "inline-block" }}
                  >
                    🏥 {clinic} — {items.length}건
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#fef3c7" }}>
                        <th style={{ padding: "5px 10px", textAlign: "left", fontWeight: 600, color: "#78350f", borderBottom: "1px solid #fde68a" }}>성명</th>
                        <th style={{ padding: "5px 10px", textAlign: "left", fontWeight: 600, color: "#78350f", borderBottom: "1px solid #fde68a" }}>연락처</th>
                        <th style={{ padding: "5px 10px", textAlign: "left", fontWeight: 600, color: "#78350f", borderBottom: "1px solid #fde68a" }}>진찰요구서 수령일</th>
                        <th style={{ padding: "5px 10px", textAlign: "left", fontWeight: 600, color: "#78350f", borderBottom: "1px solid #fde68a" }}>바로가기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const d = new Date(item.examRequestReceivedAt);
                        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                        return (
                          <tr key={item.id} style={{ borderBottom: "1px solid #fef3c7" }}>
                            <td style={{ padding: "6px 10px", fontWeight: 600, color: "#111827" }}>{item.case?.patient.name ?? "-"}</td>
                            <td style={{ padding: "6px 10px", color: "#374151" }}>{item.case?.patient.phone ?? "-"}</td>
                            <td style={{ padding: "6px 10px", color: "#374151" }}>{dateStr}</td>
                            <td style={{ padding: "6px 10px" }}>
                              {item.case?.id && (
                                <button
                                  onClick={() => onNavigate(item.case!.id)}
                                  style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                                >일정 등록 →</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const CASES_CACHE_PREFIX = "tbss:cases-cache:v1:";
const CASES_PAGE_SIZE = 200;

function buildCacheKey(filters: Record<string, string>): string {
  const ordered = Object.keys(filters).sort().map((k) => `${k}=${filters[k] ?? ""}`).join("&");
  return CASES_CACHE_PREFIX + ordered;
}

function readCachedCases(key: string): Case[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function writeCachedCases(key: string, cases: Case[]) {
  if (typeof window === "undefined") return;
  try {
    // 캐시 슬림화: 표시에 필요한 필드만 저장 (용량 절감)
    const slim = cases.slice(0, CASES_PAGE_SIZE);
    window.localStorage.setItem(key, JSON.stringify(slim));
  } catch { /* quota exceeded → 무시 */ }
}

export default function CasesPage() {
  const { tfByBranch: TF_BY_BRANCH } = useBranches();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  // loading 기본값 false: 캐시가 있으면 흐린 화면 즉시 사라짐
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedTf, setSelectedTf] = useState("");
  const [selectedCaseType, setSelectedCaseType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showJurisdiction, setShowJurisdiction] = useState(false);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  // debounce: 400ms 후에만 실제 API 쿼리에 반영
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const tfList = selectedBranch ? TF_BY_BRANCH[selectedBranch] ?? [] : [];
  const filterFields: FilterField[] = selectedCaseType
    ? FILTER_DEFINITIONS_BY_TYPE[selectedCaseType] ?? []
    : [];

  const abortRef = useRef<AbortController | null>(null);

  // 현재 필터 조합 → 캐시 키
  const filterSnapshot = useCallback(() => {
    const snap: Record<string, string> = {};
    if (selectedTf) snap.tfName = selectedTf;
    if (selectedCaseType) snap.caseType = selectedCaseType;
    if (filterStatus) snap.status = filterStatus;
    if (search) snap.search = search;
    for (const [k, v] of Object.entries(activeFilters)) if (v) snap[k] = v;
    return snap;
  }, [selectedTf, selectedCaseType, filterStatus, search, activeFilters]);

  const fetchCases = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const snap = filterSnapshot();
    const cacheKey = buildCacheKey(snap);

    // 캐시 즉시 표시 (있으면 흐린 화면 없이 데이터 표시)
    const cached = readCachedCases(cacheKey);
    const hadCache = cached && cached.length > 0;
    if (hadCache) {
      setCases(cached!);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams(snap);
      params.set("limit", String(CASES_PAGE_SIZE));
      params.set("paginate", "true");
      params.set("count", "true");

      const res = await fetch(`/api/cases?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const json = await res.json();
      const items: Case[] = json.items ?? [];
      const nextCursor: string | null = json.nextCursor ?? null;
      const total: number | null = typeof json.total === "number" ? json.total : null;

      setCases(items);
      setHasMore(Boolean(nextCursor));
      setTotalCount(total);
      writeCachedCases(cacheKey, items);
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterSnapshot]);

  // 더 불러오기 (cursor 페이지네이션)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || cases.length === 0) return;
    setLoadingMore(true);
    try {
      const snap = filterSnapshot();
      const params = new URLSearchParams(snap);
      params.set("limit", String(CASES_PAGE_SIZE));
      params.set("paginate", "true");
      params.set("cursor", cases[cases.length - 1].id);
      const res = await fetch(`/api/cases?${params}`);
      if (!res.ok) throw new Error("더 불러오기 실패");
      const json = await res.json();
      const items: Case[] = json.items ?? [];
      setCases((prev) => [...prev, ...items]);
      setHasMore(Boolean(json.nextCursor));
    } catch {
      // 무시 (재시도 가능)
    } finally {
      setLoadingMore(false);
    }
  }, [cases, hasMore, loadingMore, filterSnapshot]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const updateFilter = (updates: Record<string, string>) => {
    setActiveFilters((prev) => ({ ...prev, ...updates }));
  };

  const resetFilters = () => {
    setActiveFilters({});
    setSearchInput("");
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
    ? ["연번", "성명", "TF", "영업담당자", "실무담당자", "진행상황", "초진병원", "특진병원", "처분결과", "장해등급", "공단지사", "지사담당자", "접수일자"]
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
                {totalCount !== null
                  ? (cases.length < totalCount ? `${cases.length} / ${totalCount}건` : `${totalCount}건`)
                  : `${cases.length}건`}
              </span>
            )}
            {refreshing && (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>갱신 중…</span>
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
            onClick={() => router.push("/cases/import-small")}
            style={{ background: "white", color: "#005530", border: "1px solid #00854A", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            title="이산 신규 사건(소음성 난청) 소량 엑셀 임포트"
          >
            📥 소량 임포트
          </button>
          <button
            onClick={() => router.push("/cases/new")}
            style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            + 새 사건 등록
          </button>
        </div>
      </div>

      {/* ─── 1차 특진 미정 현황 패널 (소음성 난청 선택 시) ─── */}
      {selectedCaseType === "HEARING_LOSS" && (
        <UnscheduledExamPanel onNavigate={(caseId) => router.push(`/cases/${caseId}`)} />
      )}

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
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>상병 선택</div>
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
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <input
          type="text"
          placeholder="이름, 주민번호, 전화번호 뒷 4자리 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "#374151", outline: "none", width: 280, background: "#f9fafb" }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#374151", background: "#f9fafb", cursor: "pointer" }}
        >
          <option value="">진행상황 전체</option>
          {Object.entries(CASE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
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
            <tr style={{ background: "#29ABE2", borderBottom: "2px solid #1A8BBF" }}>
              <th style={{ padding: "10px 12px", width: 36 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: "pointer" }} />
              </th>
              {COLUMNS.map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
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
                onClick={() => router.push(`/patients/${c.patientId}?tab=${c.caseType}`)}
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
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.hearingLoss?.firstClinic ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.hearingLoss?.specialClinic ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>
                      {c.hearingLoss?.decisionType === "APPROVED" ? "승인" : c.hearingLoss?.decisionType === "REJECTED" ? "불승인" : "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>
                      {c.hearingLoss?.disabilityGrade ?? "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.kwcOfficeName ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.kwcOfficerName ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(c.receptionDate ?? c.createdAt)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>{c.patient.name}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{CASE_TYPE_LABELS[c.caseType] ?? c.caseType}</td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>{c.tfName ?? "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{c.caseManager ?? "-"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{formatDate(c.receptionDate ?? c.createdAt)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && !loading && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                background: loadingMore ? "#e5e7eb" : "#fff",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                padding: "8px 24px",
                fontSize: 13,
                fontWeight: 600,
                cursor: loadingMore ? "not-allowed" : "pointer",
              }}
            >
              {loadingMore ? "불러오는 중…" : `더 불러오기 (${CASES_PAGE_SIZE}건씩)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
