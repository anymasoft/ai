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
          // Создаём нового пользователя в БД с Trial тарифом на 3 дня
          const now = Math.floor(Date.now() / 1000);
          const threeDaysInSeconds = 3 * 24 * 60 * 60; // 259,200 секунд
          const trialExpiresAt = now + threeDaysInSeconds;

          await db.execute(
            "INSERT INTO users (id, email, name, plan, expiresAt, paymentProvider, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              user.id,
              user.email,
              user.name || user.email.split("@")[0],
              "trial", // Новые пользователи получают Trial тариф
              trialExpiresAt,
              "trial", // Платёжный провайдер: trial
              now,
              now,
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
  debug: true,
};
