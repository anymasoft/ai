-- Миграция 003: Схема авторизации (Yandex OAuth + API keys)
--
-- ИЗОЛЯЦИЯ: все таблицы в схеме `auth`, отдельно от `public`.
-- clean_postgres.py и sync_sqlite_to_postgres.py работают ТОЛЬКО с public —
-- данные пользователей НЕ затрагиваются при очистке/синхронизации бизнес-данных.
--
-- Запуск:
--   python migrations/run_migration.py 003_auth_schema.sql

-- 1. Создаём отдельную схему
CREATE SCHEMA IF NOT EXISTS auth;

-- 2. Расширение для UUID (если ещё нет)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Таблица пользователей
CREATE TABLE IF NOT EXISTS auth.users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) NOT NULL UNIQUE,   -- yandex_id
    email       VARCHAR(255),                    -- email из Yandex (может быть NULL)
    plan        VARCHAR(50)  NOT NULL DEFAULT 'free',
    credits     INTEGER      NOT NULL DEFAULT 100,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 4. Таблица API-ключей
CREATE TABLE IF NOT EXISTS auth.api_keys (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_hash   VARCHAR(64)  NOT NULL UNIQUE,    -- SHA-256 hex digest (64 символа)
    name       VARCHAR(255) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- 5. Индексы
CREATE INDEX IF NOT EXISTS idx_auth_api_keys_hash
    ON auth.api_keys (key_hash) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_auth_api_keys_user_id
    ON auth.api_keys (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_users_external_id
    ON auth.users (external_id);

-- 6. Комментарии
COMMENT ON SCHEMA auth IS 'Схема авторизации — изолирована от бизнес-данных (public). НЕ затрагивается clean_postgres.py / sync_sqlite_to_postgres.py';
COMMENT ON TABLE auth.users IS 'Пользователи (Yandex OAuth). external_id = yandex user id';
COMMENT ON TABLE auth.api_keys IS 'API-ключи. Хранится только SHA-256 хэш, raw key возвращается один раз при создании';
