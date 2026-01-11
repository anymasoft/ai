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

  // ========== PACKAGES TABLE ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      price_rub INTEGER NOT NULL,
      generations INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
      updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
    )
  `);

  // Инициализация пакетов по умолчанию
  const stmt = db.prepare('SELECT COUNT(*) as count FROM packages');
  const result = stmt.get() as any;
  if (result.count === 0) {
    db.exec(`
      INSERT INTO packages (key, title, price_rub, generations, is_active)
      VALUES
        ('basic', 'Basic', 990, 50, 1),
        ('pro', 'Professional', 2490, 250, 1),
        ('enterprise', 'Enterprise', 5990, 1000, 1)
    `);
    console.log('✅ Packages initialized');
  }

  // ========== PAYMENTS TABLE ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      packageKey TEXT NOT NULL,
      externalPaymentId TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'RUB',
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT DEFAULT 'yookassa',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (packageKey) REFERENCES packages(key)
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

  // ========== CREATE INDEXES ==========
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_payments_externalPaymentId ON payments(externalPaymentId);
    CREATE INDEX IF NOT EXISTS idx_payments_userId_createdAt ON payments(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
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
