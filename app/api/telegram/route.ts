import { NextRequest, NextResponse } from "next/server";
import { saveMessage } from "@/lib/saveMessage";

// ⭐ 파일 최상단 (여기 중요)
const processed = new Set<number>();

export async function POST(req: NextRequest) {
  console.log("🔥 webhook 들어옴");

  try {
    const body = await req.json();

    // ⭐ 중복 방지 (여기 위치 맞음)
    const updateId = body.update_id;

    if (processed.has(updateId)) {
      console.log("⚠️ 중복 메시지 무시:", updateId);
      return NextResponse.json({ ok: true });
    }

    processed.add(updateId);

    const msg = body.message;

    if (!msg) {
      return NextResponse.json({ ok: true });
    }

    const result = await saveMessage(msg);
    console.log("저장 결과:", result);

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("🔥 진짜 에러:", e);

    // ⭐ 무조건 200 반환 (중요)
    return NextResponse.json({ ok: true });
  }
}