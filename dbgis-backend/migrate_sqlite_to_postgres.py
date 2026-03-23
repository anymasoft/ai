#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция данных из SQLite (dgdat2xlsx/data/local.db) в PostgreSQL.
Batch insert для оптимальной скорости.
"""

import os
import sqlite3
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

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

BATCH_SIZE = 1000  # размер батча для инсертов

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

def get_postgres_connection():
    """Подключение к PostgreSQL."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    except psycopg2.OperationalError as e:
        raise Exception(f"Ошибка подключения к PostgreSQL: {e}")

# ============================================================
# МИГРАЦИЯ
# ============================================================

def migrate_data():
    """Выполняет полную миграцию данных."""

    print(f"🔍 Подключение к SQLite: {SQLITE_PATH}")
    sqlite_conn = get_sqlite_connection(SQLITE_PATH)

    print(f"🔍 Подключение к PostgreSQL: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    postgres_conn = get_postgres_connection()
    postgres_cur = postgres_conn.cursor()

    try:
        # Отключаем внешние ключи для скорости
        postgres_cur.execute("ALTER TABLE company_categories DISABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE branches DISABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE phones DISABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE emails DISABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE socials DISABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE company_aliases DISABLE TRIGGER ALL")

        # 1. Миграция companies
        print("\n📦 Миграция companies...")
        migrate_companies(sqlite_conn, postgres_cur)

        # 2. Миграция company_aliases
        print("📦 Миграция company_aliases...")
        migrate_company_aliases(sqlite_conn, postgres_cur)

        # 3. Миграция branches
        print("📦 Миграция branches...")
        migrate_branches(sqlite_conn, postgres_cur)

        # 4. Миграция phones
        print("📦 Миграция phones...")
        migrate_phones(sqlite_conn, postgres_cur)

        # 5. Миграция emails
        print("📦 Миграция emails...")
        migrate_emails(sqlite_conn, postgres_cur)

        # 6. Миграция socials
        print("📦 Миграция socials...")
        migrate_socials(sqlite_conn, postgres_cur)

        # 7. Миграция categories
        print("📦 Миграция categories...")
        migrate_categories(sqlite_conn, postgres_cur)

        # 8. Миграция company_categories
        print("📦 Миграция company_categories...")
        migrate_company_categories(sqlite_conn, postgres_cur)

        # Включаем внешние ключи обратно
        print("\n✅ Восстановление триггеров...")
        postgres_cur.execute("ALTER TABLE company_categories ENABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE branches ENABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE phones ENABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE emails ENABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE socials ENABLE TRIGGER ALL")
        postgres_cur.execute("ALTER TABLE company_aliases ENABLE TRIGGER ALL")

        postgres_conn.commit()
        print("✅ Миграция успешно завершена!")

    except Exception as e:
        postgres_conn.rollback()
        print(f"❌ Ошибка при миграции: {e}")
        raise
    finally:
        postgres_cur.close()
        postgres_conn.close()
        sqlite_conn.close()

# ============================================================
# ФУНКЦИИ МИГРАЦИИ
# ============================================================

def migrate_companies(sqlite_conn, postgres_cur):
    """Миграция таблицы companies."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, name, city, website, domain, created_at, updated_at FROM companies")

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((
            row['id'],
            row['name'],
            row['city'],
            row['website'],
            row['domain'],
            row['created_at'] or datetime.now().isoformat(),
            row['updated_at'] or datetime.now().isoformat()
        ))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO companies (id, name, city, website, domain, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT(id) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO companies (id, name, city, website, domain, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT(id) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

def migrate_company_aliases(sqlite_conn, postgres_cur):
    """Миграция таблицы company_aliases."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, company_id, name FROM company_aliases")

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((row['company_id'], row['name']))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO company_aliases (company_id, name)
                   VALUES (%s, %s)
                   ON CONFLICT(company_id, name) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO company_aliases (company_id, name)
               VALUES (%s, %s)
               ON CONFLICT(company_id, name) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

def migrate_branches(sqlite_conn, postgres_cur):
    """Миграция таблицы branches."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("""
        SELECT id, company_id, address, postal_code, working_hours,
               building_name, building_type, branch_hash FROM branches
    """)

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((
            row['company_id'],
            row['address'],
            row['postal_code'],
            row['working_hours'],
            row['building_name'],
            row['building_type'],
            row['branch_hash']
        ))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO branches (company_id, address, postal_code, working_hours,
                                        building_name, building_type, branch_hash)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT(branch_hash) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO branches (company_id, address, postal_code, working_hours,
                                    building_name, building_type, branch_hash)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT(branch_hash) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

def migrate_phones(sqlite_conn, postgres_cur):
    """Миграция таблицы phones."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, branch_id, phone FROM phones")

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((row['branch_id'], row['phone']))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO phones (branch_id, phone)
                   VALUES (%s, %s)
                   ON CONFLICT(branch_id, phone) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO phones (branch_id, phone)
               VALUES (%s, %s)
               ON CONFLICT(branch_id, phone) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

def migrate_emails(sqlite_conn, postgres_cur):
    """Миграция таблицы emails."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, company_id, email FROM emails")

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((row['company_id'], row['email'].lower()))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO emails (company_id, email)
                   VALUES (%s, %s)
                   ON CONFLICT(company_id, email) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO emails (company_id, email)
               VALUES (%s, %s)
               ON CONFLICT(company_id, email) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

def migrate_socials(sqlite_conn, postgres_cur):
    """Миграция таблицы socials."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, company_id, type, url FROM socials")

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((row['company_id'], row['type'], row['url']))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO socials (company_id, type, url)
                   VALUES (%s, %s, %s)
                   ON CONFLICT(company_id, type, url) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO socials (company_id, type, url)
               VALUES (%s, %s, %s)
               ON CONFLICT(company_id, type, url) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

def migrate_categories(sqlite_conn, postgres_cur):
    """Миграция таблицы categories."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT id, name, parent_id FROM categories")

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((row['name'], row['parent_id']))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO categories (name, parent_id)
                   VALUES (%s, %s)
                   ON CONFLICT(name, parent_id) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO categories (name, parent_id)
               VALUES (%s, %s)
               ON CONFLICT(name, parent_id) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

def migrate_company_categories(sqlite_conn, postgres_cur):
    """Миграция таблицы company_categories."""
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT company_id, category_id FROM company_categories")

    batch = []
    count = 0

    for row in sqlite_cur.fetchall():
        batch.append((row['company_id'], row['category_id']))

        if len(batch) >= BATCH_SIZE:
            postgres_cur.executemany(
                """INSERT INTO company_categories (company_id, category_id)
                   VALUES (%s, %s)
                   ON CONFLICT(company_id, category_id) DO NOTHING""",
                batch
            )
            count += len(batch)
            print(f"  ✓ {count} записей")
            batch = []

    if batch:
        postgres_cur.executemany(
            """INSERT INTO company_categories (company_id, category_id)
               VALUES (%s, %s)
               ON CONFLICT(company_id, category_id) DO NOTHING""",
            batch
        )
        count += len(batch)
        print(f"  ✓ {count} записей всего")

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    try:
        migrate_data()
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        exit(1)
