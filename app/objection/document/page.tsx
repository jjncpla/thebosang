"use client";

import { useState } from "react";

const FORM_TYPES = [
  {
    id: "cover",
    label: "청구서식 표지",
    subTypes: ["심사청구", "재심사청구", "감사원심사청구", "행정심판청구"],
  },
  { id: "reason", label: "이유서", subTypes: [] },
  { id: "agent", label: "대리인선임신고서", subTypes: [] },
  { id: "proxy", label: "위임장", subTypes: [] },
  { id: "id", label: "신분증", subTypes: [] },
  { id: "attachment", label: "이유서 첨부자료", subTypes: [] },
];

type ObjectionCase = {
  id: string;
  patientName: string;
  caseType: string;
  decisionDate: string | null;
  examClaimDate: string | null;
  reExamClaimDate: string | null;
  manager: { name: string } | null;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", borderRadius: 8, padding: "12px 24px", fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 12 }}>
      {message}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14 }}>✕</button>
    </div>
  );
}

export default function ObjectionDocumentPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ObjectionCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<ObjectionCase | null>(null);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const p = new URLSearchParams();
      if (query) p.set("search", query);
      const res = await fetch(`/api/objection/cases?${p}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  };

  const handleFormClick = (id: string) => {
    setSelectedForm(id);
    const ft = FORM_TYPES.find(f => f.id === id);
    setSelectedSub(ft?.subTypes[0] ?? "");
  };

  const handleGenerate = () => {
    setToast("준비 중인 기능입니다.");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic','Apple SD Gothic Neo','Segoe UI',sans-serif" }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>OBJECTION DOCUMENT</p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: 0 }}>이유서·의견서 작성</h1>
      </div>

      {/* Case Search */}
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "16px 18px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>사건 선택</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
            placeholder="성명 또는 TF명으로 검색"
            style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", outline: "none" }}
          />
          <button onClick={handleSearch} disabled={searching} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {searching ? "검색 중..." : "검색"}
          </button>
        </div>
        {searchResults.length > 0 && !selectedCase && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
            {searchResults.map(c => (
              <div key={c.id} onClick={() => { setSelectedCase(c); setSearchResults([]); }} style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9", color: "#374151" }} onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.background = "white"}>
                <span style={{ fontWeight: 600, color: "#111827" }}>{c.patientName}</span>
                <span style={{ marginLeft: 8, color: "#6b7280", fontSize: 12 }}>{c.caseType}</span>
              </div>
            ))}
          </div>
        )}
        {selectedCase && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "8px 12px" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>{selectedCase.patientName}</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{selectedCase.caseType}</span>
            <button onClick={() => { setSelectedCase(null); setQuery(""); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6b7280" }}>변경</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left: Form selector */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, fontWeight: 700, color: "#374151" }}>서식 선택</div>
            {FORM_TYPES.map(ft => (
              <button
                key={ft.id}
                onClick={() => handleFormClick(ft.id)}
                style={{
                  width: "100%", display: "block", padding: "11px 16px", fontSize: 13,
                  background: selectedForm === ft.id ? "#eff6ff" : "white",
                  border: "none", borderLeft: selectedForm === ft.id ? "3px solid #29ABE2" : "3px solid transparent",
                  color: selectedForm === ft.id ? "#1d4ed8" : "#374151",
                  fontWeight: selectedForm === ft.id ? 700 : 400,
                  cursor: "pointer", textAlign: "left",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                {ft.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Info card + memo */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Case info card */}
          {selectedCase && (
            <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12 }}>재해자 정보</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 16px" }}>
                {[
                  { label: "성명", value: selectedCase.patientName },
                  { label: "사건분류", value: selectedCase.caseType },
                  { label: "처분일", value: formatDate(selectedCase.decisionDate) },
                  { label: "심사청구일", value: formatDate(selectedCase.examClaimDate) },
                  { label: "재심사청구일", value: formatDate(selectedCase.reExamClaimDate) },
                  { label: "담당자", value: selectedCase.manager?.name ?? "-" },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 2 }}>{row.label}</div>
                    <div style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form action */}
          {selectedForm && (
            <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                {FORM_TYPES.find(f => f.id === selectedForm)?.label}
              </div>
              {FORM_TYPES.find(f => f.id === selectedForm)?.subTypes.length ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>서식 종류</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {FORM_TYPES.find(f => f.id === selectedForm)?.subTypes.map(st => (
                      <label key={st} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#374151", cursor: "pointer" }}>
                        <input type="radio" name="subType" value={st} checked={selectedSub === st} onChange={() => setSelectedSub(st)} />
                        {st}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedForm === "id" && (
                <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#6b7280" }}>
                  <div style={{ marginBottom: 6 }}>재해자 신분증: DB에 등록된 이미지가 없습니다. <button style={{ color: "#29ABE2", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>파일 첨부</button></div>
                  <div style={{ color: "#9ca3af" }}>대리인 신분증: 추후 일괄 DB 등록 예정</div>
                </div>
              )}
              <button onClick={handleGenerate} style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>PDF 생성</button>
            </div>
          )}

          {/* Memo */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>이유서 작성 메모</div>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="이유서 작성 시 참고할 메모를 자유롭게 입력하세요..."
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "#374151", background: "#f9fafb", outline: "none", resize: "vertical", minHeight: 160, fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => setToast("메모가 저장되었습니다.")} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 16px", fontSize: 12, color: "#374151", cursor: "pointer" }}>저장</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
