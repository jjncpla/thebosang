import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email:    { label: "이메일",   type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Dynamic imports: runs only in Node.js (never in Edge middleware)
        const { authPrisma } = await import("@/lib/auth-db");
        const bcrypt = (await import("bcryptjs")).default;

        const user = await authPrisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});

// Type augmentation
declare module "next-auth" {
  interface User { role?: string }
  interface Session {
    user: { id: string; role: string } & import("next-auth").DefaultSession["user"];
  }
}
