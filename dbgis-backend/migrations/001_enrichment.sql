-- Миграция 001: добавление полей enrichment в таблицу companies
-- Запуск: psql -d dbgis -f migrations/001_enrichment.sql

-- Статус обогащения: pending | processing | done | failed
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending';

-- Дата и время последнего успешного обогащения
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP;

-- Индекс для быстрой выборки pending/failed компаний
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_status
    ON companies(enrichment_status);

-- Установить pending для всех компаний с доменом (уже существующие записи)
UPDATE companies
SET enrichment_status = 'pending'
WHERE domain IS NOT NULL AND domain != ''
  AND enrichment_status IS NULL;

COMMENT ON COLUMN companies.enrichment_status IS
    'Статус обогащения контактов: pending | processing | done | failed';
COMMENT ON COLUMN companies.enriched_at IS
    'Дата успешного обогащения через enrich.py';
