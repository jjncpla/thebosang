import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const nasUrl = req.nextUrl.searchParams.get("nasUrl");
  if (!nasUrl) {
    return NextResponse.json({ ok: false, message: "nasUrl 파라미터가 필요합니다." });
  }

  const account = process.env.NAS_ACCOUNT;
  const password = process.env.NAS_PASSWORD;
  if (!account || !password) {
    return NextResponse.json({ ok: false, message: "NAS_ACCOUNT / NAS_PASSWORD 환경변수가 설정되지 않았습니다." });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = `${nasUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(account)}&passwd=${encodeURIComponent(password)}&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await res.json();
    const ok = data?.success === true;

    return NextResponse.json({
      ok,
      message: ok ? "연결 성공" : "로그인 실패 — 계정 정보를 확인하세요.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "연결 실패";
    return NextResponse.json({ ok: false, message });
  }
}
