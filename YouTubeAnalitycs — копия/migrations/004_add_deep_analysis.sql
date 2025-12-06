-- Миграция для ЭТАП 4.7: Deep Audience Intelligence
-- Добавляет таблицу channel_ai_comment_insights и поле language в users

-- 1. Добавить поле language в таблицу users (если не существует)
-- SQLite не поддерживает ALTER COLUMN, поэтому проверяем через pragma
ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en';

-- 2. Создать таблицу channel_ai_comment_insights
CREATE TABLE IF NOT EXISTS channel_ai_comment_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channelId TEXT NOT NULL,
  resultJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

-- 3. Создать индекс для быстрого поиска по channelId
CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_channelId
ON channel_ai_comment_insights(channelId);

-- 4. Создать индекс для сортировки по дате
CREATE INDEX IF NOT EXISTS idx_channel_ai_insights_createdAt
ON channel_ai_comment_insights(createdAt DESC);
