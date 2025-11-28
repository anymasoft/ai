import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

// Users table with role and plan
export const users = sqliteTable("users", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified"),
  image: text("image"),
  role: text("role", { enum: ["user", "admin"] })
    .notNull()
    .default("user"),
  plan: text("plan", { enum: ["free", "basic", "professional", "enterprise"] })
    .notNull()
    .default("free"),
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
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

// Initialize SQLite database only on server side
let sqlite: Database.Database;
let _db: ReturnType<typeof drizzle>;

function getDatabase() {
  if (!_db) {
    const dbPath = process.env.DATABASE_URL || "sqlite.db";
    sqlite = new Database(dbPath);
    _db = drizzle(sqlite);

    // Auto-create tables on first run (for development)
    if (process.env.NODE_ENV !== "production") {
      try {
        // Create users table
        sqlite.exec(`
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

        // Create accounts table
        sqlite.exec(`
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

        // Create sessions table
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS sessions (
            sessionToken TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            expires INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        // Create verification tokens table
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS verificationTokens (
            identifier TEXT NOT NULL,
            token TEXT NOT NULL,
            expires INTEGER NOT NULL,
            PRIMARY KEY (identifier, token)
          );
        `);

        // Create competitors table
        sqlite.exec(`
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

        console.log("✅ Database tables initialized");
      } catch (error) {
        console.error("❌ Database initialization error:", error);
      }
    }
  }
  return _db;
}

export const db = getDatabase();
