"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CaseRow {
  id: string;
  caseType: string;
  status: string | null;
  patient: { name: string | null } | null;
  occupationalAccident: {
    caseId: string;
    bodyPart: string | null;
    diseaseName: string | null;
    disposalType: string | null;
    qualityReviewStatus: string | null;
  } | null;
}

export default function OccupationalAccidentListPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cases?caseType=OCCUPATIONAL_ACCIDENT&limit=200");
        if (res.ok) {
          const data = await res.json();
          setCases(data.cases ?? data.items ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const containerStyle: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" };

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>⚠️ 업무상사고 사건 목록</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
        Case.caseType = OCCUPATIONAL_ACCIDENT 사건. 클릭 → 사고경위/부위/질판위/처분 입력.
      </p>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>로딩 중...</div>
      ) : cases.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280", background: "#f9fafb", borderRadius: 8 }}>
          업무상사고 사건이 없습니다. <Link href="/cases/new" style={{ color: "#3b82f6" }}>새 사건 등록 →</Link>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>재해자명</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>상태</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>부위</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>상병명</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>질판위</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>처분</th>
                <th style={{ padding: 12, textAlign: "center", fontWeight: 600 }}>편집</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 12 }}>{c.patient?.name ?? "-"}</td>
                  <td style={{ padding: 12 }}>{c.status ?? "-"}</td>
                  <td style={{ padding: 12 }}>{c.occupationalAccident?.bodyPart ?? "-"}</td>
                  <td style={{ padding: 12 }}>{c.occupationalAccident?.diseaseName ?? "-"}</td>
                  <td style={{ padding: 12 }}>{c.occupationalAccident?.qualityReviewStatus ?? "-"}</td>
                  <td style={{ padding: 12 }}>{c.occupationalAccident?.disposalType ?? "-"}</td>
                  <td style={{ padding: 12, textAlign: "center" }}>
                    <Link href={`/cases/${c.id}/occupational-accident`} style={{ background: "#3b82f6", color: "#fff", padding: "6px 12px", borderRadius: 4, textDecoration: "none", fontSize: 13 }}>
                      업무상사고 상세 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
