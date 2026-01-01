-- Configuration Tables & Job Queue
-- Миграция для хранения конфигов и очереди задач

-- ========== SYSTEM PROMPTS ==========
-- Хранилище системных промптов для генерации и валидации
CREATE TABLE IF NOT EXISTS system_prompts (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  is_active INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

-- Индекс для быстрого поиска активных промптов
CREATE INDEX IF NOT EXISTS idx_system_prompts_key_active ON system_prompts(key, is_active);

-- ========== STYLES ==========
-- Стили описаний товаров (шаблоны для разных подходов)
CREATE TABLE IF NOT EXISTS styles (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  is_active INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

CREATE INDEX IF NOT EXISTS idx_styles_key_active ON styles(key, is_active);

-- ========== MARKETPLACE RULES ==========
-- Правила и требования каждого маркетплейса
CREATE TABLE IF NOT EXISTS marketplace_rules (
  id TEXT PRIMARY KEY,
  marketplace TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_active INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
  UNIQUE(marketplace, is_active) -- Только одна активная запись на маркетплейс
);

CREATE INDEX IF NOT EXISTS idx_marketplace_rules_marketplace ON marketplace_rules(marketplace, is_active);

-- ========== STOP WORDS ==========
-- Запрещённые слова для разных маркетплейсов и категорий
CREATE TABLE IF NOT EXISTS stop_words (
  id TEXT PRIMARY KEY,
  marketplace TEXT, -- NULL = общие для всех маркетплейсов
  category TEXT NOT NULL,
  words TEXT NOT NULL, -- Список слов (перенос строки или запятая)
  is_active INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

CREATE INDEX IF NOT EXISTS idx_stop_words_marketplace_category ON stop_words(marketplace, category, is_active);

-- ========== JOBS QUEUE ==========
-- Очередь задач для batch обработки
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'generate', 'validate', 'batch'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'done', 'failed'
  payload JSON NOT NULL, -- Входные данные задачи
  result JSON, -- Результат (для успешных или частично успешных)
  error TEXT, -- Описание ошибки (если есть)
  created_at INTEGER DEFAULT (cast(strftime('%s','now') as integer)),
  updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- ========== SEED DATA ==========
-- Инициализация конфигов по умолчанию

-- System Prompts
INSERT OR IGNORE INTO system_prompts (id, key, content, is_active)
VALUES
  ('sp_gen_base', 'gen_base', '', 1),
  ('sp_validate_base', 'validate_base', '', 1);

-- Styles (3 стиля)
INSERT OR IGNORE INTO styles (id, key, title, prompt, is_active)
VALUES
  ('st_selling', 'selling', 'Продающий', '', 1),
  ('st_expert', 'expert', 'Экспертный', '', 1),
  ('st_brief', 'brief', 'Краткий', '', 1);

-- Marketplace Rules (Ozon и Wildberries)
INSERT OR IGNORE INTO marketplace_rules (id, marketplace, content, is_active)
VALUES
  ('mr_ozon', 'ozon', '', 1),
  ('mr_wb', 'wildberries', '', 1);

-- Stop Words (пусто по умолчанию - будут добавлены через админку)
-- INSERT OR IGNORE INTO stop_words (id, marketplace, category, words, is_active)
-- VALUES ('sw_marketing_ozon', 'ozon', 'marketing', 'уникальный\nлучший\n...', 1);
