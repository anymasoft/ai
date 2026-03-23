-- Миграция: добавление колонки enrichment_error в таблицу companies
-- Для логирования ошибок обогащения
-- Дата: 2026-03-23

-- Добавляем колонку для логирования ошибок обогащения
ALTER TABLE companies
ADD COLUMN enrichment_error TEXT;

-- Комментарий для документации
COMMENT ON COLUMN companies.enrichment_error IS 'Сообщение об ошибке при обогащении контактов';
