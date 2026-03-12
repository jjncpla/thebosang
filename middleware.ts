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
});

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
