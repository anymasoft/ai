import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

// Users table with role, plan and language
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
  language: text("language", { enum: ["en", "ru"] })
    .notNull()
    .$default(() => "en"),
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

// Channel Metrics table - хранит исторические метрики каналов для timeseries
export const channelMetrics = sqliteTable("channel_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelId: text("channelId").notNull(), // ID канала из ScrapeCreators
  subscriberCount: integer("subscriberCount").notNull().default(0),
  videoCount: integer("videoCount").notNull().default(0),
  viewCount: integer("viewCount").notNull().default(0),
  date: text("date").notNull(), // YYYY-MM-DD формат
  fetchedAt: integer("fetchedAt")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// Channel Videos table - хранит топ видео каналов для анализа контента
export const channelVideos = sqliteTable("channel_videos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: text("channelId").notNull(), // ID канала из ScrapeCreators
  videoId: text("videoId").notNull(), // YouTube video ID
  title: text("title").notNull(), // Название видео
  thumbnailUrl: text("thumbnailUrl"), // URL миниатюры
  viewCount: integer("viewCount").notNull().default(0), // Количество просмотров
  likeCount: integer("likeCount").notNull().default(0), // Количество лайков
  commentCount: integer("commentCount").notNull().default(0), // Количество комментариев
  publishedAt: text("publishedAt").notNull(), // Дата публикации (ISO8601)
  fetchedAt: integer("fetchedAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время получения данных
});

// Content Intelligence table - хранит AI-анализ контента видео
export const contentIntelligence = sqliteTable("content_intelligence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: text("channelId").notNull(), // ID канала из ScrapeCreators
  data: text("data").notNull(), // JSON с результатами анализа
  generatedAt: integer("generatedAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время генерации анализа
});

// Momentum Insights table - хранит анализ растущих тем
export const momentumInsights = sqliteTable("momentum_insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: text("channelId").notNull(), // ID канала из ScrapeCreators
  data: text("data").notNull(), // JSON с результатами momentum анализа
  generatedAt: integer("generatedAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время генерации анализа
});

// Audience Insights table - хранит анализ вовлеченности аудитории
export const audienceInsights = sqliteTable("audience_insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: text("channelId").notNull(), // ID канала из ScrapeCreators
  data: text("data").notNull(), // JSON с результатами audience анализа (EN)
  data_ru: text("data_ru"), // JSON с русским переводом
  generatedAt: integer("generatedAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время генерации анализа
});

// Video Details table - хранит детальные данные видео из /v1/youtube/video
export const videoDetails = sqliteTable("video_details", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: text("videoId").notNull().unique(), // YouTube video ID
  url: text("url").notNull(), // Полный URL видео
  likeCount: integer("likeCount").notNull().default(0), // Лайки
  commentCount: integer("commentCount").notNull().default(0), // Комментарии
  viewCount: integer("viewCount").notNull().default(0), // Просмотры
  durationMs: integer("durationMs"), // Длительность в миллисекундах
  keywordsJson: text("keywordsJson"), // JSON массив ключевых слов
  transcriptShort: text("transcriptShort"), // Первые 2-4k символов транскрипта
  updatedAt: integer("updatedAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время последнего обновления
});

// Video Comments table - хранит комментарии к видео
export const videoComments = sqliteTable("video_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: text("videoId").notNull(), // YouTube video ID
  commentId: text("commentId").notNull().unique(), // ID комментария из API
  content: text("content").notNull(), // Текст комментария
  publishedTime: text("publishedTime").notNull(), // Время публикации (ISO8601)
  replyLevel: integer("replyLevel").notNull().default(0), // Уровень вложенности
  likes: integer("likes").notNull().default(0), // Лайки комментария
  replies: integer("replies").notNull().default(0), // Количество ответов
  authorName: text("authorName").notNull(), // Имя автора
  authorChannelId: text("authorChannelId").notNull(), // ID канала автора
  isVerified: integer("isVerified", { mode: "boolean" }).notNull().default(false), // Верифицирован ли автор
  isCreator: integer("isCreator", { mode: "boolean" }).notNull().default(false), // Автор = создатель видео
  fetchedAt: integer("fetchedAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время получения данных
});

// Comment Insights table - хранит AI-анализ комментариев
export const commentInsights = sqliteTable("comment_insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: text("videoId").notNull(), // YouTube video ID
  channelId: text("channelId").notNull(), // ID канала для группировки
  data: text("data").notNull(), // JSON с результатами AI-анализа комментариев
  generatedAt: integer("generatedAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время генерации анализа
});

// Channel AI Comment Insights table - хранит глубокий AI-анализ комментариев канала (v2.0)
export const channelAICommentInsights = sqliteTable("channel_ai_comment_insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: text("channelId").notNull(), // ID канала
  resultJson: text("resultJson").notNull(), // JSON с результатами глубокого AI-анализа
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время создания анализа
});

// Deep Audience Intelligence table - хранит глубокий AI-анализ аудитории канала
export const deepAudience = sqliteTable("deep_audience", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: text("channelId").notNull(), // ID канала
  data: text("data").notNull(), // JSON с результатами анализа (EN)
  data_ru: text("data_ru"), // JSON с русским переводом
  createdAt: integer("createdAt")
    .notNull()
    .$defaultFn(() => Date.now()), // Время создания анализа
});

// Инициализация SQLite базы данных только на серверной стороне
let _client: ReturnType<typeof createClient>;
let _db: ReturnType<typeof drizzle>;
let _migrationsRun = false;

/**
 * runMigrations - выполняет миграции БД один раз при старте сервера
 * Содержит все ALTER TABLE команды для изменения структуры таблиц
 */
function runMigrations() {
  if (_migrationsRun) {
    return; // Миграции уже выполнены
  }

  console.log("[DB] Running migrations on startup...");

  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  // Migration disabled — column data_ru already exists and must not be altered again.
  console.log("[DB] Migration audience_insights.data_ru disabled");

  client.close();
  _migrationsRun = true;
  console.log("[DB] Migrations completed");
}

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
            language TEXT NOT NULL DEFAULT 'en',
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

        // Создание таблицы channel_metrics
        _client.execute(`
          CREATE TABLE IF NOT EXISTS channel_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            channelId TEXT NOT NULL,
            subscriberCount INTEGER NOT NULL DEFAULT 0,
            videoCount INTEGER NOT NULL DEFAULT 0,
            viewCount INTEGER NOT NULL DEFAULT 0,
            date TEXT NOT NULL,
            fetchedAt INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        // Создание индекса для быстрого поиска метрик по каналу и дате
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_channel_metrics_lookup
          ON channel_metrics(channelId, date);
        `);

        // Создание таблицы channel_videos (стабильная схема со всеми колонками)
        _client.execute(`
          CREATE TABLE IF NOT EXISTS channel_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT NOT NULL,
            videoId TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            thumbnailUrl TEXT,
            viewCount INTEGER NOT NULL DEFAULT 0,
            likeCount INTEGER NOT NULL DEFAULT 0,
            commentCount INTEGER NOT NULL DEFAULT 0,
            publishedAt TEXT NOT NULL,
            fetchedAt INTEGER NOT NULL
          );
        `);

        // Создание индекса для быстрого поиска видео по каналу
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_channel_videos_lookup
          ON channel_videos(channelId, videoId);
        `);

        // Создание таблицы content_intelligence
        _client.execute(`
          CREATE TABLE IF NOT EXISTS content_intelligence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT NOT NULL,
            data TEXT NOT NULL,
            generatedAt INTEGER NOT NULL
          );
        `);

        // Создание индекса для быстрого поиска анализа по каналу
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_content_intelligence_lookup
          ON content_intelligence(channelId, generatedAt DESC);
        `);

        // Создание таблицы momentum_insights
        _client.execute(`
          CREATE TABLE IF NOT EXISTS momentum_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT NOT NULL,
            data TEXT NOT NULL,
            generatedAt INTEGER NOT NULL
          );
        `);

        // Создание индекса для быстрого поиска momentum по каналу
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_momentum_insights_lookup
          ON momentum_insights(channelId, generatedAt DESC);
        `);

        // Создание таблицы audience_insights
        _client.execute(`
          CREATE TABLE IF NOT EXISTS audience_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT NOT NULL,
            data TEXT NOT NULL,
            generatedAt INTEGER NOT NULL
          );
        `);

        // Создание индекса для быстрого поиска audience анализа по каналу
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_audience_insights_lookup
          ON audience_insights(channelId, generatedAt DESC);
        `);

        // Создание таблицы video_details
        _client.execute(`
          CREATE TABLE IF NOT EXISTS video_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            videoId TEXT NOT NULL UNIQUE,
            url TEXT NOT NULL,
            likeCount INTEGER NOT NULL DEFAULT 0,
            commentCount INTEGER NOT NULL DEFAULT 0,
            viewCount INTEGER NOT NULL DEFAULT 0,
            durationMs INTEGER,
            keywordsJson TEXT,
            transcriptShort TEXT,
            updatedAt INTEGER NOT NULL
          );
        `);

        // Создание индекса для быстрого поиска деталей видео
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_video_details_lookup
          ON video_details(videoId);
        `);

        // Создание таблицы video_comments
        _client.execute(`
          CREATE TABLE IF NOT EXISTS video_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            videoId TEXT NOT NULL,
            commentId TEXT NOT NULL UNIQUE,
            content TEXT NOT NULL,
            publishedTime TEXT NOT NULL,
            replyLevel INTEGER NOT NULL DEFAULT 0,
            likes INTEGER NOT NULL DEFAULT 0,
            replies INTEGER NOT NULL DEFAULT 0,
            authorName TEXT NOT NULL,
            authorChannelId TEXT NOT NULL,
            isVerified INTEGER NOT NULL DEFAULT 0,
            isCreator INTEGER NOT NULL DEFAULT 0,
            fetchedAt INTEGER NOT NULL
          );
        `);

        // Создание индексов для быстрого поиска комментариев
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_video_comments_video
          ON video_comments(videoId, publishedTime DESC);
        `);

        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_video_comments_author
          ON video_comments(authorChannelId);
        `);

        // Создание таблицы comment_insights
        _client.execute(`
          CREATE TABLE IF NOT EXISTS comment_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            videoId TEXT NOT NULL,
            channelId TEXT NOT NULL,
            data TEXT NOT NULL,
            generatedAt INTEGER NOT NULL
          );
        `);

        // Создание индекса для быстрого поиска insights комментариев
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_comment_insights_lookup
          ON comment_insights(videoId, generatedAt DESC);
        `);

        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_comment_insights_channel
          ON comment_insights(channelId, generatedAt DESC);
        `);

        // Создание таблицы channel_ai_comment_insights (ЭТАП 4.7: Deep Analysis)
        _client.execute(`
          CREATE TABLE IF NOT EXISTS channel_ai_comment_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT NOT NULL,
            resultJson TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            progress_current INTEGER DEFAULT 0,
            progress_total INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            analysis_en TEXT,
            analysis_ru TEXT
          );
        `);

        // Создание индексов для channel_ai_comment_insights
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_channelId
          ON channel_ai_comment_insights(channelId);
        `);

        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_createdAt
          ON channel_ai_comment_insights(createdAt DESC);
        `);

        // Создание таблицы deep_audience (Deep Audience Intelligence)
        _client.execute(`
          CREATE TABLE IF NOT EXISTS deep_audience (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT NOT NULL,
            data TEXT NOT NULL,
            data_ru TEXT,
            createdAt INTEGER NOT NULL
          );
        `);

        // Создание индексов для deep_audience
        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_deep_audience_channelId
          ON deep_audience(channelId);
        `);

        _client.execute(`
          CREATE INDEX IF NOT EXISTS idx_deep_audience_createdAt
          ON deep_audience(createdAt DESC);
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

// Выполняем миграции один раз при загрузке модуля
runMigrations();
