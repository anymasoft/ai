-- Миграция: добавление колонки source в таблицы emails и phones
-- Разделение источников данных (2GIS vs enrichment)
-- Дата: 2026-03-23

-- Для emails: добавляем source с дефолтом '2gis'
ALTER TABLE emails
ADD COLUMN source TEXT DEFAULT '2gis';

-- Для phones: добавляем source с дефолтом '2gis'
ALTER TABLE phones
ADD COLUMN source TEXT DEFAULT '2gis';

-- Комментарии для документации
COMMENT ON COLUMN emails.source IS 'Источник email: 2gis или enrichment';
COMMENT ON COLUMN phones.source IS 'Источник телефона: 2gis или enrichment';
