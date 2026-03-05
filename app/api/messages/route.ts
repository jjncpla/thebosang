/* app/api/messages/route.ts */
import { NextRequest, NextResponse } from "next/server";
import { tfMessages } from "@/lib/tfstore";

/* ── 타임스탬프 → YYYY-MM-DD 변환 ── */
function tsToDateStr(ts: number): string {
  const d   = new Date(ts);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/messages
   GET /api/messages?date=YYYY-MM-DD
   — date 파라미터가 없으면 전체 반환
   — date 파라미터가 있으면 해당 날짜의 메시지만 반환
   ═══════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date"); // YYYY-MM-DD | null

  let result = [...tfMessages];

  if (dateParam) {
    // YYYY-MM-DD 형식 유효성 검사
    const isValid = /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
    if (!isValid) {
      return NextResponse.json(
        { error: "date 파라미터는 YYYY-MM-DD 형식이어야 합니다." },
        { status: 400 }
      );
    }
    result = result.filter(msg => tsToDateStr(msg.date) === dateParam);
  }

  // 시간순 정렬 (오래된 것 먼저)
  result.sort((a, b) => a.date - b.date);

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}