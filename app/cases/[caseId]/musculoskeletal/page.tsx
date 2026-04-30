"use client";

import { useEffect, useState, use } from "react";

interface ConcurrentDisease {
  name: string;
  grade?: string;
  memo?: string;
}

interface MusculoskeletalDetail {
  bodyPart: string | null;
  diseaseName: string | null;
  occupation: string | null;
  workHistory: string | null;
  expertType: string | null;
  expertRequestDate: string | null;
  expertScheduleDate: string | null;
  hasMedicalCommittee: boolean;
  committeeSubmitDate: string | null;
  committeeReviewDate: string | null;
  disposalType: string | null;
  approvalDate: string | null;
  disabilityApprovalDate: string | null;
  hospitalName: string | null;
  managingBranch: string | null;
  treatmentStartDate: string | null;
  treatmentEndDate: string | null;
  claimCycle: string | null;
  memo: string | null;
  // 신규 필드 (P5)
  injuryDescription: string | null;
  restTimePattern: string | null;
  qualityReviewStatus: string | null;
  concurrentDiseases: ConcurrentDisease[] | null;
}

const EMPTY: MusculoskeletalDetail = {
  bodyPart: null,
  diseaseName: null,
  occupation: null,
  workHistory: null,
  expertType: null,
  expertRequestDate: null,
  expertScheduleDate: null,
  hasMedicalCommittee: false,
  committeeSubmitDate: null,
  committeeReviewDate: null,
  disposalType: null,
  approvalDate: null,
  disabilityApprovalDate: null,
  hospitalName: null,
  managingBranch: null,
  treatmentStartDate: null,
  treatmentEndDate: null,
  claimCycle: null,
  memo: null,
  injuryDescription: null,
  restTimePattern: null,
  qualityReviewStatus: null,
  concurrentDiseases: null,
};

function dateOnly(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.slice(0, 10);
}

const BODY_PARTS = ["어깨", "팔/팔꿈치", "손/손목", "허리", "목", "무릎", "발/발목", "고관절", "전신", "기타"];

export default function MusculoskeletalDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const [detail, setDetail] = useState<MusculoskeletalDetail>(EMPTY);
  const [caseInfo, setCaseInfo] = useState<{ patientName?: string; caseType?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof MusculoskeletalDetail>(key: K, value: MusculoskeletalDetail[K]) {
    setDetail((prev) => ({ ...prev, [key]: value }));
  }

  function addConcurrent() {
    const next = [...(detail.concurrentDiseases ?? []), { name: "", grade: "", memo: "" }];
    update("concurrentDiseases", next);
  }
  function updateConcurrent(idx: number, key: keyof ConcurrentDisease, value: string) {
    const next = [...(detail.concurrentDiseases ?? [])];
    next[idx] = { ...next[idx], [key]: value };
    update("concurrentDiseases", next);
  }
  function removeConcurrent(idx: number) {
    const next = (detail.concurrentDiseases ?? []).filter((_, i) => i !== idx);
    update("concurrentDiseases", next.length === 0 ? null : next);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/${caseId}/musculoskeletal`);
        if (res.ok) {
          const data = await res.json();
          if (data.detail) {
            const d = data.detail;
            setDetail({
              bodyPart: d.bodyPart ?? null,
              diseaseName: d.diseaseName ?? null,
              occupation: d.occupation ?? null,
              workHistory: d.workHistory ?? null,
              expertType: d.expertType ?? null,
              expertRequestDate: dateOnly(d.expertRequestDate),
              expertScheduleDate: dateOnly(d.expertScheduleDate),
              hasMedicalCommittee: !!d.hasMedicalCommittee,
              committeeSubmitDate: dateOnly(d.committeeSubmitDate),
              committeeReviewDate: dateOnly(d.committeeReviewDate),
              disposalType: d.disposalType ?? null,
              approvalDate: dateOnly(d.approvalDate),
              disabilityApprovalDate: dateOnly(d.disabilityApprovalDate),
              hospitalName: d.hospitalName ?? null,
              managingBranch: d.managingBranch ?? null,
              treatmentStartDate: dateOnly(d.treatmentStartDate),
              treatmentEndDate: dateOnly(d.treatmentEndDate),
              claimCycle: d.claimCycle ?? null,
              memo: d.memo ?? null,
              injuryDescription: d.injuryDescription ?? null,
              restTimePattern: d.restTimePattern ?? null,
              qualityReviewStatus: d.qualityReviewStatus ?? null,
              concurrentDiseases: Array.isArray(d.concurrentDiseases) ? d.concurrentDiseases : null,
            });
          }
        }
        const caseRes = await fetch(`/api/cases/${caseId}`);
        if (caseRes.ok) {
          const cd = await caseRes.json();
          setCaseInfo({ patientName: cd.patient?.name, caseType: cd.caseType });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/musculoskeletal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detail),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "저장 실패");
      }
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const containerStyle: React.CSSProperties = { maxWidth: 880, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" };
  const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20 };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, color: "#374151", fontWeight: 500, marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
  const fieldStyle: React.CSSProperties = { marginBottom: 12 };
  const gridTwo: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };

  if (loading) return <div style={containerStyle}>로딩 중...</div>;

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🦴 근골격계 사건 상세</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        Case ID: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{caseId}</code>
        {caseInfo?.patientName && (<> / 재해자: <strong>{caseInfo.patientName}</strong></>)}
        {caseInfo?.caseType && (<> / 사건유형: <strong>{caseInfo.caseType}</strong></>)}
      </p>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>상병 정보</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>부위</label>
            <select style={inputStyle} value={detail.bodyPart ?? ""} onChange={(e) => update("bodyPart", e.target.value || null)}>
              <option value="">(선택)</option>
              {BODY_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>상병명</label>
            <input style={inputStyle} value={detail.diseaseName ?? ""} onChange={(e) => update("diseaseName", e.target.value || null)} placeholder="ex: 회전근개파열, 요추간판탈출증" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>직종</label>
            <input style={inputStyle} value={detail.occupation ?? ""} onChange={(e) => update("occupation", e.target.value || null)} placeholder="ex: 건설업, 운전, 사무직" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>작업력 (요약)</label>
            <input style={inputStyle} value={detail.workHistory ?? ""} onChange={(e) => update("workHistory", e.target.value || null)} placeholder="ex: 30년 토목공사" />
          </div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>구체적 상해 / 작업 내용</label>
          <textarea
            style={{ ...inputStyle, height: 100, fontFamily: "inherit", resize: "vertical" }}
            value={detail.injuryDescription ?? ""}
            onChange={(e) => update("injuryDescription", e.target.value || null)}
            placeholder="ex: 5kg 이상 자재 1일 200회 반복 들기. 어깨 과사용 작업 다수."
          />
        </div>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>휴식시간 패턴</label>
            <input style={inputStyle} value={detail.restTimePattern ?? ""} onChange={(e) => update("restTimePattern", e.target.value || null)} placeholder="ex: 1일 2회, 1회 30분" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>치료 의료기관</label>
            <input style={inputStyle} value={detail.hospitalName ?? ""} onChange={(e) => update("hospitalName", e.target.value || null)} />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>전문조사 / 질판위</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>전문조사 종류</label>
            <select style={inputStyle} value={detail.expertType ?? ""} onChange={(e) => update("expertType", e.target.value || null)}>
              <option value="">(선택)</option>
              <option value="외부전문조사">외부전문조사</option>
              <option value="자문의소견">자문의소견</option>
              <option value="현장조사">현장조사</option>
              <option value="없음">없음</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>관할 지사</label>
            <input style={inputStyle} value={detail.managingBranch ?? ""} onChange={(e) => update("managingBranch", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>전문조사 요청일</label>
            <input style={inputStyle} type="date" value={detail.expertRequestDate ?? ""} onChange={(e) => update("expertRequestDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>전문조사 일정일</label>
            <input style={inputStyle} type="date" value={detail.expertScheduleDate ?? ""} onChange={(e) => update("expertScheduleDate", e.target.value || null)} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14 }}>
          <input type="checkbox" checked={detail.hasMedicalCommittee} onChange={(e) => update("hasMedicalCommittee", e.target.checked)} />
          질병판정위원회 거침
        </label>
        {detail.hasMedicalCommittee && (
          <div style={{ ...gridTwo, marginTop: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>질판위 회부일</label>
              <input style={inputStyle} type="date" value={detail.committeeSubmitDate ?? ""} onChange={(e) => update("committeeSubmitDate", e.target.value || null)} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>질판위 심의일</label>
              <input style={inputStyle} type="date" value={detail.committeeReviewDate ?? ""} onChange={(e) => update("committeeReviewDate", e.target.value || null)} />
            </div>
            <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <label style={labelStyle}>질판위 진행 상태</label>
              <select style={inputStyle} value={detail.qualityReviewStatus ?? ""} onChange={(e) => update("qualityReviewStatus", e.target.value || null)}>
                <option value="">(선택)</option>
                <option value="제출대기">제출대기</option>
                <option value="심의예정">심의예정</option>
                <option value="심의완료">심의완료</option>
                <option value="재심의">재심의</option>
                <option value="보류">보류</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>처분 / 장해</h2>
        <div style={gridTwo}>
          <div style={fieldStyle}>
            <label style={labelStyle}>처분 종류</label>
            <select style={inputStyle} value={detail.disposalType ?? ""} onChange={(e) => update("disposalType", e.target.value || null)}>
              <option value="">(선택)</option>
              <option value="승인">승인</option>
              <option value="부지급">부지급</option>
              <option value="일부지급">일부지급</option>
              <option value="반려">반려</option>
              <option value="진행중">진행중</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>승인일</label>
            <input style={inputStyle} type="date" value={detail.approvalDate ?? ""} onChange={(e) => update("approvalDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>장해 승인일</label>
            <input style={inputStyle} type="date" value={detail.disabilityApprovalDate ?? ""} onChange={(e) => update("disabilityApprovalDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>청구 주기</label>
            <input style={inputStyle} value={detail.claimCycle ?? ""} onChange={(e) => update("claimCycle", e.target.value || null)} placeholder="ex: 2년 단위" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>요양 시작일</label>
            <input style={inputStyle} type="date" value={detail.treatmentStartDate ?? ""} onChange={(e) => update("treatmentStartDate", e.target.value || null)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>요양 종료일</label>
            <input style={inputStyle} type="date" value={detail.treatmentEndDate ?? ""} onChange={(e) => update("treatmentEndDate", e.target.value || null)} />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>동반 상병</h2>
          <button
            onClick={addConcurrent}
            style={{ padding: "6px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
          >
            + 추가
          </button>
        </div>
        {(detail.concurrentDiseases ?? []).length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>동반 상병이 없습니다.</p>
        ) : (
          (detail.concurrentDiseases ?? []).map((row, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr 60px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input style={inputStyle} value={row.name ?? ""} onChange={(e) => updateConcurrent(idx, "name", e.target.value)} placeholder="상병명 (예: 어깨)" />
              <input style={inputStyle} value={row.grade ?? ""} onChange={(e) => updateConcurrent(idx, "grade", e.target.value)} placeholder="등급 (예: 12급)" />
              <input style={inputStyle} value={row.memo ?? ""} onChange={(e) => updateConcurrent(idx, "memo", e.target.value)} placeholder="메모" />
              <button
                onClick={() => removeConcurrent(idx)}
                style={{ padding: "8px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>메모</h2>
        <textarea
          style={{ ...inputStyle, height: 120, fontFamily: "inherit", resize: "vertical" }}
          value={detail.memo ?? ""}
          onChange={(e) => update("memo", e.target.value || null)}
          placeholder="작업환경/노출패턴/유의사항 등 메모"
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "12px 24px", background: saving ? "#9ca3af" : "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "저장 중..." : "💾 저장"}
        </button>
        {savedAt && <span style={{ color: "#16a34a", fontSize: 13 }}>✅ 저장됨 ({savedAt})</span>}
        {error && <span style={{ color: "#dc2626", fontSize: 13 }}>❌ {error}</span>}
      </div>
    </div>
  );
}
