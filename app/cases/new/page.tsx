"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CASE_TYPE_LABELS } from "@/lib/constants/case";
import { TF_BY_BRANCH, TF_TO_BRANCH } from "@/lib/constants/tf";
import { ALL_STAFF } from "@/lib/constants/staff";

const S = { fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" };

type Patient = { id: string; name: string; ssn: string; phone: string | null; address: string | null };

const SALES_ROUTES = ["직접", "제휴", "소개", "온라인", "기타"];

function LabelInput({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
        {label}{required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "#374151", outline: "none", background: "white", width: "100%", boxSizing: "border-box",
};

export default function NewCasePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  // 새 재해자 폼
  const [newPatient, setNewPatient] = useState({ name: "", ssn: "", phone: "", address: "" });

  // 사건 정보 폼
  const [caseForm, setCaseForm] = useState({
    caseType: "HEARING_LOSS",
    caseNumber: "",
    tfName: "",
    branch: "",
    subAgent: "",
    branchManager: "",
    salesManager: "",
    caseManager: "",
    salesRoute: "",
    contractDate: "",
    isOneStop: false,
    memo: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromConsultationId, setFromConsultationId] = useState<string | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  // 쿼리 파라미터 처리
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const pid = sp.get("patientId");
    const from = sp.get("from");
    const consultId = sp.get("id");

    if (pid) {
      fetch(`/api/patients/${pid}`)
        .then((r) => r.json())
        .then((p: Patient) => { setSelectedPatient(p); setStep(2); })
        .catch(() => {});
    } else if (from === "consultation" && consultId) {
      setFromConsultationId(consultId);
      fetch(`/api/consultation/${consultId}`)
        .then((r) => r.json())
        .then((c: { name: string; phone: string; ssn?: string; address?: string; caseTypes?: string[] }) => {
          const filled = new Set<string>();
          const updates: Partial<typeof newPatient> = {};
          if (c.name) { updates.name = c.name; filled.add("name"); }
          if (c.phone) { updates.phone = c.phone; filled.add("phone"); }
          if (c.ssn) { updates.ssn = c.ssn; filled.add("ssn"); }
          if (c.address) { updates.address = c.address; filled.add("address"); }
          setNewPatient((prev) => ({ ...prev, ...updates }));
          setAutoFilledFields(filled);
          if (c.caseTypes && c.caseTypes.length > 0) {
            const typeMap: Record<string, string> = {
              "소음성난청": "HEARING_LOSS", "COPD": "COPD", "진폐": "PNEUMOCONIOSIS",
              "근골격계": "MUSCULOSKELETAL", "업무상사고": "OCCUPATIONAL_ACCIDENT",
              "직업성암": "OCCUPATIONAL_CANCER", "뇌심혈관계": "CARDIOVASCULAR",
              "유족": "BEREAVED", "기타": "OTHER",
            };
            const mapped = typeMap[c.caseTypes[0]];
            if (mapped) setCaseForm((prev) => ({ ...prev, caseType: mapped }));
          }
          setShowNewPatientForm(true);
        })
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const searchPatients = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } finally {
      setSearching(false);
    }
  };

  const createNewPatientAndProceed = async () => {
    if (!newPatient.name || !newPatient.ssn) {
      setError("이름과 주민번호는 필수입니다");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPatient),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "등록 실패");
      }
      const patient: Patient = await res.json();
      setSelectedPatient(patient);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류");
    }
  };

  const submitCase = async () => {
    if (!selectedPatient) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          ...caseForm,
          contractDate: caseForm.contractDate || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "등록 실패");
      }
      const createdCase = await res.json();
      if (fromConsultationId && createdCase?.id) {
        await fetch(`/api/consultation/${fromConsultationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedCaseId: createdCase.id }),
        }).catch(() => {});
      }
      router.push(`/patients/${selectedPatient.id}?tab=${caseForm.caseType}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류");
      setSubmitting(false);
    }
  };

  return (
    <div style={{ ...S, padding: 24, minHeight: "100%", background: "#f1f5f9" }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>CASE MANAGEMENT</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/cases")} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", padding: 0 }}>← 목록</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>새 사건 등록</h1>
        </div>
      </div>

      {/* 스텝 표시 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        {[1, 2].map((n) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
              background: step >= n ? "#2563eb" : "#e5e7eb",
              color: step >= n ? "white" : "#9ca3af",
            }}>{n}</div>
            <span style={{ fontSize: 13, color: step >= n ? "#111827" : "#9ca3af", fontWeight: step === n ? 700 : 400 }}>
              {n === 1 ? "재해자 선택" : "사건 정보 입력"}
            </span>
            {n < 2 && <span style={{ color: "#d1d5db", margin: "0 4px" }}>→</span>}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Step 1: 재해자 검색 */}
      {step === 1 && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", maxWidth: 640 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 16px 0" }}>재해자 검색</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="이름 또는 주민번호로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPatients()}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={searchPatients} disabled={searching} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {searching ? "검색중..." : "검색"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
              {searchResults.map((p) => (
                <div key={p.id}
                  onClick={() => { setSelectedPatient(p); setStep(2); }}
                  style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12, fontFamily: "monospace" }}>{p.ssn}</div>
                  </div>
                  <span style={{ color: "#2563eb", fontSize: 13, fontWeight: 600 }}>선택 →</span>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>검색 결과가 없습니다.</p>
          )}

          <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 16 }}>
            <button onClick={() => setShowNewPatientForm(!showNewPatientForm)} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "7px 14px", fontSize: 13, color: "#374151", cursor: "pointer" }}>
              {showNewPatientForm ? "▲ 닫기" : "+ 새 재해자 등록"}
            </button>
          </div>

          {showNewPatientForm && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {fromConsultationId && autoFilledFields.size > 0 && (
                <div style={{ gridColumn: "1 / -1", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "#1d4ed8" }}>
                  💡 상담 내역에서 자동입력된 항목이 있습니다. 확인 후 등록하세요.
                </div>
              )}
              <LabelInput label="성명" required>
                <input style={{ ...inputStyle, background: autoFilledFields.has("name") ? "#eff6ff" : "white" }} value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} placeholder="홍길동" title={autoFilledFields.has("name") ? "상담 내역에서 자동입력됨" : undefined} />
              </LabelInput>
              <LabelInput label="주민번호" required>
                <input style={{ ...inputStyle, background: autoFilledFields.has("ssn") ? "#eff6ff" : "white" }} value={newPatient.ssn} onChange={(e) => setNewPatient({ ...newPatient, ssn: e.target.value })} placeholder="000000-0000000" title={autoFilledFields.has("ssn") ? "상담 내역에서 자동입력됨" : undefined} />
              </LabelInput>
              <LabelInput label="연락처">
                <input style={{ ...inputStyle, background: autoFilledFields.has("phone") ? "#eff6ff" : "white" }} value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} placeholder="010-0000-0000" title={autoFilledFields.has("phone") ? "상담 내역에서 자동입력됨" : undefined} />
              </LabelInput>
              <LabelInput label="주소">
                <input style={{ ...inputStyle, background: autoFilledFields.has("address") ? "#eff6ff" : "white" }} value={newPatient.address} onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })} placeholder="주소 입력" title={autoFilledFields.has("address") ? "상담 내역에서 자동입력됨" : undefined} />
              </LabelInput>
              <div style={{ gridColumn: "1 / -1" }}>
                <button onClick={createNewPatientAndProceed} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  등록 후 사건 정보 입력 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: 사건 정보 입력 */}
      {step === 2 && selectedPatient && (
        <div style={{ maxWidth: 800 }}>
          {/* 선택된 재해자 */}
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#1d4ed8" }}>✓ 재해자: <strong>{selectedPatient.name}</strong> ({selectedPatient.ssn})</span>
            <button onClick={() => { setStep(1); setSelectedPatient(null); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>변경</button>
          </div>

          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 20px 0" }}>사건 기본정보</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <LabelInput label="사건유형" required>
                <select style={inputStyle} value={caseForm.caseType} onChange={(e) => setCaseForm({ ...caseForm, caseType: e.target.value })}>
                  {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </LabelInput>
              <LabelInput label="사건번호">
                <input style={inputStyle} value={caseForm.caseNumber} onChange={(e) => setCaseForm({ ...caseForm, caseNumber: e.target.value })} placeholder="사건번호 (선택)" />
              </LabelInput>
              <LabelInput label="TF명">
                <select
                  value={caseForm.tfName}
                  onChange={(e) => {
                    const tf = e.target.value;
                    const branch = TF_TO_BRANCH[tf] ?? "";
                    setCaseForm({ ...caseForm, tfName: tf, branch });
                  }}
                  style={inputStyle}
                >
                  <option value="">TF 선택</option>
                  {Object.entries(TF_BY_BRANCH).map(([branch, tfs]) => (
                    <optgroup key={branch} label={branch}>
                      {tfs.map((tf) => (
                        <option key={tf} value={tf}>{tf}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </LabelInput>
              <LabelInput label="지사">
                <div style={{ ...inputStyle, background: "#f9fafb", color: "#6b7280" }}>
                  {caseForm.branch || "TF 선택 시 자동 지정"}
                </div>
              </LabelInput>
              <LabelInput label="영업담당자">
                <>
                  <input
                    type="text"
                    list="staff-list"
                    placeholder="이름 검색 또는 선택..."
                    value={caseForm.salesManager}
                    onChange={(e) => setCaseForm({ ...caseForm, salesManager: e.target.value })}
                    style={inputStyle}
                  />
                  <datalist id="staff-list">
                    {ALL_STAFF.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </>
              </LabelInput>
              <LabelInput label="실무담당자">
                <>
                  <input
                    type="text"
                    list="staff-list-2"
                    placeholder="이름 검색 또는 선택..."
                    value={caseForm.caseManager}
                    onChange={(e) => setCaseForm({ ...caseForm, caseManager: e.target.value })}
                    style={inputStyle}
                  />
                  <datalist id="staff-list-2">
                    {ALL_STAFF.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </>
              </LabelInput>
              <LabelInput label="영업경로">
                <select style={inputStyle} value={caseForm.salesRoute} onChange={(e) => setCaseForm({ ...caseForm, salesRoute: e.target.value })}>
                  <option value="">선택</option>
                  {SALES_ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </LabelInput>
              <LabelInput label="약정일자">
                <input type="date" style={inputStyle} value={caseForm.contractDate} onChange={(e) => setCaseForm({ ...caseForm, contractDate: e.target.value })} />
              </LabelInput>
              <div style={{ gridColumn: "1 / -1" }}>
                <LabelInput label="메모">
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={caseForm.memo} onChange={(e) => setCaseForm({ ...caseForm, memo: e.target.value })} placeholder="메모 (선택)" />
                </LabelInput>
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, paddingTop: 8 }}>
                <button onClick={() => setStep(1)} style={{ background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  ← 이전
                </button>
                <button onClick={submitCase} disabled={submitting} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? "등록중..." : "사건 등록"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
