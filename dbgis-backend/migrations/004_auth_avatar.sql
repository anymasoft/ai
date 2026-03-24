-- Миграция 004: Добавление avatar_url в auth.users
--
-- Хранит URL аватара из Yandex (https://avatars.yandex.net/get-yapic/{id}/islands-200)
-- Обновляется при каждом входе через OAuth.
--
-- Запуск:
--   python migrations/run_migration.py 004_auth_avatar.sql

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
