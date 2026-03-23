-- Примеры SQL запросов для dbgis
-- Используйте эти запросы в psql или DBeaver

-- ============================================================
-- СТАТИСТИКА
-- ============================================================

-- Общее количество компаний
SELECT COUNT(*) as total_companies FROM companies;

-- Количество компаний по городам
SELECT city, COUNT(*) as count
FROM companies
WHERE city IS NOT NULL AND city != ''
GROUP BY city
ORDER BY count DESC
LIMIT 20;

-- Количество компаний с email
SELECT COUNT(*) as companies_with_email
FROM companies
WHERE EXISTS (SELECT 1 FROM emails WHERE company_id = companies.id);

-- Количество компаний с телефоном
SELECT COUNT(*) as companies_with_phone
FROM companies
WHERE EXISTS (SELECT 1 FROM phones p JOIN branches b ON p.branch_id = b.id WHERE b.company_id = companies.id);

-- Количество компаний с сайтом
SELECT COUNT(*) as companies_with_website
FROM companies
WHERE domain IS NOT NULL AND domain != '';

-- Топ категорий
SELECT cat.name, COUNT(DISTINCT cc.company_id) as count
FROM categories cat
LEFT JOIN company_categories cc ON cat.id = cc.category_id
WHERE cat.parent_id IS NOT NULL  -- только листья, не корни
GROUP BY cat.name
ORDER BY count DESC
LIMIT 20;

-- ============================================================
-- ПОИСК И ФИЛЬТРАЦИЯ
-- ============================================================

-- Все компании в Москве
SELECT * FROM companies
WHERE city ILIKE '%Москва%'
LIMIT 10;

-- Компании по названию
SELECT * FROM companies
WHERE name ILIKE '%Кафе%'
LIMIT 10;

-- Компании с email и сайтом
SELECT c.*,
  COUNT(DISTINCT e.id) as email_count,
  COUNT(DISTINCT p.id) as phone_count
FROM companies c
LEFT JOIN emails e ON c.id = e.company_id
LEFT JOIN branches b ON c.id = b.company_id
LEFT JOIN phones p ON b.id = p.branch_id
WHERE c.domain IS NOT NULL AND c.domain != ''
  AND EXISTS (SELECT 1 FROM emails WHERE company_id = c.id)
GROUP BY c.id
LIMIT 20;

-- Компании с определённой категорией
SELECT DISTINCT c.id, c.name, c.city
FROM companies c
JOIN company_categories cc ON c.id = cc.company_id
JOIN categories cat ON cc.category_id = cat.id
WHERE cat.name ILIKE '%Кафе%'
LIMIT 10;

-- Полная информация о компании (ID=123)
SELECT
  c.id, c.name, c.city, c.website, c.domain,
  STRING_AGG(DISTINCT e.email, ', ') as emails,
  STRING_AGG(DISTINCT p.phone, ', ') as phones
FROM companies c
LEFT JOIN emails e ON c.id = e.company_id
LEFT JOIN branches b ON c.id = b.company_id
LEFT JOIN phones p ON b.id = p.branch_id
WHERE c.id = 123
GROUP BY c.id, c.name, c.city, c.website, c.domain;

-- ============================================================
-- ФИЛИАЛЫ И АДРЕСА
-- ============================================================

-- Все филиалы компании (ID=123)
SELECT * FROM branches
WHERE company_id = 123
ORDER BY address;

-- Филиалы с телефонами
SELECT b.id, b.company_id, b.address, b.postal_code,
  STRING_AGG(p.phone, ', ') as phones
FROM branches b
LEFT JOIN phones p ON b.id = p.branch_id
WHERE b.company_id = 123
GROUP BY b.id, b.company_id, b.address, b.postal_code
ORDER BY b.address;

-- Все адреса в городе
SELECT DISTINCT b.address, c.name, c.city
FROM branches b
JOIN companies c ON b.company_id = c.id
WHERE c.city ILIKE '%Москва%'
  AND b.address IS NOT NULL
ORDER BY b.address
LIMIT 20;

-- ============================================================
-- EMAIL И КОНТАКТЫ
-- ============================================================

-- Все email адреса компании
SELECT e.id, e.email
FROM emails e
WHERE e.company_id = 123
ORDER BY e.email;

-- Компании без email (для спама? 😄)
SELECT c.id, c.name, c.city
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM emails WHERE company_id = c.id)
LIMIT 20;

-- Уникальные email домены
SELECT SUBSTRING(email FROM POSITION('@' IN email) + 1) as domain,
  COUNT(*) as count
FROM emails
GROUP BY domain
ORDER BY count DESC
LIMIT 20;

-- ============================================================
-- СОЦИАЛЬНЫЕ СЕТИ
-- ============================================================

-- Компании с VK
SELECT DISTINCT c.id, c.name
FROM companies c
JOIN socials s ON c.id = s.company_id
WHERE s.type = 'v'
LIMIT 20;

-- Все соцсети компании (ID=123)
SELECT type, url FROM socials
WHERE company_id = 123
ORDER BY type;

-- Распределение по социальным сетям
SELECT type, COUNT(*) as count
FROM socials
GROUP BY type
ORDER BY count DESC;

-- ============================================================
-- КАТЕГОРИИ И РУБРИКИ
-- ============================================================

-- Иерархия категорий (рубрики + подрубрики)
WITH RECURSIVE cat_tree AS (
  SELECT id, name, parent_id, name as path, 0 as level
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  SELECT c.id, c.name, c.parent_id,
    CONCAT(ct.path, ' → ', c.name), ct.level + 1
  FROM categories c
  JOIN cat_tree ct ON c.parent_id = ct.id
)
SELECT * FROM cat_tree
ORDER BY path;

-- Компании по рубрике (с иерархией)
SELECT DISTINCT c.id, c.name, c.city
FROM companies c
JOIN company_categories cc ON c.id = cc.company_id
JOIN categories cat ON cc.category_id = cat.id
WHERE cat.id = 456
LIMIT 20;

-- Сколько компаний в каждой категории
SELECT c.name, COUNT(DISTINCT cc.company_id) as company_count
FROM categories c
LEFT JOIN company_categories cc ON c.id = cc.category_id
GROUP BY c.id, c.name
ORDER BY company_count DESC
LIMIT 30;

-- ============================================================
-- ОБНОВЛЕНИЕ И ОЧИСТКА
-- ============================================================

-- Обновить город для компании
UPDATE companies
SET city = 'Новосибирск', updated_at = CURRENT_TIMESTAMP
WHERE id = 123;

-- Удалить все email адреса компании
DELETE FROM emails
WHERE company_id = 123;

-- Удалить все филиалы компании (каскадно удалит телефоны)
DELETE FROM branches
WHERE company_id = 123;

-- Удалить компанию полностью (каскадно удалит всё связанное)
DELETE FROM companies
WHERE id = 123;

-- Очистить категории без компаний
DELETE FROM categories
WHERE id NOT IN (SELECT DISTINCT category_id FROM company_categories);

-- ============================================================
-- ЭКСПОРТ
-- ============================================================

-- Список для CSV экспорта
SELECT
  c.id,
  c.name,
  c.city,
  c.domain,
  c.website,
  COALESCE((SELECT phone FROM phones p
    JOIN branches b ON p.branch_id = b.id
    WHERE b.company_id = c.id LIMIT 1), '') as phone,
  COALESCE((SELECT email FROM emails WHERE company_id = c.id LIMIT 1), '') as email,
  STRING_AGG(DISTINCT cat.name, ', ') as categories
FROM companies c
LEFT JOIN company_categories cc ON c.id = cc.company_id
LEFT JOIN categories cat ON cc.category_id = cat.id
WHERE c.city ILIKE '%Москва%'
GROUP BY c.id, c.name, c.city, c.domain, c.website
ORDER BY c.name
LIMIT 5000;

-- ============================================================
-- ПРОИЗВОДИТЕЛЬНОСТЬ
-- ============================================================

-- Размер таблиц
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Статистика индексов
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Вакуум и анализ (оптимизация БД)
VACUUM ANALYZE;

-- ============================================================
-- ПРОВЕРКА ЦЕЛОСТНОСТИ
-- ============================================================

-- Компании без имени (некорректные данные)
SELECT id, city FROM companies
WHERE name IS NULL OR name = '';

-- Дубликаты email
SELECT email, COUNT(*) as count
FROM emails
GROUP BY email
HAVING COUNT(*) > 1;

-- Филиалы без адреса
SELECT id, company_id
FROM branches
WHERE address IS NULL OR address = '';

-- Цикличные категории (если они есть)
WITH RECURSIVE cycle_check AS (
  SELECT id, parent_id, id::text as chain
  FROM categories
  WHERE parent_id IS NOT NULL

  UNION ALL

  SELECT c.id, c.parent_id, chain || ' → ' || c.id::text
  FROM categories c
  JOIN cycle_check ON c.parent_id = cycle_check.id
  WHERE chain NOT LIKE '%' || c.id::text || '%'
    AND LENGTH(chain) < 100
)
SELECT DISTINCT chain FROM cycle_check WHERE chain LIKE '%→%→%→%'
LIMIT 10;
