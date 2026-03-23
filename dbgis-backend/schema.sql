-- PostgreSQL schema для dbgis
-- Миграция из SQLite (import_db.py)

-- Удаление старых таблиц (при переустановке)
DROP TABLE IF EXISTS company_categories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS socials CASCADE;
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS phones CASCADE;
DROP TABLE IF EXISTS company_aliases CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- ============================================================
-- ОСНОВНЫЕ ТАБЛИЦЫ
-- ============================================================

CREATE TABLE companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    website TEXT,
    domain TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_aliases (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(company_id, name)
);

CREATE TABLE branches (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    address TEXT,
    postal_code TEXT,
    working_hours TEXT,
    building_name TEXT,
    building_type TEXT,
    branch_hash TEXT UNIQUE
);

CREATE TABLE phones (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    UNIQUE(branch_id, phone)
);

CREATE TABLE emails (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    UNIQUE(company_id, email)
);

CREATE TABLE socials (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    UNIQUE(company_id, type, url)
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(name, parent_id)
);

CREATE TABLE company_categories (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY(company_id, category_id)
);

-- ============================================================
-- ИНДЕКСЫ (ускорение поиска)
-- ============================================================

CREATE INDEX idx_companies_city ON companies(city);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_branches_company_id ON branches(company_id);
CREATE INDEX idx_phones_branch_id ON phones(branch_id);
CREATE INDEX idx_emails_company_id ON emails(company_id);
CREATE INDEX idx_socials_company_id ON socials(company_id);
CREATE INDEX idx_company_categories_company_id ON company_categories(company_id);
CREATE INDEX idx_company_categories_category_id ON company_categories(category_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- ============================================================
-- КОММЕНТАРИИ
-- ============================================================

COMMENT ON TABLE companies IS 'Организации из 2ГИС';
COMMENT ON TABLE branches IS 'Филиалы/подразделения организаций';
COMMENT ON TABLE phones IS 'Телефоны филиалов';
COMMENT ON TABLE emails IS 'Email адреса организаций';
COMMENT ON TABLE socials IS 'Социальные сети (VK, Facebook, Twitter, etc)';
COMMENT ON TABLE categories IS 'Иерархия рубрик (Раздел → Подраздел → Рубрика)';
COMMENT ON TABLE company_categories IS 'Связь между компаниями и категориями';
