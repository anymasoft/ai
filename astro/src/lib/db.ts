import Database from 'better-sqlite3';

let db: Database.Database | null = null;

function initDb() {
  if (db) return db;

  const dbPath = process.env.DATABASE_URL || 'vr_ai.db';
  db = new Database(dbPath);

  // Включаем foreign keys
  db.pragma('foreign_keys = ON');

  // ========== USERS TABLE ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      image TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      role TEXT NOT NULL DEFAULT 'user',
      disabled INTEGER NOT NULL DEFAULT 0,
      generation_balance INTEGER NOT NULL DEFAULT 0,
      generation_used INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Миграция: добавляем generation_balance если колонки нет
  try {
    const tableInfo = db.pragma('table_info(users)');
    const hasGenerationBalance = tableInfo.some((col: any) => col.name === 'generation_balance');
    if (!hasGenerationBalance) {
      db.exec('ALTER TABLE users ADD COLUMN generation_balance INTEGER NOT NULL DEFAULT 0');
      console.log('✅ Migration: Added generation_balance column to users table');
    }

    const hasGenerationUsed = tableInfo.some((col: any) => col.name === 'generation_used');
    if (!hasGenerationUsed) {
      db.exec('ALTER TABLE users ADD COLUMN generation_used INTEGER NOT NULL DEFAULT 0');
      console.log('✅ Migration: Added generation_used column to users table');
    }
  } catch (e) {
    console.log('ℹ️ Migration check passed');
  }

  // Миграция: добавляем credits в payments если колонки нет
  try {
    const paymentsInfo = db.pragma('table_info(payments)');
    const hasCredits = paymentsInfo.some((col: any) => col.name === 'credits');
    if (!hasCredits) {
      db.exec('ALTER TABLE payments ADD COLUMN credits INTEGER DEFAULT 0');
      console.log('✅ Migration: Added credits column to payments table');
    }
  } catch (e) {
    console.log('ℹ️ Migration check for payments passed');
  }


  // ========== SESSIONS TABLE ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);


  // ========== PAYMENTS TABLE ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      externalPaymentId TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      credits INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'RUB',
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT DEFAULT 'yookassa',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ========== ADMIN_SUBSCRIPTIONS TABLE (optional, for manual overrides) ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_subscriptions (
      userId TEXT PRIMARY KEY,
      plan TEXT DEFAULT 'free',
      isPaid INTEGER DEFAULT 0,
      expiresAt INTEGER,
      provider TEXT DEFAULT 'manual',
      updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ========== GENERATIONS TABLE (для отслеживания видео генераций и списания) ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      duration INTEGER NOT NULL,
      cost INTEGER NOT NULL,
      charged INTEGER NOT NULL DEFAULT 0,
      minimax_job_id TEXT,
      video_url TEXT,
      minimax_status TEXT DEFAULT 'pending',
      createdAt INTEGER NOT NULL,
      completedAt INTEGER,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Миграция: добавляем MiniMax поля если их нет
  try {
    const genInfo = db.pragma('table_info(generations)');
    const hasMinimaxJobId = genInfo.some((col: any) => col.name === 'minimax_job_id');
    if (!hasMinimaxJobId) {
      db.exec('ALTER TABLE generations ADD COLUMN minimax_job_id TEXT');
      console.log('✅ Migration: Added minimax_job_id column to generations table');
    }

    const hasVideoUrl = genInfo.some((col: any) => col.name === 'video_url');
    if (!hasVideoUrl) {
      db.exec('ALTER TABLE generations ADD COLUMN video_url TEXT');
      console.log('✅ Migration: Added video_url column to generations table');
    }

    const hasMinimaxStatus = genInfo.some((col: any) => col.name === 'minimax_status');
    if (!hasMinimaxStatus) {
      db.exec('ALTER TABLE generations ADD COLUMN minimax_status TEXT DEFAULT \'pending\'');
      console.log('✅ Migration: Added minimax_status column to generations table');
    }
  } catch (e) {
    console.log('ℹ️ Migration check for generations passed');
  }

  // ========== CREATE INDEXES ==========
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_payments_externalPaymentId ON payments(externalPaymentId);
    CREATE INDEX IF NOT EXISTS idx_payments_userId_createdAt ON payments(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_generations_userId ON generations(userId);
    CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
  `);

  console.log('✅ Database initialized with billing tables');
  return db;
}

export function getDb() {
  if (!db) {
    initDb();
  }
  return db!;
}

export default getDb;
