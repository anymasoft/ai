import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";
import { getUserPaymentInfo } from "./payments";

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
      // При первом логине устанавливаем базовые данные из user объекта
      if (user) {
        token.id = user.id;
        // @ts-ignore
        token.role = user.role || "user";
      }

      // КРИТИЧЕСКОЕ: ВСЕГДА синхронизируем plan и billingCycle с БД если есть userId
      // Это гарантирует что JWT всегда содержит актуальные данные
      if (token.sub) {
        try {
          const paymentInfo = await getUserPaymentInfo(token.sub);
          if (paymentInfo) {
            // @ts-ignore
            token.plan = paymentInfo.plan;
            // @ts-ignore
            token.billingCycle = paymentInfo.billingCycle;
            console.log(`[AUTH jwt] Synced plan from DB for user ${token.sub}: ${paymentInfo.plan} (${paymentInfo.billingCycle})`);
          } else {
            // Если информация не найдена, ставим дефолтные значения
            // @ts-ignore
            token.plan = "free";
            // @ts-ignore
            token.billingCycle = "monthly";
            console.log(`[AUTH jwt] No payment info found for user ${token.sub}, setting defaults`);
          }
        } catch (error) {
          console.error(`[AUTH jwt] Error syncing payment info from DB:`, error);
          // При ошибке оставляем текущие значения или ставим defaults
          // @ts-ignore
          token.plan = token.plan || "free";
          // @ts-ignore
          token.billingCycle = token.billingCycle || "monthly";
        }
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
        // @ts-ignore
        session.user.billingCycle = token.billingCycle || "monthly";
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
