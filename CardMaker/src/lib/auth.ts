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
  trustHost: true,
  useSecureCookies: true,
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      },
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
      },
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      },
    },
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
      // При первом логине устанавливаем базовые данные из user объекта
      if (user) {
        token.id = user.id;
        // @ts-ignore
        token.role = user.role || "user";
      }

      // ВАЖНО: НЕ добавляем plan и expiresAt в token!
      // Plan всегда читается из БД через /api/user
      // Это гарантирует что UI видит актуальный план, а не кэшированную копию

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-ignore
        session.user.id = token.id;
        // @ts-ignore
        session.user.role = token.role || "user";
        // ВАЖНО: НЕ добавляем plan и expiresAt!
        // Они всегда читаются из БД через /api/user
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/auth-callback",
  },
  debug: process.env.NODE_ENV === "development",
};
