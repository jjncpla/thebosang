"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const CASE_TYPE_LABELS: Record<string, string> = {
  HEARING_LOSS: "소음성난청",
  COPD: "COPD",
  PNEUMOCONIOSIS: "진폐",
  MUSCULOSKELETAL: "근골격계",
  OCCUPATIONAL_ACCIDENT: "업무상사고",
  OCCUPATIONAL_CANCER: "직업성암",
  CARDIOVASCULAR: "뇌심혈관계",
  BEREAVED: "유족",
  OTHER: "기타",
};

const STATUS_KO: Record<string, string> = {
  CONSULTING: "상담",
  CONTRACTED: "약정",
  DOC_COLLECTING: "서류수집",
  SUBMITTED: "접수완료",
  EXAM_REQUESTED: "특진요구",
  EXAM_CLINIC_SELECTED: "특진병원선택",
  EXAM_SCHEDULED: "특진예정",
  IN_EXAM: "특진중",
  EXAM_DONE: "특진완료",
  EXPERT_REQUESTED: "전문조사요구",
  EXPERT_CLINIC_SELECTED: "전문병원선택",
  EXPERT_DONE: "전문조사완료",
  BANK_REQUESTED: "계좌요청",
  BANK_SUBMITTED: "계좌제출",
  DECISION_RECEIVED: "결정수령",
  REVIEWING: "검토중",
  INFO_REQUESTED: "정공청구",
  APPROVED: "승인",
  REJECTED: "불승인",
  OBJECTION: "이의제기",
  WAGE_CORRECTION: "평정청구",
  CLOSED: "종결",
};

type CaseItem = {
  id: string;
  caseType: string;
  status: string;
  tfName: string | null;
  branch: string | null;
  salesManager: { id: string; name: string } | null;
  caseManager: { id: string; name: string } | null;
};

type PatientResult = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  ssn: string;
  cases: CaseItem[];
};

function maskPhone(phone: string | null) {
  if (!phone) return "-";
  return phone.replace(/(\d{3})-?(\d{4})-?(\d{4})/, "$1-****-$4");
}

function CaseTypeBadge({ type }: { type: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#eff6ff", color: "#29ABE2", border: "1px solid #bfdbfe", marginRight: 4, marginBottom: 2 }}>
      {CASE_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#D0EAD9", color: "#006838", border: "1px solid #00854A" }}>
      {STATUS_KO[status] ?? status}
    </span>
  );
}

export default function InquiryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"search" | "myCase">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [myCaseResults, setMyCaseResults] = useState<PatientResult[]>([]);
  const [myCaseLoading, setMyCaseLoading] = useState(false);
  const [myCaseLoaded, setMyCaseLoaded] = useState(false);
  // 내 담당사건 탭 필터
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCaseType, setFilterCaseType] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [victimQuery, setVictimQuery] = useState("");

  const role = (session?.user as { role?: string })?.role ?? "";
  const canViewDetail = role === "ADMIN" || role === "STAFF" || role === "조직관리자";
  const isIsan = role === "이산계정";

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/inquiry?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setResults(data);
    } catch {
      alert("조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyCase = async () => {
    setMyCaseLoading(true);
    try {
      const res = await fetch("/api/inquiry?type=myCase");
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setMyCaseResults(data);
      setMyCaseLoaded(true);
    } catch {
      alert("조회 중 오류가 발생했습니다.");
    } finally {
      setMyCaseLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "myCase" && !myCaseLoaded) {
      fetchMyCase();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 내 담당사건 탭: 필터 옵션 ──
  const filterOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const caseTypeSet = new Set<string>();
    const tfSet = new Set<string>();
    for (const p of myCaseResults) {
      for (const c of p.cases) {
        if (c.status) statusSet.add(c.status);
        if (c.caseType) caseTypeSet.add(c.caseType);
        if (c.tfName) tfSet.add(c.tfName);
      }
    }
    return {
      statuses: Array.from(statusSet).sort(),
      caseTypes: Array.from(caseTypeSet).sort(),
      tfs: Array.from(tfSet).sort(),
    };
  }, [myCaseResults]);

  // ── 내 담당사건 탭: 필터 적용 결과 ──
  const filteredMyCaseResults = useMemo(() => {
    const q = victimQuery.trim().toLowerCase();
    const out: PatientResult[] = [];
    for (const p of myCaseResults) {
      // 재해자 이름/전화 검색
      if (q) {
        const hit =
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.phone ?? "").replace(/-/g, "").includes(q.replace(/-/g, ""));
        if (!hit) continue;
      }
      // 사건 필터 (진행상황 / 사건종류 / 해당TF)
      const matchedCases = p.cases.filter((c) => {
        if (filterStatus && c.status !== filterStatus) return false;
        if (filterCaseType && c.caseType !== filterCaseType) return false;
        if (filterTf && (c.tfName ?? "") !== filterTf) return false;
        return true;
      });
      if (matchedCases.length === 0) continue;
      out.push({ ...p, cases: matchedCases });
    }
    return out;
  }, [myCaseResults, filterStatus, filterCaseType, filterTf, victimQuery]);

  const resetMyCaseFilters = () => {
    setFilterStatus("");
    setFilterCaseType("");
    setFilterTf("");
    setVictimQuery("");
  };

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f1f5f9", fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, margin: "0 0 4px 0" }}>CASE INQUIRY</p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#005530", margin: 0 }}>사건 조회</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["search", "myCase"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: activeTab === tab ? 700 : 400,
              borderRadius: 6, cursor: "pointer",
              border: activeTab === tab ? "1px solid #29ABE2" : "1px solid #e5e7eb",
              background: activeTab === tab ? "#29ABE2" : "white",
              color: activeTab === tab ? "white" : "#374151",
            }}
          >
            {tab === "search" ? "재해자 조회" : (
              <span>내 담당 사건{myCaseLoaded && <span style={{ marginLeft: 6, background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 11 }}>{myCaseResults.length}건</span>}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search Box - 재해자 조회 탭 */}
      {activeTab === "search" && (
        <div style={{
          background: "white", borderRadius: 12, border: "1px solid #e5e7eb",
          padding: "28px 24px", marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, fontWeight: 500 }}>
            성명, 생년월일(6자리), 또는 전화번호로 검색
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="예) 홍길동 / 801215 / 010-1234-5678"
              style={{
                flex: 1, border: "2px solid #e5e7eb", borderRadius: 8,
                padding: "10px 16px", fontSize: 15, color: "#111827",
                outline: "none", background: "#f9fafb",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                background: "#29ABE2", color: "white", border: "none",
                borderRadius: 8, padding: "10px 24px", fontSize: 14,
                fontWeight: 700, cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "조회 중..." : "검색"}
            </button>
          </div>
        </div>
      )}

      {/* 내 담당 사건 탭 */}
      {activeTab === "myCase" && myCaseLoading && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          조회 중...
        </div>
      )}
      {activeTab === "myCase" && !myCaseLoading && myCaseLoaded && myCaseResults.length === 0 && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          담당 사건이 없습니다.
        </div>
      )}

      {/* 내 담당사건 필터 바 */}
      {activeTab === "myCase" && !myCaseLoading && myCaseLoaded && myCaseResults.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            padding: "14px 16px",
            marginBottom: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {/* 진행상황 */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: "7px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                color: "#374151",
                background: "#f9fafb",
                minWidth: 140,
              }}
            >
              <option value="">진행상황 (전체)</option>
              {filterOptions.statuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_KO[s] ?? s}
                </option>
              ))}
            </select>

            {/* 사건종류 */}
            <select
              value={filterCaseType}
              onChange={(e) => setFilterCaseType(e.target.value)}
              style={{
                padding: "7px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                color: "#374151",
                background: "#f9fafb",
                minWidth: 140,
              }}
            >
              <option value="">사건종류 (전체)</option>
              {filterOptions.caseTypes.map((t) => (
                <option key={t} value={t}>
                  {CASE_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>

            {/* 해당 TF */}
            <select
              value={filterTf}
              onChange={(e) => setFilterTf(e.target.value)}
              style={{
                padding: "7px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                color: "#374151",
                background: "#f9fafb",
                minWidth: 160,
              }}
            >
              <option value="">해당 TF (전체)</option>
              {filterOptions.tfs.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>

            {/* 재해자 검색 */}
            <input
              type="text"
              value={victimQuery}
              onChange={(e) => setVictimQuery(e.target.value)}
              placeholder="재해자 검색 (성명/전화)"
              style={{
                flex: 1,
                minWidth: 180,
                padding: "7px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                color: "#111827",
                background: "#f9fafb",
              }}
            />

            {/* 초기화 버튼 */}
            {(filterStatus || filterCaseType || filterTf || victimQuery) && (
              <button
                onClick={resetMyCaseFilters}
                style={{
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  padding: "7px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                초기화
              </button>
            )}

            {/* 결과 카운트 */}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
              {filteredMyCaseResults.length} / {myCaseResults.length}명
            </span>
          </div>
        </div>
      )}

      {/* 내 담당사건 필터 적용 후 결과 없음 */}
      {activeTab === "myCase" &&
        !myCaseLoading &&
        myCaseLoaded &&
        myCaseResults.length > 0 &&
        filteredMyCaseResults.length === 0 && (
          <div
            style={{
              background: "white",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              padding: "48px 16px",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            조건에 맞는 사건이 없습니다.
          </div>
        )}

      {/* Results - 재해자 조회 */}
      {activeTab === "search" && searched && !loading && results.length === 0 && (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          검색 결과가 없습니다.
        </div>
      )}

      {(activeTab === "search" ? results : filteredMyCaseResults).map((patient) => (
        <div key={patient.id} style={{
          background: "white", borderRadius: 10, border: "1px solid #e5e7eb",
          marginBottom: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          {/* Patient Header */}
          <div style={{ background: "#f8fafc", padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>{patient.name}</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                {isIsan ? maskPhone(patient.phone) : (patient.phone ?? "-")}
              </span>
              {!isIsan && patient.address && (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{patient.address}</span>
              )}
              {isIsan && patient.address && (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{patient.address.slice(0, 4)}****</span>
              )}
              <span style={{ fontSize: 12, color: "#9ca3af" }}>생: {patient.ssn.slice(0, 6)}</span>
            </div>
            {canViewDetail && (
              <button
                onClick={() => router.push(`/patients/${patient.id}`)}
                style={{ background: "#29ABE2", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                상세 사건으로 이동
              </button>
            )}
          </div>

          {/* Cases */}
          {patient.cases.length === 0 ? (
            <div style={{ padding: "20px", color: "#9ca3af", fontSize: 13 }}>등록된 사건이 없습니다.</div>
          ) : (
            <div style={{ padding: "12px 20px" }}>
              {patient.cases.map((c) => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                  borderBottom: "1px solid #f1f5f9", flexWrap: "wrap",
                }}>
                  <CaseTypeBadge type={c.caseType} />
                  <StatusBadge status={c.status} />
                  <span style={{ fontSize: 12, color: "#6b7280" }}>TF: {c.tfName ?? "-"}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>지사: {c.branch ?? "-"}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>영업: {c.salesManager?.name ?? "-"}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>실무: {c.caseManager?.name ?? "-"}</span>
                  {canViewDetail && (
                    <button
                      onClick={() => router.push(`/patients/${patient.id}?tab=${c.caseType}`)}
                      style={{ marginLeft: "auto", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 10px", fontSize: 11, color: "#374151", background: "#f9fafb", cursor: "pointer" }}
                    >
                      사건 상세
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
