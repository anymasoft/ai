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

      // КРИТИЧЕСКОЕ: ВСЕГДА синхронизируем plan с БД если есть userId
      // Это гарантирует что JWT всегда содержит актуальный план
      // ВКЛЮЧАЕТ: автоматический downgrade если подписка истекла
      if (token.sub) {
        try {
          const paymentInfo = await getUserPaymentInfo(token.sub);
          if (paymentInfo) {
            // @ts-ignore
            token.plan = paymentInfo.plan;
            // @ts-ignore
            token.expiresAt = paymentInfo.expiresAt;

            // АВТОМАТИЧЕСКИЙ DOWNGRADE В БД: если план стал 'free' (истекла подписка)
            // и в БД у пользователя ещё стоит платный план
            if (paymentInfo.plan === "free" && user?.plan !== "free") {
              console.log(
                `[AUTH jwt] Auto-downgrading user ${token.sub} to free in DB (subscription expired)`
              );
              // Обновляем БД, чтобы в следующий раз план уже был free
              const now = Math.floor(Date.now() / 1000);
              try {
                await db.execute(
                  `UPDATE users SET plan = ?, expiresAt = ?, updatedAt = ? WHERE id = ?`,
                  ["free", null, now, token.sub]
                );
                console.log(`[AUTH jwt] Successfully updated user ${token.sub} to free in DB`);
              } catch (dbError) {
                console.error(`[AUTH jwt] Error updating user to free in DB:`, dbError);
                // Не критично, JWT всё равно вернёт plan=free
              }
            }

            console.log(
              `[AUTH jwt] Synced plan from DB for user ${token.sub}: ${paymentInfo.plan}`
            );
          } else {
            // Если информация не найдена, ставим дефолтный plan
            // @ts-ignore
            token.plan = "free";
            console.log(`[AUTH jwt] No payment info found for user ${token.sub}, setting plan to free`);
          }
        } catch (error) {
          console.error(`[AUTH jwt] Error syncing plan from DB:`, error);
          // При ошибке оставляем текущий plan или ставим free
          // @ts-ignore
          token.plan = token.plan || "free";
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
        session.user.expiresAt = token.expiresAt || null;
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
