import { NextRequest, NextResponse } from "next/server";

// NAS API 프록시 — CORS 우회용
// 클라이언트 → Railway 서버 → NAS API
export async function POST(req: NextRequest) {
  // 자체 서명 인증서 허용
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  try {
    const body = await req.json();
    const { nasUrl, account, password, action, folderPath } = body;

    if (!nasUrl || !account || !password) {
      return NextResponse.json({ error: "nasUrl, account, password 필요" }, { status: 400 });
    }

    // ─── 로그인 ───
    const loginUrl = `${nasUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(account)}&passwd=${encodeURIComponent(password)}&session=FileStation&format=sid`;
    const loginRes = await fetch(loginUrl);
    const loginData = await loginRes.json();

    if (!loginData?.success) {
      return NextResponse.json({
        success: false,
        error: "NAS 로그인 실패",
        detail: loginData,
      });
    }

    const sid = loginData.data.sid;

    try {
      // action === "test" → 로그인 성공 여부만 반환
      if (action === "test") {
        return NextResponse.json({ success: true, message: "연결 성공" });
      }

      // action === "list" → 폴더 목록 반환
      if (action === "list" && folderPath) {
        const listUrl = `${nasUrl}/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(folderPath)}&_sid=${sid}`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();
        return NextResponse.json(listData);
      }

      return NextResponse.json({ error: "지원하지 않는 action" }, { status: 400 });
    } finally {
      // 항상 로그아웃
      fetch(`${nasUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=logout&session=FileStation&_sid=${sid}`).catch(() => {});
    }
  } catch (err) {
    console.error("[POST /api/nas/proxy]", err);
    return NextResponse.json({ error: "NAS 프록시 오류" }, { status: 500 });
  }
}
