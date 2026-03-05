import type { NextAuthConfig } from "next-auth";

// Edge-compatible config (no Node.js-only imports)
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [],
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id)   session.user.id   = token.id   as string;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
  },
};
