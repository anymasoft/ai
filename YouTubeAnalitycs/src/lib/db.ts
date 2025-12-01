import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

// Users table with role and plan
export const users = sqliteTable("users", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  image: text("image"),
  role: text("role", { enum: ["user", "admin"] })
    .notNull()
    .$default(() => "user"),
  plan: text("plan", { enum: ["free", "basic", "professional", "enterprise"] })
    .notNull()
    .$default(() => "free"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now())
    .$onUpdate(() => Date.now()),
});

// Accounts table for OAuth
export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

// Sessions table
export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires").notNull(),
});

// Verification tokens table
export const verificationTokens = sqliteTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires").notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// Competitors table
export const competitors = sqliteTable("competitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull().default("youtube"),
  channelId: text("channelId").notNull(),
  handle: text("handle").notNull(),
  title: text("title").notNull(),
  avatarUrl: text("avatarUrl"),
  subscriberCount: integer("subscriberCount").notNull().default(0),
  videoCount: integer("videoCount").notNull().default(0),
  viewCount: integer("viewCount").notNull().default(0),
  lastSyncedAt: integer("lastSyncedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// AI Insights table - хранит результаты AI-анализа каналов
export const aiInsights = sqliteTable("ai_insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  competitorId: integer("competitorId")
    .notNull()
    .references(() => competitors.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(), // Краткая сводка по каналу
  strengths: text("strengths").notNull(), // Сильные стороны (JSON array)
  weaknesses: text("weaknesses").notNull(), // Слабые стороны (JSON array)
  opportunities: text("opportunities").notNull(), // Возможности (JSON array)
  threats: text("threats").notNull(), // Угрозы (JSON array)
  recommendations: text("recommendations").notNull(), // Рекомендации (JSON array)
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// Инициализация SQLite базы данных только на серверной стороне
let _client: ReturnType<typeof createClient>;
let _db: ReturnType<typeof drizzle>;

function getDatabase() {
  if (!_db) {
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";

    // Создаём клиент для локальной файловой базы данных
    _client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    _db = drizzle(_client);

    // Автоматическое создание таблиц при первом запуске (для разработки)
    if (process.env.NODE_ENV !== "production") {
      try {
        // Создание таблицы users
        _client.execute(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT,
            email TEXT NOT NULL UNIQUE,
            emailVerified INTEGER,
            image TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            plan TEXT NOT NULL DEFAULT 'free',
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL
          );
        `);

        // Создание таблицы accounts
        _client.execute(`
          CREATE TABLE IF NOT EXISTS accounts (
            userId TEXT NOT NULL,
            type TEXT NOT NULL,
            provider TEXT NOT NULL,
            providerAccountId TEXT NOT NULL,
            refresh_token TEXT,
            access_token TEXT,
            expires_at INTEGER,
            token_type TEXT,
            scope TEXT,
            id_token TEXT,
            session_state TEXT,
            PRIMARY KEY (provider, providerAccountId),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        // Создание таблицы sessions
        _client.execute(`
          CREATE TABLE IF NOT EXISTS sessions (
            sessionToken TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            expires INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        // Создание таблицы verificationTokens
        _client.execute(`
          CREATE TABLE IF NOT EXISTS verificationTokens (
            identifier TEXT NOT NULL,
            token TEXT NOT NULL,
            expires INTEGER NOT NULL,
            PRIMARY KEY (identifier, token)
          );
        `);

        // Создание таблицы competitors
        _client.execute(`
          CREATE TABLE IF NOT EXISTS competitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            platform TEXT NOT NULL DEFAULT 'youtube',
            channelId TEXT NOT NULL,
            handle TEXT NOT NULL,
            title TEXT NOT NULL,
            avatarUrl TEXT,
            subscriberCount INTEGER NOT NULL DEFAULT 0,
            videoCount INTEGER NOT NULL DEFAULT 0,
            viewCount INTEGER NOT NULL DEFAULT 0,
            lastSyncedAt INTEGER NOT NULL,
            createdAt INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        // Создание таблицы ai_insights
        _client.execute(`
          CREATE TABLE IF NOT EXISTS ai_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competitorId INTEGER NOT NULL,
            summary TEXT NOT NULL,
            strengths TEXT NOT NULL,
            weaknesses TEXT NOT NULL,
            opportunities TEXT NOT NULL,
            threats TEXT NOT NULL,
            recommendations TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            FOREIGN KEY (competitorId) REFERENCES competitors(id) ON DELETE CASCADE
          );
        `);

        console.log("✅ Таблицы базы данных инициализированы");
      } catch (error) {
        console.error("❌ Ошибка инициализации базы данных:", error);
      }
    }
  }
  return _db;
}

export const db = getDatabase();
