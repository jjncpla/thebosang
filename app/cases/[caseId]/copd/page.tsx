"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /cases/[caseId]/copd — 환자 페이지로 redirect (단일 진입점)
 * 사용자 결정 (2026-05-06): 별도 페이지 불필요. 환자 상세 페이지에서 상병 탭으로 전환.
 */
export default function CopdDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}`);
        if (!res.ok) {
          router.replace("/cases");
          return;
        }
        const c = await res.json();
        const patientId = c.patient?.id;
        if (cancelled) return;
        if (patientId) {
          router.replace(`/patients/${patientId}?tab=COPD`);
        } else {
          router.replace("/cases");
        }
      } catch {
        if (!cancelled) router.replace("/cases");
      }
    })();
    return () => { cancelled = true; };
  }, [caseId, router]);

  return (
    <div style={{ padding: 24, fontSize: 13, color: "#6b7280", textAlign: "center" }}>
      재해자 페이지로 이동 중...
    </div>
  );
}
