"use client";

import Link from "next/link";

interface FormCard {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  deadline?: string;
}

const FORMS: FormCard[] = [
  {
    href: "/forms/objection/exam-claim",
    emoji: "⚖",
    title: "심사청구서",
    desc: "근로복지공단 처분에 대한 이의제기. 청구인 정보·처분 정보·청구 이유 입력 후 PDF 생성.",
    deadline: "결정통지서 받은 날부터 90일 이내",
  },
  {
    href: "/forms/objection/reexam-claim",
    emoji: "⚖",
    title: "재심사청구서",
    desc: "심사 결정에 대한 재심사청구. 산업재해보상보험재심사위원회 제출용.",
    deadline: "심사결정서 정본 받은 날부터 60일 이내",
  },
  {
    href: "/forms/objection/additional-injury",
    emoji: "➕",
    title: "추가상병 신청서",
    desc: "기존 인정 산재에 추가 상병이 발생한 경우 신청.",
  },
  {
    href: "/forms/objection/requote",
    emoji: "🔄",
    title: "재요양 신청서",
    desc: "종전 요양 종료 후 증상이 재발/악화된 경우 신청.",
  },
];

export default function ObjectionFormsIndexPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>⚖ 이의제기 양식 작성</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
        근로복지공단 처분·심사 결정에 대한 이의제기 / 추가상병 / 재요양 신청 양식.
        TBSS가 자동으로 본문을 채우고 PDF로 다운로드합니다. 제출 전 노무사 검토 필수.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {FORMS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            style={{
              display: "block",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 20,
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{f.emoji}</span>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{f.title}</h2>
            </div>
            <p style={{ fontSize: 13, color: "#4b5563", marginBottom: f.deadline ? 8 : 0 }}>{f.desc}</p>
            {f.deadline && (
              <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>
                ⏱ 제출 기한: {f.deadline}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
