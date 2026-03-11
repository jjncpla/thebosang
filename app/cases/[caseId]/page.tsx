"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

/* ═══════════════════════════════════════════════
   타입
═══════════════════════════════════════════════ */
type Person = { id: number; name: string; phone: string | null };
type CaseStatus = "RECEIVED" | "IN_PROGRESS" | "DONE" | "HOLD" | "CANCEL" | null;
type Case = {
  id: number;
  title: string;
  status: CaseStatus;
  createdAt: string;
  persons: Person[];
};

/* ═══════════════════════════════════════════════
   유틸
═══════════════════════════════════════════════ */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_LABEL: Record<NonNullable<CaseStatus>, string> = {
  RECEIVED: "접수", IN_PROGRESS: "진행중", DONE: "완료", HOLD: "보류", CANCEL: "취하",
};

type BadgeStyle = { background: string; color: string; border: string; dotColor: string };
function getStatusBadge(status: CaseStatus): { label: string; style: BadgeStyle } {
  const label = (status && STATUS_LABEL[status]) ?? "미지정";
  switch (status) {
    case "RECEIVED":    return { label, style: { background: "#1e1b4b", color: "#a5b4fc", border: "1px solid #4338ca", dotColor: "#818cf8" } };
    case "IN_PROGRESS": return { label, style: { background: "#082f49", color: "#7dd3fc", border: "1px solid #0369a1", dotColor: "#38bdf8" } };
    case "DONE":        return { label, style: { background: "#052e16", color: "#86efac", border: "1px solid #15803d", dotColor: "#4ade80" } };
    case "HOLD":        return { label, style: { background: "#451a03", color: "#fcd34d", border: "1px solid #b45309", dotColor: "#fbbf24" } };
    case "CANCEL":      return { label, style: { background: "#1e293b", color: "#94a3b8", border: "1px solid #475569", dotColor: "#64748b" } };
    default:            return { label, style: { background: "#1e293b", color: "#64748b", border: "1px solid #334155", dotColor: "#475569" } };
  }
}

const TABS = ["기본 정보", "특진 기록", "진행 경과", "서식 생성"] as const;
type Tab = typeof TABS[number];

const S = {
  fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
};

/* ═══════════════════════════════════════════════
   상세 페이지
═══════════════════════════════════════════════ */
export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.caseId as string;

  const [caseData,      setCaseData]      = useState<Case | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [activeTab,     setActiveTab]     = useState<Tab>("기본 정보");
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/cases/${caseId}`);
        if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
        const data: Case = await res.json();
        setCaseData(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const updateStatus = async (newStatus: NonNullable<CaseStatus>) => {
    if (!caseData || statusUpdating) return;
    setStatusUpdating(true);
    const prev = caseData;
    setCaseData({ ...caseData, status: newStatus });
    try {
      const res = await fetch(`/api/cases/${caseData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const updated: Case = await res.json();
      setCaseData(updated);
    } catch {
      setCaseData(prev);
    } finally {
      setStatusUpdating(false);
    }
  };

  const mainPerson = caseData?.persons?.[0] ?? null;

  if (loading) return <LoadingSkeleton />;
  if (error)   return <ErrorState error={error} onBack={() => router.push("/cases")} />;
  if (!caseData) return null;

  const { label: statusLabel, style: statusStyle } = getStatusBadge(caseData.status);

  return (
    <div style={{ ...S, minHeight: "100%", background: "#f1f5f9" }}>

      {/* ── 상단 헤더 바 ── */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 24px",
          display: "flex",
          alignItems: "stretch",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* ← 목록 */}
        <button
          onClick={() => router.push("/cases")}
          style={{
            background: "none",
            border: "none",
            color: "#6b7280",
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "16px 0",
            flexShrink: 0,
          }}
        >
          ← 목록
        </button>

        <div style={{ width: 1, background: "#e5e7eb", margin: "12px 0" }} />

        {/* 재해자명 + 상태 */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
            {mainPerson?.name ?? "재해자 미등록"}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              ...statusStyle,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusStyle.dotColor }} />
            {statusLabel}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>
            #{caseData.id}
          </span>
        </div>

        {/* 서식 생성 버튼 */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            서식 생성
          </button>
        </div>
      </div>

      {/* ── 요약 정보 바 ── */}
      <div
        style={{
          background: "#f8fafc",
          borderBottom: "1px solid #e5e7eb",
          padding: "10px 24px",
          display: "flex",
          gap: 24,
          fontSize: 12,
          color: "#6b7280",
        }}
      >
        <span>주민번호: <strong style={{ color: "#374151" }}>-</strong></span>
        <span>담당자: <strong style={{ color: "#374151" }}>-</strong></span>
        <span>담당 TF: <strong style={{ color: "#374151" }}>-</strong></span>
        <span>등록일시: <strong style={{ color: "#374151" }}>{formatDateTime(caseData.createdAt)}</strong></span>
      </div>

      {/* ── 탭 메뉴 ── */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 24px",
          display: "flex",
          gap: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent",
              color: activeTab === tab ? "#2563eb" : "#6b7280",
              fontWeight: activeTab === tab ? 700 : 400,
              fontSize: 13,
              padding: "14px 20px",
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div style={{ padding: 24, maxWidth: 900 }}>
        {activeTab === "기본 정보" && (
          <BasicInfoTab caseData={caseData} mainPerson={mainPerson} onUpdateStatus={updateStatus} statusUpdating={statusUpdating} />
        )}
        {activeTab === "특진 기록" && <PlaceholderTab title="특진 기록" desc="소음성 난청 등 특진 기록을 입력합니다" />}
        {activeTab === "진행 경과" && (
          <ProgressTab caseId={caseData.id} />
        )}
        {activeTab === "서식 생성" && <FormTab caseId={caseData.id} />}
      </div>
    </div>
  );
}

/* ── 기본 정보 탭 ── */
function BasicInfoTab({
  caseData,
  mainPerson,
  onUpdateStatus,
  statusUpdating,
}: {
  caseData: Case;
  mainPerson: Person | null;
  onUpdateStatus: (s: NonNullable<CaseStatus>) => void;
  statusUpdating: boolean;
}) {
  const { label, style: bs } = getStatusBadge(caseData.status);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* 재해자 기본 정보 */}
      <InfoCard title="재해자 기본 정보">
        <InfoRow label="성명">{mainPerson?.name ?? "-"}</InfoRow>
        <InfoRow label="주민번호">-</InfoRow>
        <InfoRow label="연락처">{mainPerson?.phone ?? "-"}</InfoRow>
        <InfoRow label="등록 인원">{caseData.persons?.length ?? 0}명</InfoRow>
      </InfoCard>

      {/* 사건 정보 */}
      <InfoCard title="사건 정보">
        <InfoRow label="사건 ID">#{caseData.id}</InfoRow>
        <InfoRow label="상병명">{caseData.title || "-"}</InfoRow>
        <InfoRow label="진행단계">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, ...bs }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: bs.dotColor }} />
            {label}
          </span>
        </InfoRow>
        <InfoRow label="등록일시">{formatDateTime(caseData.createdAt)}</InfoRow>
      </InfoCard>

      {/* 상태 변경 */}
      {(caseData.status === "RECEIVED" || caseData.status === "IN_PROGRESS") && (
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
          {caseData.status === "RECEIVED" && (
            <button
              disabled={statusUpdating}
              onClick={() => onUpdateStatus("IN_PROGRESS")}
              style={{ background: "#0369a1", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: statusUpdating ? 0.5 : 1 }}
            >
              → 진행중으로 변경
            </button>
          )}
          {caseData.status === "IN_PROGRESS" && (
            <button
              disabled={statusUpdating}
              onClick={() => onUpdateStatus("DONE")}
              style={{ background: "#15803d", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: statusUpdating ? 0.5 : 1 }}
            >
              ✓ 완료로 변경
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 진행 경과 탭 ── */
function ProgressTab({ caseId }: { caseId: number }) {
  return (
    <div>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        진행 경과 타임라인은{" "}
        <a href={`/timelines/${caseId}`} style={{ color: "#2563eb", textDecoration: "underline" }}>
          전용 페이지
        </a>
        에서도 확인할 수 있습니다.
      </p>
      <PlaceholderTab title="진행 경과" desc="세로 타임라인 + 경과 추가 입력 폼이 여기에 표시됩니다" />
    </div>
  );
}

/* ── 서식 생성 탭 ── */
function FormTab({ caseId }: { caseId: number }) {
  const forms = [
    "요양급여신청서", "장해급여청구서", "간병급여청구서",
    "휴업급여청구서", "유족급여청구서", "장의비청구서",
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {forms.map((name) => (
        <div
          key={name}
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: 24, textAlign: "center" }}>📄</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "center" }}>
            {name}
          </div>
          <a
            href={`/api/cases/${caseId}/generate-disability-claim`}
            style={{
              display: "block",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "7px 0",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "center",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            PDF 생성
          </a>
        </div>
      ))}
    </div>
  );
}

/* ── 공통 UI 컴포넌트 ── */
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
      </div>
      <dl style={{ margin: 0 }}>{children}</dl>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #f9fafb", padding: "10px 16px", gap: 12 }}>
      <dt style={{ fontSize: 12, color: "#9ca3af", width: 80, flexShrink: 0 }}>{label}</dt>
      <dd style={{ fontSize: 13, color: "#111827", margin: 0, fontWeight: 500 }}>{children}</dd>
    </div>
  );
}

function PlaceholderTab({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{desc}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24, background: "#f1f5f9", minHeight: "100%" }}>
      <div style={{ background: "white", borderRadius: 10, padding: 32, animation: "pulse 1.5s infinite" }}>
        <div style={{ height: 20, background: "#f1f5f9", borderRadius: 4, width: 200, marginBottom: 16 }} />
        <div style={{ height: 14, background: "#f1f5f9", borderRadius: 4, width: 120 }} />
      </div>
    </div>
  );
}

function ErrorState({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ color: "#dc2626", marginBottom: 12 }}>⚠ {error}</div>
      <button onClick={onBack} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
        목록으로 돌아가기
      </button>
    </div>
  );
}
