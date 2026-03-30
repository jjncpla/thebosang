import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const nasUrl = req.nextUrl.searchParams.get("nasUrl");
  if (!nasUrl) {
    return NextResponse.json({ ok: false, message: "nasUrl 파라미터가 필요합니다." });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(nasUrl, {
      method: "HEAD",
      signal: controller.signal,
      // Synology NAS uses self-signed certs
      // @ts-expect-error Node.js fetch option
      rejectUnauthorized: false,
    });
    clearTimeout(timeout);

    return NextResponse.json({
      ok: res.ok || res.status === 401 || res.status === 403,
      message: res.ok ? "연결 성공" : `응답 코드: ${res.status}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "연결 실패";
    return NextResponse.json({ ok: false, message });
  }
}
