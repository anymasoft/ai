#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция данных из SQLite (dgdat2xlsx/data/local.db) в PostgreSQL.

АВТОМАТИЧЕСКИ:
1. Создаёт базу PostgreSQL если не существует
2. Применяет schema.sql для инициализации таблиц
3. Мигрирует данные из SQLite

ВАЖНО: сохраняет оригинальные id из SQLite, чтобы не нарушить
связи между таблицами (branches → phones, categories → company_categories).
После миграции обновляет SERIAL sequences.
"""

import os
import sqlite3
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
from datetime import datetime
from pathlib import Path

# ============================================================
# КОНФИГУРАЦИЯ
# ============================================================

load_dotenv()

SQLITE_PATH = os.getenv("SQLITE_PATH", "../dgdat2xlsx/data/local.db")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

BATCH_SIZE = 1000
SCRIPT_DIR = Path(__file__).parent
SCHEMA_FILE = SCRIPT_DIR / "schema.sql"

# ============================================================
# ПОДКЛЮЧЕНИЯ
# ============================================================

def get_sqlite_connection(path):
    """Подключение к SQLite."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"SQLite база не найдена: {path}")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn

def get_postgres_connection(database=None):
    """Подключение к PostgreSQL.

    Если database=None, подключается к системной БД 'postgres'.
    Иначе подключается к указанной БД.
    """
    db = database or "postgres"
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=db,
        user=DB_USER,
        password=DB_PASSWORD
    )
    return conn

def create_database_if_not_exists():
    """Создаёт базу данных если не существует."""
    print(f"Проверка наличия базы {DB_NAME}...")

    try:
        # Подключаемся к системной БД postgres
        conn = get_postgres_connection(database="postgres")
        conn.autocommit = True
        cur = conn.cursor()

        # Проверяем существование БД
        cur.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (DB_NAME,)
        )

        if cur.fetchone():
            print(f"  ✓ База {DB_NAME} уже существует")
        else:
            print(f"  Создание базы {DB_NAME}...")
            cur.execute(sql.SQL("CREATE DATABASE {}").format(
                sql.Identifier(DB_NAME)
            ))
            print(f"  ✓ База {DB_NAME} создана")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Ошибка при создании БД: {e}")
        raise

def apply_schema():
    """Применяет schema.sql к базе."""
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"schema.sql не найден: {SCHEMA_FILE}")

    print(f"\nПрименение schema.sql...")

    try:
        with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        conn = get_postgres_connection(database=DB_NAME)
        conn.autocommit = False
        cur = conn.cursor()

        # Выполняем schema.sql целиком
        cur.execute(schema_sql)
        conn.commit()

        print("  ✓ Schema применена успешно")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Ошибка при применении schema: {e}")
        raise

def get_postgres_connection_for_migration():
    """Подключение к целевой БД для миграции."""
    return get_postgres_connection(database=DB_NAME)

# ============================================================
# УТИЛИТЫ
# ============================================================

def batch_insert(postgres_cur, query, rows, table_name):
    """Вставляет записи батчами, выводит прогресс."""
    batch = []
    count = 0

    for row in rows:
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(query, batch)
            count += len(batch)
            print(f"  {count} записей...")
            batch = []

    if batch:
        postgres_cur.executemany(query, batch)
        count += len(batch)

    print(f"  {count} записей всего")
    return count


def reset_serial_sequence(postgres_cur, table_name, column="id"):
    """Обновляет SERIAL sequence, чтобы следующий id был больше максимального."""
    postgres_cur.execute(f"""
        SELECT setval(
            pg_get_serial_sequence('{table_name}', '{column}'),
            COALESCE((SELECT MAX({column}) FROM {table_name}), 0) + 1,
            false
        )
    """)

# ============================================================
# ФУНКЦИИ МИГРАЦИИ
# ============================================================

def migrate_companies(sqlite_conn, postgres_cur):
    """Миграция companies. id сохраняется (PRIMARY KEY, не SERIAL)."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute(
        "SELECT id, name, city, website, domain, created_at, updated_at FROM companies"
    )

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((
            row['id'],
            row['name'],
            row['city'],
            row['website'],
            row['domain'],
            row['created_at'] or datetime.now().isoformat(),
            row['updated_at'] or datetime.now().isoformat()
        ))

    return batch_insert(
        postgres_cur,
        """INSERT INTO companies (id, name, city, website, domain, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT(id) DO NOTHING""",
        rows,
        "companies"
    )


def migrate_company_aliases(sqlite_conn, postgres_cur):
    """Миграция company_aliases. id сохраняется для консистентности."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, company_id, name FROM company_aliases")

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((row['id'], row['company_id'], row['name']))

    count = batch_insert(
        postgres_cur,
        """INSERT INTO company_aliases (id, company_id, name)
           VALUES (%s, %s, %s)
           ON CONFLICT(company_id, name) DO NOTHING""",
        rows,
        "company_aliases"
    )
    reset_serial_sequence(postgres_cur, "company_aliases")
    return count


def migrate_branches(sqlite_conn, postgres_cur):
    """Миграция branches. id СОХРАНЯЕТСЯ — на него ссылаются phones."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("""
        SELECT id, company_id, address, postal_code, working_hours,
               building_name, building_type, branch_hash FROM branches
    """)

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((
            row['id'],
            row['company_id'],
            row['address'],
            row['postal_code'],
            row['working_hours'],
            row['building_name'],
            row['building_type'],
            row['branch_hash']
        ))

    count = batch_insert(
        postgres_cur,
        """INSERT INTO branches (id, company_id, address, postal_code, working_hours,
                                building_name, building_type, branch_hash)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
           ON CONFLICT(branch_hash) DO NOTHING""",
        rows,
        "branches"
    )
    reset_serial_sequence(postgres_cur, "branches")
    return count


def migrate_phones(sqlite_conn, postgres_cur):
    """Миграция phones. branch_id ссылается на branches.id (сохранён)."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, branch_id, phone FROM phones")

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((row['id'], row['branch_id'], row['phone'], '2gis'))

    count = batch_insert(
        postgres_cur,
        """INSERT INTO phones (id, branch_id, phone, source)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT(branch_id, phone) DO NOTHING""",
        rows,
        "phones"
    )
    reset_serial_sequence(postgres_cur, "phones")
    return count


def migrate_emails(sqlite_conn, postgres_cur):
    """Миграция emails."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, company_id, email FROM emails")

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((row['id'], row['company_id'], row['email'].lower(), '2gis'))

    count = batch_insert(
        postgres_cur,
        """INSERT INTO emails (id, company_id, email, source)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT(company_id, email) DO NOTHING""",
        rows,
        "emails"
    )
    reset_serial_sequence(postgres_cur, "emails")
    return count


def migrate_socials(sqlite_conn, postgres_cur):
    """Миграция socials (VK, Facebook, Twitter, Telegram и др.)."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, company_id, type, url FROM socials")

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((row['id'], row['company_id'], row['type'], row['url']))

    count = batch_insert(
        postgres_cur,
        """INSERT INTO socials (id, company_id, type, url)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT(company_id, type, url) DO NOTHING""",
        rows,
        "socials"
    )
    reset_serial_sequence(postgres_cur, "socials")
    return count


def migrate_categories(sqlite_conn, postgres_cur):
    """Миграция categories. id СОХРАНЯЕТСЯ — на него ссылаются
    parent_id и company_categories.category_id.

    Порядок вставки: сначала корневые (parent_id IS NULL),
    затем дочерние (ORDER BY id гарантирует правильную очерёдность).
    """
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, name, parent_id FROM categories ORDER BY id")

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((row['id'], row['name'], row['parent_id']))

    count = batch_insert(
        postgres_cur,
        """INSERT INTO categories (id, name, parent_id)
           VALUES (%s, %s, %s)
           ON CONFLICT(name, parent_id) DO NOTHING""",
        rows,
        "categories"
    )
    reset_serial_sequence(postgres_cur, "categories")
    return count


def migrate_company_categories(sqlite_conn, postgres_cur):
    """Миграция company_categories. category_id ссылается на categories.id (сохранён)."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT company_id, category_id FROM company_categories")

    rows = []
    for row in sqlite_cur.fetchall():
        rows.append((row['company_id'], row['category_id']))

    return batch_insert(
        postgres_cur,
        """INSERT INTO company_categories (company_id, category_id)
           VALUES (%s, %s)
           ON CONFLICT(company_id, category_id) DO NOTHING""",
        rows,
        "company_categories"
    )


# ============================================================
# ОРКЕСТРАЦИЯ
# ============================================================

# Порядок миграции: сначала таблицы без зависимостей, потом зависимые
MIGRATION_STEPS = [
    ("companies",          migrate_companies),
    ("company_aliases",    migrate_company_aliases),
    ("branches",           migrate_branches),
    ("phones",             migrate_phones),
    ("emails",             migrate_emails),
    ("socials",            migrate_socials),
    ("categories",         migrate_categories),
    ("company_categories", migrate_company_categories),
]

# Таблицы с триггерами, которые нужно отключить на время миграции
TABLES_WITH_TRIGGERS = [
    "company_categories", "branches", "phones",
    "emails", "socials", "company_aliases", "categories",
]


def migrate_data():
    """Выполняет полную миграцию данных.

    ВАЖНО: при повторном запуске полностью очищает PostgreSQL
    и заливает данные заново из SQLite (TRUNCATE CASCADE).
    """

    # Создаём БД если не существует
    create_database_if_not_exists()

    # Применяем schema
    apply_schema()

    print(f"\nПодключение к SQLite: {SQLITE_PATH}")
    sqlite_conn = get_sqlite_connection(SQLITE_PATH)

    print(f"Подключение к PostgreSQL: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    postgres_conn = get_postgres_connection_for_migration()
    postgres_cur = postgres_conn.cursor()

    try:
        # Отключаем триггеры (FK constraints) для скорости
        for table in TABLES_WITH_TRIGGERS:
            postgres_cur.execute(f"ALTER TABLE {table} DISABLE TRIGGER ALL")

        # Очищаем все таблицы перед миграцией (идемпотентность)
        print("\nОчистка таблиц PostgreSQL...")
        truncate_order = [
            "company_categories", "phones", "emails", "socials",
            "company_aliases", "branches", "categories", "companies"
        ]
        for table in truncate_order:
            postgres_cur.execute(f"TRUNCATE TABLE {table} CASCADE")
            print(f"  {table} — очищена")

        # Статистика
        total = 0
        for table_name, migrate_fn in MIGRATION_STEPS:
            print(f"\n[{table_name}]")
            count = migrate_fn(sqlite_conn, postgres_cur)
            total += count

        # Восстанавливаем триггеры
        print("\nВосстановление триггеров...")
        for table in TABLES_WITH_TRIGGERS:
            postgres_cur.execute(f"ALTER TABLE {table} ENABLE TRIGGER ALL")

        postgres_conn.commit()

        print(f"\nМиграция завершена. Всего записей: {total}")

    except Exception as e:
        postgres_conn.rollback()
        print(f"\nОшибка при миграции: {e}")
        raise
    finally:
        postgres_cur.close()
        postgres_conn.close()
        sqlite_conn.close()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    try:
        migrate_data()
    except Exception as e:
        print(f"\nОшибка: {e}")
        exit(1)
