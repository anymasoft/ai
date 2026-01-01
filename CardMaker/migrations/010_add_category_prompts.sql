-- Category Prompts
-- Таблица для хранения мини-промптов для каждой категории товаров

CREATE TABLE IF NOT EXISTS category_prompts (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  is_active INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (cast(strftime('%s','now') as integer))
);

-- Индекс для быстрого поиска активных промптов по ключу
CREATE INDEX IF NOT EXISTS idx_category_prompts_key_active ON category_prompts(key, is_active);

-- ========== SEED DATA ==========
-- Инициализация категорий с пустыми промптами (заполняются через админку)

INSERT OR IGNORE INTO category_prompts (id, key, title, prompt, is_active)
VALUES
  ('cp_electronics', 'electronics', 'Электроника', '', 1),
  ('cp_fashion', 'fashion', 'Одежда и обувь', '', 1),
  ('cp_home', 'home', 'Товары для дома', '', 1),
  ('cp_sports', 'sports', 'Спорт и фитнес', '', 1),
  ('cp_beauty', 'beauty', 'Красота и здоровье', '', 1),
  ('cp_toys', 'toys', 'Игрушки и хобби', '', 1),
  ('cp_books', 'books', 'Книги и медиа', '', 1);
