import { createClient } from "@libsql/client";

// Инициализация SQLite базы данных
let _client: ReturnType<typeof createClient> | null = null;

/**
 * Асинхронно проверяет существование колонки в таблице
 * Использует PRAGMA table_info для получения информации о колонках таблицы
 * Это безопасный способ проверки без попыток выполнения ALTER TABLE
 */
async function columnExists(
  client: any,
  tableName: string,
  columnName: string
): Promise<boolean> {
  try {
    const result = await client.execute(`PRAGMA table_info(${tableName});`);
    // Результат содержит массив объектов с информацией о колонках
    // Каждый объект имеет поле 'name' с именем колонки
    const columns = result.rows as Array<{ name: string; [key: string]: any }>;
    return columns.some(col => col.name === columnName);
  } catch (e) {
    // Если PRAGMA не поддерживается (маловероятно), логируем и возвращаем false
    // Это позволит коду дальше попытаться добавить колонку и обработать ошибку правильно
    console.warn(`⚠️  Failed to check column existence via PRAGMA: ${e}`);
    return false;
  }
}

/**
 * Асинхронно добавляет колонку в таблицу ТОЛЬКО если её нет
 * Идемпотентная операция - безопасна для повторного запуска
 * Никогда не пытается выполнить ALTER TABLE если колонка уже существует
 * @param client - клиент БД
 * @param tableName - имя таблицы (без кавычек)
 * @param columnName - имя колонки
 * @param columnDef - определение колонки (например 'TEXT', 'INTEGER NOT NULL DEFAULT 0')
 */
async function addColumnIfNotExists(
  client: any,
  tableName: string,
  columnName: string,
  columnDef: string
): Promise<void> {
  const exists = await columnExists(client, tableName, columnName);

  if (exists) {
    console.log(
      `✔️ Column ${columnName} already exists in ${tableName}, skipping`
    );
    return;
  }

  try {
    await client.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`
    );
    console.log(`✔️ Added column ${columnName} to ${tableName}`);
  } catch (error: any) {
    // Если всё же произошла ошибка, выводим её (не скрываем)
    // Это поможет выявить реальные проблемы с БД структурой
    console.error(
      `❌ Failed to add column ${columnName} to ${tableName}: ${error.message}`
    );
    throw error; // Пробрасываем ошибку дальше для обработки на уровне выше
  }
}

async function getClient() {
  if (!_client) {
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";

    _client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Инициализация таблиц (выполняется один раз при старте)
    if (process.env.NODE_ENV !== "production") {
      try {
        // Таблицы NextAuth
        _client.execute(`CREATE TABLE IF NOT EXISTS users (
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
        );`);

        _client.execute(`CREATE TABLE IF NOT EXISTS accounts (
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
        );`);

        _client.execute(`CREATE TABLE IF NOT EXISTS sessions (
          sessionToken TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          expires INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        _client.execute(`CREATE TABLE IF NOT EXISTS verificationTokens (
          identifier TEXT NOT NULL,
          token TEXT NOT NULL,
          expires INTEGER NOT NULL,
          PRIMARY KEY (identifier, token)
        );`);

        // Основные таблицы приложения
        _client.execute(`CREATE TABLE IF NOT EXISTS competitors (
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
        );`);

        _client.execute(`CREATE TABLE IF NOT EXISTS channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT,
          channelId TEXT,
          title TEXT,
          createdAt INTEGER
        );`);

        _client.execute(`CREATE TABLE IF NOT EXISTS ai_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          competitorId INTEGER NOT NULL,
          summary TEXT NOT NULL,
          strengths TEXT NOT NULL,
          weaknesses TEXT NOT NULL,
          opportunities TEXT NOT NULL,
          threats TEXT NOT NULL,
          recommendations TEXT NOT NULL,
          strategicSummary TEXT,
          contentPatterns TEXT,
          videoIdeas TEXT,
          generatedAt TEXT,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (competitorId) REFERENCES competitors(id) ON DELETE CASCADE
        );`);

        // Миграция: добавляем новые колонки для расширенного SWOT-анализа
        // Использует idempotent проверку через PRAGMA table_info
        await addColumnIfNotExists(_client, 'ai_insights', 'strategicSummary', 'TEXT');
        await addColumnIfNotExists(_client, 'ai_insights', 'contentPatterns', 'TEXT');
        await addColumnIfNotExists(_client, 'ai_insights', 'videoIdeas', 'TEXT');

        _client.execute(`CREATE TABLE IF NOT EXISTS channel_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          channelId TEXT NOT NULL,
          subscriberCount INTEGER NOT NULL DEFAULT 0,
          videoCount INTEGER NOT NULL DEFAULT 0,
          viewCount INTEGER NOT NULL DEFAULT 0,
          date TEXT NOT NULL,
          fetchedAt INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_channel_metrics_lookup
          ON channel_metrics(channelId, date);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS channel_videos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channelId TEXT NOT NULL,
          videoId TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          thumbnailUrl TEXT,
          viewCount INTEGER NOT NULL DEFAULT 0,
          likeCount INTEGER NOT NULL DEFAULT 0,
          commentCount INTEGER NOT NULL DEFAULT 0,
          publishDate TEXT,
          fetchedAt INTEGER NOT NULL,
          data TEXT
        );`);

        // publishDate уже определён в CREATE TABLE выше
        // Добавляем колонку только если её нет (для старых БД)
        await addColumnIfNotExists(_client, 'channel_videos', 'publishDate', 'TEXT');

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_channel_videos_lookup
          ON channel_videos(channelId, videoId);`);

        // Миграция: добавляем поле duration для длительности видео
        // Использует idempotent проверку через PRAGMA table_info
        await addColumnIfNotExists(_client, 'channel_videos', 'duration', 'TEXT');

        _client.execute(`CREATE TABLE IF NOT EXISTS content_intelligence (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channelId TEXT NOT NULL,
          data TEXT NOT NULL,
          data_ru TEXT,
          generatedAt INTEGER NOT NULL
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_content_intelligence_lookup
          ON content_intelligence(channelId, generatedAt DESC);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS momentum_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channelId TEXT NOT NULL,
          data TEXT NOT NULL,
          data_ru TEXT,
          generatedAt INTEGER NOT NULL
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_momentum_insights_lookup
          ON momentum_insights(channelId, generatedAt DESC);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS audience_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channelId TEXT NOT NULL,
          data TEXT NOT NULL,
          data_ru TEXT,
          generatedAt INTEGER NOT NULL
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_audience_insights_lookup
          ON audience_insights(channelId, generatedAt DESC);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS video_details (
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
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_video_details_lookup
          ON video_details(videoId);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS video_comments (
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
          fetchedAt INTEGER NOT NULL,
          channelId TEXT,
          data TEXT
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_video_comments_video
          ON video_comments(videoId, publishedTime DESC);`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_video_comments_author
          ON video_comments(authorChannelId);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS comment_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          videoId TEXT NOT NULL,
          channelId TEXT NOT NULL,
          data TEXT NOT NULL,
          data_ru TEXT,
          generatedAt INTEGER NOT NULL
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_comment_insights_lookup
          ON comment_insights(videoId, generatedAt DESC);`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_comment_insights_channel
          ON comment_insights(channelId, generatedAt DESC);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS channel_ai_comment_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channelId TEXT NOT NULL,
          resultJson TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          progress_current INTEGER DEFAULT 0,
          progress_total INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending'
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_channelId
          ON channel_ai_comment_insights(channelId);`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_createdAt
          ON channel_ai_comment_insights(createdAt DESC);`);

        _client.execute(`CREATE TABLE IF NOT EXISTS deep_audience (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channelId TEXT NOT NULL,
          data TEXT NOT NULL,
          data_ru TEXT,
          createdAt INTEGER NOT NULL
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_deep_audience_channelId
          ON deep_audience(channelId);`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_deep_audience_createdAt
          ON deep_audience(createdAt DESC);`);

        // Таблица для сравнительного анализа конкурентов
        _client.execute(`CREATE TABLE IF NOT EXISTS comparative_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          data TEXT NOT NULL,
          data_ru TEXT,
          generatedAt INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_comparative_analysis_userId
          ON comparative_analysis(userId, generatedAt DESC);`);

        // Таблица для AI анализа трендовых видео
        _client.execute(`CREATE TABLE IF NOT EXISTS trending_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          videoCount INTEGER NOT NULL DEFAULT 0,
          summary TEXT NOT NULL,
          themes TEXT NOT NULL,
          formats TEXT NOT NULL,
          recommendations TEXT NOT NULL,
          generatedAt INTEGER NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_trending_insights_userId
          ON trending_insights(userId, generatedAt DESC);`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_trending_insights_createdAt
          ON trending_insights(createdAt DESC);`);

        // Таблица для сохранения сгенерированных сценариев
        _client.execute(`CREATE TABLE IF NOT EXISTS generated_scripts (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          title TEXT NOT NULL,
          hook TEXT NOT NULL,
          outline TEXT NOT NULL,
          scriptText TEXT NOT NULL,
          whyItShouldWork TEXT NOT NULL,
          sourceVideos TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_generated_scripts_userId
          ON generated_scripts(userId, createdAt DESC);`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_generated_scripts_createdAt
          ON generated_scripts(createdAt DESC);`);

        // Таблицы глобального кеша YouTube данных
        // Эти таблицы содержат общие данные, одинаковые для всех пользователей

        // Кеш базовой информации о каналах
        _client.execute(`CREATE TABLE IF NOT EXISTS channels_cache (
          channelId TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          handle TEXT,
          avatarUrl TEXT,
          subscriberCount INTEGER DEFAULT 0,
          videoCount INTEGER DEFAULT 0,
          viewCount INTEGER DEFAULT 0,
          lastUpdated INTEGER NOT NULL
        );`);

        // Кеш видео каналов (список видео с основными метриками)
        _client.execute(`CREATE TABLE IF NOT EXISTS channel_videos_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channelId TEXT NOT NULL,
          videoId TEXT NOT NULL,
          title TEXT NOT NULL,
          thumbnailUrl TEXT,
          viewCount INTEGER DEFAULT 0,
          likeCount INTEGER DEFAULT 0,
          commentCount INTEGER DEFAULT 0,
          publishDate TEXT,
          duration TEXT,
          lastUpdated INTEGER NOT NULL,
          UNIQUE(videoId)
        );`);

        _client.execute(`CREATE INDEX IF NOT EXISTS idx_channel_videos_cache_lookup
          ON channel_videos_cache(channelId, videoId);`);

        // Кеш детальных данных видео (из /v1/youtube/video)
        _client.execute(`CREATE TABLE IF NOT EXISTS videos_cache (
          videoId TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          viewCount INTEGER DEFAULT 0,
          likeCount INTEGER DEFAULT 0,
          commentCount INTEGER DEFAULT 0,
          publishDate TEXT,
          durationMs INTEGER,
          keywords TEXT,
          transcriptText TEXT,
          lastUpdated INTEGER NOT NULL
        );`);

        // Состояние пользователя для каждого канала (синхронизированы ли видео)
        _client.execute(`CREATE TABLE IF NOT EXISTS user_channel_state (
          userId TEXT NOT NULL,
          channelId TEXT NOT NULL,
          hasSyncedTopVideos INTEGER NOT NULL DEFAULT 0,
          hasShownVideos INTEGER NOT NULL DEFAULT 0,

          PRIMARY KEY (userId, channelId)
        );`);

        // Миграция: добавляем колонку hasShownVideos для отслеживания показа видео
        // Использует idempotent проверку через PRAGMA table_info
        await addColumnIfNotExists(_client, 'user_channel_state', 'hasShownVideos', 'INTEGER NOT NULL DEFAULT 0');

        console.log("✅ Tables initialized");
      } catch (error) {
        console.error("❌ DB init error:", error);
      }
    }
  }
  return _client;
}

export const db = await getClient();
