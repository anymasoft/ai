-- Admin Panel Tables
-- Миграция для создания таблиц администраторской панели

-- 1. Переопределения подписок (для ручного управления платежами)
CREATE TABLE IF NOT EXISTS admin_subscriptions (
  userId TEXT PRIMARY KEY,
  plan TEXT DEFAULT 'free', -- 'free', 'basic', 'professional', 'enterprise'
  isPaid INTEGER DEFAULT 0, -- 0 = false, 1 = true
  expiresAt INTEGER,        -- timestamp, NULL = никогда не истекает
  provider TEXT DEFAULT 'manual', -- 'manual', 'yookassa', 'stripe', etc.
  updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

-- 2. Пользовательские лимиты
CREATE TABLE IF NOT EXISTS user_limits (
  userId TEXT PRIMARY KEY,
  analysesPerDay INTEGER DEFAULT 10,
  scriptsPerDay INTEGER DEFAULT 5,
  cooldownHours INTEGER DEFAULT 0, -- часов между операциями (0 = нет cooldown)
  updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

-- 3. Суточное использование лимитов
CREATE TABLE IF NOT EXISTS user_usage_daily (
  userId TEXT NOT NULL,
  day TEXT NOT NULL, -- формат YYYY-MM-DD
  analysesUsed INTEGER DEFAULT 0,
  scriptsUsed INTEGER DEFAULT 0,
  updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
  PRIMARY KEY (userId, day)
);

-- 4. Системные флаги
CREATE TABLE IF NOT EXISTS system_flags (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT 'false', -- 'true'/'false' или JSON
  updatedAt INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

-- Инициализация флагов по умолчанию
INSERT OR IGNORE INTO system_flags (key, value) VALUES ('enableTrending', 'true');
INSERT OR IGNORE INTO system_flags (key, value) VALUES ('enableComparison', 'true');
INSERT OR IGNORE INTO system_flags (key, value) VALUES ('enableReports', 'false'); -- Уже отключено
INSERT OR IGNORE INTO system_flags (key, value) VALUES ('enableCooldown', 'false');
INSERT OR IGNORE INTO system_flags (key, value) VALUES ('maintenanceMode', 'false');
