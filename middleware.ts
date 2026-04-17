import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }

  // /admin 라우트는 ADMIN 권한만 접근 가능
  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (req.auth.user?.role !== "ADMIN") {
      const homeUrl = new URL("/", req.nextUrl.origin);
      return Response.redirect(homeUrl);
    }
  }

  // /cases/db, /cases/import 는 ADMIN 만 접근 가능
  if (
    req.nextUrl.pathname.startsWith("/cases/db") ||
    req.nextUrl.pathname.startsWith("/cases/import")
  ) {
    if (req.auth.user?.role !== "ADMIN") {
      const homeUrl = new URL("/", req.nextUrl.origin);
      return Response.redirect(homeUrl);
    }
  }

  // 이산계정: /cases-view와 /api/cases-view만 허용, 나머지 차단
  if (req.auth.user?.role === "이산계정") {
    const allowed = ["/cases-view", "/api/cases-view", "/login", "/api/auth"];
    const isAllowed = allowed.some((path) =>
      req.nextUrl.pathname.startsWith(path)
    );
    if (!isAllowed) {
      return Response.redirect(new URL("/cases-view", req.nextUrl.origin));
    }
  }
});

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|login|api/init-contacts|api/init-schema-v2).*)",
  ],
};
