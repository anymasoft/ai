import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      try {
        if (!user.id || !user.email) return false;

        // Проверяем, существует ли пользователь в БД
        const existing = await db.execute(
          "SELECT id, disabled FROM users WHERE id = ?",
          [user.id]
        );

        const rows = Array.isArray(existing) ? existing : existing.rows || [];

        if (rows.length === 0) {
          // Создаём нового пользователя в БД
          await db.execute(
            "INSERT INTO users (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
            [
              user.id,
              user.email,
              user.name || user.email.split("@")[0],
              Math.floor(Date.now() / 1000),
              Math.floor(Date.now() / 1000),
            ]
          );
        } else {
          // Проверяем, не отключен ли пользователь
          const dbUser = rows[0];
          if (dbUser.disabled === 1 || dbUser.disabled === true) {
            console.warn(`[Auth] Disabled user attempted to sign in: ${user.email}`);
            return false;
          }
        }
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // @ts-ignore - берём role и plan из созданного пользователя в БД
        token.role = user.role || "user";
        // @ts-ignore - берём role и plan из созданного пользователя в БД
        token.plan = user.plan || "free";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-ignore
        session.user.id = token.id;
        // @ts-ignore
        session.user.role = token.role || "user";
        // @ts-ignore
        session.user.plan = token.plan || "free";
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/auth-callback",
  },
  debug: true,
};
