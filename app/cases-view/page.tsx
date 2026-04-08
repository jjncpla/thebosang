"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const STATUS_MAP: Record<string, string> = {
  CONSULTING: "접수 대기",
  CONTRACTED: "약정 완료",
  DOC_COLLECTING: "자료 수집 중",
  SUBMITTED: "공단 접수 완료",
  EXAM_REQUESTED: "특진진찰요구서 수령",
  EXAM_CLINIC_SELECTED: "특진병원 선택 완료",
  EXAM_SCHEDULED: "특진 일정 확정",
  IN_EXAM: "특진 진행 중",
  EXAM_DONE: "특진 완료",
  EXPERT_REQUESTED: "전문조사요구서 수령",
  EXPERT_DONE: "전문조사 완료",
  DECISION_RECEIVED: "결정통지서 수령",
  REVIEWING: "검토 중",
  APPROVED: "승인",
  REJECTED: "불승인",
  CLOSED: "종결",
  OBJECTION: "이의제기 진행 중",
  WAGE_CORRECTION: "평균임금 정정",
};

const CASE_TYPE_MAP: Record<string, string> = {
  HEARING_LOSS: "소음성 난청",
  COPD: "COPD",
  PNEUMOCONIOSIS: "진폐",
  MUSCULOSKELETAL: "근골격계",
  OCCUPATIONAL_ACCIDENT: "업무상 사고",
  OCCUPATIONAL_CANCER: "직업성 암",
  BEREAVED: "유족",
  OTHER: "기타",
};

export default function CasesViewPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"all" | "my">("all");
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [caseType, setCaseType] = useState("");
  const [status, setStatus] = useState("");

  const role = (session?.user as { role?: string })?.role ?? "";
  const isIsanAccount = role === "이산계정";

  const fetchCases = async (myOnly: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (myOnly) params.set("myOnly", "true");
      if (search) params.set("search", search);
      if (caseType) params.set("caseType", caseType);
      if (status) params.set("status", status);

      const res = await fetch(`/api/cases-view?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
    } catch (e) {
      console.error("사건 조회 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases(activeTab === "my");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSearch = () => {
    fetchCases(activeTab === "my");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#006838" }}>
        사건 조회
      </h1>

      {/* 탭 — 이산계정은 탭 숨김 (전체 조회만) */}
      {!isIsanAccount && (
        <div className="flex gap-2 mb-6">
          {[
            { key: "all", label: "전체 조회" },
            { key: "my", label: "내 담당 사건" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "all" | "my")}
              className="px-4 py-2 rounded text-sm font-medium"
              style={{
                backgroundColor:
                  activeTab === tab.key ? "#29ABE2" : "#f1f5f9",
                color: activeTab === tab.key ? "white" : "#64748b",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 필터 영역 */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="성명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="border px-3 py-2 rounded text-sm"
          style={{ borderColor: "#CBD5E1" }}
        />
        <select
          value={caseType}
          onChange={(e) => setCaseType(e.target.value)}
          className="border px-3 py-2 rounded text-sm"
          style={{ borderColor: "#CBD5E1" }}
        >
          <option value="">전체 상병</option>
          {Object.entries(CASE_TYPE_MAP).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border px-3 py-2 rounded text-sm"
          style={{ borderColor: "#CBD5E1" }}
        >
          <option value="">전체 진행상황</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded text-sm text-white"
          style={{ backgroundColor: "#29ABE2" }}
        >
          조회
        </button>
      </div>

      {/* 결과 카운트 */}
      <div className="text-sm text-gray-500 mb-3">
        총 {cases.length}건
        {activeTab === "my" && !isIsanAccount && " (내 영업 담당 사건)"}
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="text-gray-400 py-8 text-center">불러오는 중...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#006838", color: "white" }}>
                <th className="px-3 py-2 text-left">성명</th>
                <th className="px-3 py-2 text-left">주민번호</th>
                <th className="px-3 py-2 text-left">연락처</th>
                <th className="px-3 py-2 text-left">주소</th>
                <th className="px-3 py-2 text-left">상병</th>
                <th className="px-3 py-2 text-left">진행상황</th>
                <th className="px-3 py-2 text-left">영업담당</th>
                <th className="px-3 py-2 text-left">사건담당</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                cases.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? "white" : "#f8fafc",
                    }}
                  >
                    <td className="px-3 py-2 font-medium">{c.patientName}</td>
                    <td className="px-3 py-2 text-gray-600">{c.ssn}</td>
                    <td className="px-3 py-2">{c.phone}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate">
                      {c.address}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                        }}
                      >
                        {CASE_TYPE_MAP[c.caseType] ?? c.caseType}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor:
                            c.status === "APPROVED"
                              ? "#dcfce7"
                              : c.status === "REJECTED"
                              ? "#fee2e2"
                              : "#f1f5f9",
                          color:
                            c.status === "APPROVED"
                              ? "#166534"
                              : c.status === "REJECTED"
                              ? "#991b1b"
                              : "#475569",
                        }}
                      >
                        {STATUS_MAP[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{c.salesManager}</td>
                    <td className="px-3 py-2">{c.caseManager}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
