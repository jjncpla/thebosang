"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CopdToolsPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: string) {
    setBusy(action);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/copd-tools?action=${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "실행 실패");
      }
      setResult(data);
      // 테스트 재해자 생성 시 결과 케이스로 즉시 이동
      if (action === "seed-test-patient" && (data as { url?: string }).url) {
        router.push((data as { url: string }).url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const card: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, marginBottom: 16 };
  const btn = (color: string, disabled: boolean): React.CSSProperties => ({
    background: disabled ? "#9ca3af" : color, color: "white", border: "none", borderRadius: 6,
    padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>COPD 운영 도구</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>ADMIN 전용. 실행 결과는 즉시 반영됩니다.</p>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>1. 캘린더 일정 — 상병 백필</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          기존 SpecialClinicSchedule 행 중 caseId가 있고 diseaseType이 비어있는 행을 Case.caseType으로 일괄 채움. 멱등 (이미 채워진 행은 건너뜀).
        </p>
        <button onClick={() => call("backfill-disease-type")} disabled={busy === "backfill-disease-type"}
          style={btn("#0d9488", busy === "backfill-disease-type")}>
          {busy === "backfill-disease-type" ? "실행 중..." : "🔄 일정 상병 백필 실행"}
        </button>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>2. legacy caseType 한글 → 영문 enum 마이그레이션</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          ObjectionCase / ObjectionReview / WageReviewData에 한글로 저장된 caseType (예: &quot;난청&quot; → &quot;HEARING_LOSS&quot;)을 영문 enum으로 일괄 변환. 멱등.
        </p>
        <button onClick={() => call("migrate-legacy-casetype")} disabled={busy === "migrate-legacy-casetype"}
          style={btn("#7c3aed", busy === "migrate-legacy-casetype")}>
          {busy === "migrate-legacy-casetype" ? "실행 중..." : "🔄 caseType 영문 통일"}
        </button>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>3. COPD 테스트 재해자 생성</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
          엑셀 첫 케이스(홍순덕) 패턴 기반 더미 재해자 + COPD 사건 + 1차 신청(수치미달, 재진행 가능)을 생성합니다.
          이미 존재하면 기존 케이스를 재사용합니다. 생성 후 자동으로 상세 페이지로 이동합니다.
        </p>
        <button onClick={() => call("seed-test-patient")} disabled={busy === "seed-test-patient"}
          style={btn("#1d4ed8", busy === "seed-test-patient")}>
          {busy === "seed-test-patient" ? "생성 중..." : "👤 테스트 재해자 만들기"}
        </button>
      </div>

      {result !== null && (
        <div style={{ ...card, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 8 }}>✅ 실행 결과</h3>
          <pre style={{ fontSize: 12, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
