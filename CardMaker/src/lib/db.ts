import { createClient } from "@libsql/client";

// Инициализация SQLite базы данных
let _client: ReturnType<typeof createClient> | null = null;

/**
 * Асинхронно проверяет существование колонки в таблице
 */
async function columnExists(
  client: any,
  tableName: string,
  columnName: string
): Promise<boolean> {
  try {
    const result = await client.execute(`PRAGMA table_info(${tableName});`);
    const columns = result.rows as Array<{ name: string; [key: string]: any }>;
    return columns.some(col => col.name === columnName);
  } catch (e) {
    console.warn(`⚠️  Failed to check column existence via PRAGMA: ${e}`);
    return false;
  }
}

/**
 * Асинхронно добавляет колонку в таблицу ТОЛЬКО если её нет
 */
async function addColumnIfNotExists(
  client: any,
  tableName: string,
  columnName: string,
  columnDef: string
): Promise<void> {
  const exists = await columnExists(client, tableName, columnName);

  if (exists) {
    return;
  }

  try {
    await client.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`
    );
  } catch (error: any) {
    console.error(
      `❌ Failed to add column ${columnName} to ${tableName}: ${error.message}`
    );
    throw error;
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
        // ========== NextAuth Tables ==========
        await _client.execute(`CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT,
          email TEXT NOT NULL UNIQUE,
          emailVerified INTEGER,
          image TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          plan TEXT NOT NULL DEFAULT 'free',
          language TEXT NOT NULL DEFAULT 'en',
          disabled INTEGER NOT NULL DEFAULT 0,
          expiresAt INTEGER,
          paymentProvider TEXT DEFAULT "free",
          generation_balance INTEGER NOT NULL DEFAULT 0,
          generation_used INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );`);

        // Добавить поля для существующих пользователей (миграция)
        await addColumnIfNotExists(_client, 'users', 'generation_balance', 'INTEGER NOT NULL DEFAULT 0');
        await addColumnIfNotExists(_client, 'users', 'generation_used', 'INTEGER NOT NULL DEFAULT 0');

        await _client.execute(`CREATE TABLE IF NOT EXISTS accounts (
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

        await _client.execute(`CREATE TABLE IF NOT EXISTS sessions (
          sessionToken TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          expires INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        await _client.execute(`CREATE TABLE IF NOT EXISTS verificationTokens (
          identifier TEXT NOT NULL,
          token TEXT NOT NULL,
          expires INTEGER NOT NULL,
          PRIMARY KEY (identifier, token)
        );`);

        // ========== CardMaker Tables ==========
        await _client.execute(`CREATE TABLE IF NOT EXISTS product_cards (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          marketplace TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_product_cards_userId
          ON product_cards(userId, createdAt DESC);`);

        // ========== Billing/Payments Tables ==========
        await _client.execute(`CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          planId TEXT NOT NULL,
          externalPaymentId TEXT NOT NULL UNIQUE,
          amount REAL NOT NULL,
          currency TEXT DEFAULT 'RUB',
          status TEXT NOT NULL DEFAULT 'pending',
          billingCycle TEXT DEFAULT 'monthly',
          provider TEXT DEFAULT 'yookassa',
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          expiresAt INTEGER,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_payments_externalPaymentId
          ON payments(externalPaymentId);`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_payments_provider
          ON payments(provider);`);

        // Таблица для переопределения подписок (ручное управление платежами)
        await _client.execute(`CREATE TABLE IF NOT EXISTS admin_subscriptions (
          userId TEXT PRIMARY KEY,
          plan TEXT DEFAULT 'free',
          isPaid INTEGER DEFAULT 0,
          expiresAt INTEGER,
          provider TEXT DEFAULT 'manual',
          updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        // Таблица для суточного использования лимитов
        await _client.execute(`CREATE TABLE IF NOT EXISTS user_usage_daily (
          userId TEXT NOT NULL,
          day TEXT NOT NULL,
          cardsUsed INTEGER DEFAULT 0,
          updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
          PRIMARY KEY (userId, day)
        );`);

        // ========== System Tables ==========
        await _client.execute(`CREATE TABLE IF NOT EXISTS system_flags (
          key TEXT PRIMARY KEY,
          value TEXT DEFAULT 'false',
          updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        // Таблица для сообщений обратной связи
        await _client.execute(`CREATE TABLE IF NOT EXISTS admin_messages (
          id TEXT PRIMARY KEY,
          email TEXT,
          firstName TEXT,
          lastName TEXT,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          page TEXT DEFAULT 'feedback',
          userId TEXT,
          createdAt INTEGER NOT NULL,
          isRead INTEGER DEFAULT 0,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_messages_createdAt
          ON admin_messages(createdAt DESC);`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_admin_messages_isRead
          ON admin_messages(isRead, createdAt DESC);`);

        // ========== CONFIG Tables ==========
        // System Prompts для генерации и валидации
        await _client.execute(`CREATE TABLE IF NOT EXISTS system_prompts (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          content TEXT NOT NULL DEFAULT '',
          is_active INTEGER DEFAULT 1,
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_system_prompts_key_active
          ON system_prompts(key, is_active);`);

        // Стили описаний
        await _client.execute(`CREATE TABLE IF NOT EXISTS styles (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          prompt TEXT NOT NULL DEFAULT '',
          is_active INTEGER DEFAULT 1,
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_styles_key_active
          ON styles(key, is_active);`);

        // Правила маркетплейсов
        await _client.execute(`CREATE TABLE IF NOT EXISTS marketplace_rules (
          id TEXT PRIMARY KEY,
          marketplace TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          is_active INTEGER DEFAULT 1,
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_marketplace_rules_marketplace
          ON marketplace_rules(marketplace, is_active);`);

        // Стоп-слова
        await _client.execute(`CREATE TABLE IF NOT EXISTS stop_words (
          id TEXT PRIMARY KEY,
          marketplace TEXT,
          category TEXT NOT NULL,
          words TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_stop_words_marketplace_category
          ON stop_words(marketplace, category, is_active);`);

        // ========== CATEGORY PROMPTS ==========
        // Мини-промпты для разных категорий товаров
        await _client.execute(`CREATE TABLE IF NOT EXISTS category_prompts (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          prompt TEXT NOT NULL DEFAULT '',
          is_active INTEGER DEFAULT 1,
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_category_prompts_key_active
          ON category_prompts(key, is_active);`);

        // Инициализируем категории если их ещё нет
        const categoryCheckResult = await _client.execute(`SELECT COUNT(*) as count FROM category_prompts;`);
        const categoryCount = (categoryCheckResult.rows?.[0] as any)?.count || 0;

        if (categoryCount === 0) {
          await _client.execute(`INSERT INTO category_prompts (id, key, title, prompt, is_active)
            VALUES
              ('cp_electronics', 'electronics', 'Электроника', '', 1),
              ('cp_fashion', 'fashion', 'Одежда и обувь', '', 1),
              ('cp_home', 'home', 'Товары для дома', '', 1),
              ('cp_sports', 'sports', 'Спорт и фитнес', '', 1),
              ('cp_beauty', 'beauty', 'Красота и здоровье', '', 1),
              ('cp_toys', 'toys', 'Игрушки и хобби', '', 1),
              ('cp_books', 'books', 'Книги и медиа', '', 1);`);
        }

        // ========== JOBS QUEUE ==========
        // Очередь задач для обработки
        await _client.execute(`CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          userId TEXT,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          payload TEXT NOT NULL,
          result TEXT,
          error TEXT,
          created_at INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        // Миграция: добавить userId если его нет (для обратной совместимости)
        await addColumnIfNotExists(_client, 'jobs', 'userId', 'TEXT');

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_status_type
          ON jobs(status, type, updated_at DESC);`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_created_at
          ON jobs(created_at DESC);`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_userId_status
          ON jobs(userId, status, created_at DESC);`);

        // ========== BATCHES TABLE ==========
        // Таблица для отслеживания batch операций
        await _client.execute(`CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          marketplace TEXT NOT NULL,
          style TEXT NOT NULL,
          totalItems INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          createdAt INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
          updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_batches_userId
          ON batches(userId, createdAt DESC);`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_batches_status
          ON batches(status, updatedAt DESC);`);

        // ========== LIMITS CONFIG TABLE ==========
        // Таблица для управления лимитами без редеплоя
        await _client.execute(`CREATE TABLE IF NOT EXISTS limits_config (
          key TEXT PRIMARY KEY,
          value INTEGER NOT NULL,
          description TEXT,
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
        );`);

        // Инициализация лимитов по умолчанию
        await _client.execute(
          `INSERT OR IGNORE INTO limits_config (key, value, description)
           VALUES
           ('batch_max_items_per_request', 200, 'Максимум товаров в одном batch'),
           ('batch_max_queued_per_user', 300, 'Максимум товаров в очереди на пользователя'),
           ('job_processing_timeout_seconds', 1800, 'Timeout для зависшего job (30 минут)'),
           ('single_daily_limit_free', 5, 'Дневной лимит для free тарифа'),
           ('single_daily_limit_basic', 20, 'Дневной лимит для basic тарифа'),
           ('single_daily_limit_professional', 100, 'Дневной лимит для professional тарифа'),
           ('single_daily_limit_enterprise', 1000, 'Дневной лимит для enterprise тарифа');`
        );

        // ========== USER_LIMITS TABLE ==========
        // Per-user лимиты (переопределение глобальных лимитов)
        await _client.execute(`CREATE TABLE IF NOT EXISTS user_limits (
          userId TEXT NOT NULL,
          key TEXT NOT NULL,
          value INTEGER NOT NULL,
          updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
          PRIMARY KEY (userId, key),
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );`);

        await _client.execute(`CREATE INDEX IF NOT EXISTS idx_user_limits_userId
          ON user_limits(userId);`);

        // Инициализация конфигов по умолчанию
        await _client.execute(
          `INSERT OR IGNORE INTO system_prompts (id, key, content, is_active)
           VALUES ('sp_gen_base', 'gen_base', '', 1), ('sp_validate_base', 'validate_base', '', 1);`
        );

        await _client.execute(
          `INSERT OR IGNORE INTO styles (id, key, title, prompt, is_active)
           VALUES
           ('st_selling', 'selling', 'Продающий', 'Создавай привлекательное, продающее описание. Акцент на выгоду для покупателя, эмоции, применение в жизни. Начни с главного преимущества. Используй активные глаголы. Структура: выгода → характеристики → кому подходит. Тон: дружелюбный, убедительный, без переувеличений. SEO-ключи используй естественно.', 1),
           ('st_expert', 'expert', 'Экспертный', 'Создавай описание как эксперт в данной категории. Акцент на технические характеристики, функциональность, качество материалов. Используй точные термины. Структура: основные функции → характеристики → применение. Тон: профессиональный, информативный, без эмоций. SEO-ключи используй органично в описании.', 1),
           ('st_brief', 'brief', 'Краткий', 'Создавай максимально краткое, но информативное описание. Только самое важное: что это, ключевые преимущества, кому подходит. Максимум 2-3 предложения. Убирай воду, лишние детали, подробности. Тон: прямой, по делу. SEO-ключи вставляй только если они органно вписываются.', 1);`
        );

        await _client.execute(
          `INSERT OR IGNORE INTO marketplace_rules (id, marketplace, content, is_active)
           VALUES
           ('mr_ozon', 'ozon', '', 1),
           ('mr_wb', 'wb', '', 1);`
        );

        // Инициализация стоп-слов
        await _client.execute(
          `INSERT OR IGNORE INTO stop_words (id, marketplace, category, words, is_active)
           VALUES
           ('sw_marketing', NULL, 'marketing', '', 1),
           ('sw_health', NULL, 'health', '', 1),
           ('sw_prohibited', NULL, 'prohibited', '', 1),
           ('sw_custom', NULL, 'custom', '', 1);`
        );

        console.log("✅ Tables initialized");
      } catch (error) {
        console.error("❌ DB init error:", error);
      }
    }
  }
  return _client;
}

/**
 * Выполняет SQL запрос с параметрами
 */
async function execute(sql: string, args?: any[]) {
  const client = await getClient();
  if (!client) {
    throw new Error("Database client not initialized");
  }
  return client.execute(sql, args);
}

/**
 * Возвращает инстанс клиента БД и методы для работы
 */
export const db = {
  getClient,
  execute,
};

export default db;
export { getClient, execute };
