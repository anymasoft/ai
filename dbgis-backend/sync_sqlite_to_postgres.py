#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Инкрементальная синхронизация SQLite → PostgreSQL.

В отличие от migrate_sqlite_to_postgres.py (полная миграция с TRUNCATE):
- НЕ очищает таблицы
- НЕ отключает триггеры
- UPSERT: новые записи добавляются, существующие обновляются
- DELETE: записи, удалённые из SQLite, удаляются из PostgreSQL
- Сервис продолжает работать во время синхронизации

Порядок: сначала родительские таблицы, потом дочерние.
Удаление: в обратном порядке (сначала дочерние, потом родительские).
"""

import os
import sqlite3
import psycopg2
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

# ============================================================
# ПОДКЛЮЧЕНИЯ
# ============================================================

def get_sqlite_connection(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"SQLite база не найдена: {path}")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn

def get_postgres_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )

# ============================================================
# УТИЛИТЫ
# ============================================================

def batch_execute(pg_cur, query, rows, table_name):
    """Выполняет запрос батчами, возвращает количество обработанных."""
    batch = []
    count = 0
    for row in rows:
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            pg_cur.executemany(query, batch)
            count += len(batch)
            if count % 10000 == 0:
                print(f"    [{table_name}] обработано: {count}")
            batch = []
    if batch:
        pg_cur.executemany(query, batch)
        count += len(batch)
    print(f"    [{table_name}] итого: {count}")
    return count


def delete_removed(pg_cur, table_name, sqlite_ids, id_column="id"):
    """Удаляет из PostgreSQL записи, которых нет в SQLite.

    Использует временную таблицу для эффективного сравнения.
    """
    tmp_table = f"_tmp_sync_{table_name}"

    pg_cur.execute(f"CREATE TEMP TABLE {tmp_table} ({id_column} INTEGER PRIMARY KEY)")
    # Вставляем ID батчами
    batch = []
    for sid in sqlite_ids:
        batch.append((sid,))
        if len(batch) >= BATCH_SIZE:
            pg_cur.executemany(f"INSERT INTO {tmp_table} ({id_column}) VALUES (%s)", batch)
            batch = []
    if batch:
        pg_cur.executemany(f"INSERT INTO {tmp_table} ({id_column}) VALUES (%s)", batch)

    # Удаляем записи, которых нет в SQLite
    pg_cur.execute(f"""
        DELETE FROM {table_name} t
        WHERE NOT EXISTS (
            SELECT 1 FROM {tmp_table} tmp WHERE tmp.{id_column} = t.{id_column}
        )
    """)
    deleted = pg_cur.rowcount

    pg_cur.execute(f"DROP TABLE {tmp_table}")
    return deleted


def delete_removed_composite(pg_cur, table_name, sqlite_pairs, col_a, col_b):
    """Удаление для таблиц с составным PK (company_categories)."""
    tmp_table = f"_tmp_sync_{table_name}"

    pg_cur.execute(f"""
        CREATE TEMP TABLE {tmp_table} (
            {col_a} INTEGER, {col_b} INTEGER,
            PRIMARY KEY ({col_a}, {col_b})
        )
    """)
    batch = []
    for pair in sqlite_pairs:
        batch.append(pair)
        if len(batch) >= BATCH_SIZE:
            pg_cur.executemany(
                f"INSERT INTO {tmp_table} ({col_a}, {col_b}) VALUES (%s, %s)", batch
            )
            batch = []
    if batch:
        pg_cur.executemany(
            f"INSERT INTO {tmp_table} ({col_a}, {col_b}) VALUES (%s, %s)", batch
        )

    pg_cur.execute(f"""
        DELETE FROM {table_name} t
        WHERE NOT EXISTS (
            SELECT 1 FROM {tmp_table} tmp
            WHERE tmp.{col_a} = t.{col_a} AND tmp.{col_b} = t.{col_b}
        )
    """)
    deleted = pg_cur.rowcount

    pg_cur.execute(f"DROP TABLE {tmp_table}")
    return deleted


def reset_serial_sequence(pg_cur, table_name, column="id"):
    pg_cur.execute(f"""
        SELECT setval(
            pg_get_serial_sequence('{table_name}', '{column}'),
            COALESCE((SELECT MAX({column}) FROM {table_name}), 0) + 1,
            false
        )
    """)

# ============================================================
# UPSERT ФУНКЦИИ
# ============================================================

def sync_companies(sqlite_conn, pg_cur):
    print("--- SYNC companies START ---")
    rows = sqlite_conn.execute(
        "SELECT id, name, city, website, domain, created_at, updated_at FROM companies"
    ).fetchall()

    data = []
    ids = []
    now = datetime.now().isoformat()
    for r in rows:
        ids.append(r["id"])
        data.append((
            r["id"], r["name"], r["city"], r["website"], r["domain"],
            r["created_at"] or now, r["updated_at"] or now
        ))

    upserted = batch_execute(pg_cur, """
        INSERT INTO companies (id, name, city, website, domain, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            city = EXCLUDED.city,
            website = EXCLUDED.website,
            domain = EXCLUDED.domain,
            updated_at = EXCLUDED.updated_at
        WHERE
            companies.name IS DISTINCT FROM EXCLUDED.name OR
            companies.city IS DISTINCT FROM EXCLUDED.city OR
            companies.website IS DISTINCT FROM EXCLUDED.website OR
            companies.domain IS DISTINCT FROM EXCLUDED.domain OR
            companies.updated_at IS DISTINCT FROM EXCLUDED.updated_at
    """, data, "companies")

    deleted = delete_removed(pg_cur, "companies", ids)
    return upserted, deleted


def sync_company_aliases(sqlite_conn, pg_cur):
    print("--- SYNC company_aliases START ---")
    rows = sqlite_conn.execute(
        "SELECT id, company_id, name FROM company_aliases"
    ).fetchall()

    data = []
    ids = []
    for r in rows:
        ids.append(r["id"])
        data.append((r["id"], r["company_id"], r["name"]))

    upserted = batch_execute(pg_cur, """
        INSERT INTO company_aliases (id, company_id, name)
        VALUES (%s, %s, %s)
        ON CONFLICT (company_id, name) DO UPDATE SET
            name = EXCLUDED.name
        WHERE
            company_aliases.name IS DISTINCT FROM EXCLUDED.name
    """, data, "company_aliases")

    deleted = delete_removed(pg_cur, "company_aliases", ids)
    reset_serial_sequence(pg_cur, "company_aliases")
    return upserted, deleted


def sync_branches(sqlite_conn, pg_cur):
    print("--- SYNC branches START ---")
    rows = sqlite_conn.execute("""
        SELECT id, company_id, address, postal_code, working_hours,
               building_name, building_type, branch_hash FROM branches
    """).fetchall()

    data = []
    ids = []
    for r in rows:
        ids.append(r["id"])
        data.append((
            r["id"], r["company_id"], r["address"], r["postal_code"],
            r["working_hours"], r["building_name"], r["building_type"], r["branch_hash"]
        ))

    upserted = batch_execute(pg_cur, """
        INSERT INTO branches (id, company_id, address, postal_code, working_hours,
                              building_name, building_type, branch_hash)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (branch_hash) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            address = EXCLUDED.address,
            postal_code = EXCLUDED.postal_code,
            working_hours = EXCLUDED.working_hours,
            building_name = EXCLUDED.building_name,
            building_type = EXCLUDED.building_type
        WHERE
            branches.company_id IS DISTINCT FROM EXCLUDED.company_id OR
            branches.address IS DISTINCT FROM EXCLUDED.address OR
            branches.postal_code IS DISTINCT FROM EXCLUDED.postal_code OR
            branches.working_hours IS DISTINCT FROM EXCLUDED.working_hours OR
            branches.building_name IS DISTINCT FROM EXCLUDED.building_name OR
            branches.building_type IS DISTINCT FROM EXCLUDED.building_type
    """, data, "branches")

    deleted = delete_removed(pg_cur, "branches", ids)
    reset_serial_sequence(pg_cur, "branches")
    return upserted, deleted


def sync_phones(sqlite_conn, pg_cur):
    print("--- SYNC phones START ---")
    rows = sqlite_conn.execute("SELECT id, branch_id, phone FROM phones").fetchall()

    data = []
    ids = []
    for r in rows:
        ids.append(r["id"])
        data.append((r["id"], r["branch_id"], r["phone"], "2gis"))

    upserted = batch_execute(pg_cur, """
        INSERT INTO phones (id, branch_id, phone, source)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (branch_id, phone) DO UPDATE SET
            phone = EXCLUDED.phone
        WHERE
            phones.phone IS DISTINCT FROM EXCLUDED.phone
    """, data, "phones")

    deleted = delete_removed(pg_cur, "phones", ids)
    reset_serial_sequence(pg_cur, "phones")
    return upserted, deleted


def sync_emails(sqlite_conn, pg_cur):
    print("--- SYNC emails START ---")
    rows = sqlite_conn.execute("SELECT id, company_id, email FROM emails").fetchall()

    data = []
    ids = []
    for r in rows:
        ids.append(r["id"])
        email = r["email"].lower()
        data.append((r["id"], r["company_id"], email, "2gis"))

    upserted = batch_execute(pg_cur, """
        INSERT INTO emails (id, company_id, email, source)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (company_id, email) DO UPDATE SET
            email = EXCLUDED.email
        WHERE
            emails.email IS DISTINCT FROM EXCLUDED.email
    """, data, "emails")

    deleted = delete_removed(pg_cur, "emails", ids)
    reset_serial_sequence(pg_cur, "emails")
    return upserted, deleted


def sync_socials(sqlite_conn, pg_cur):
    print("--- SYNC socials START ---")
    rows = sqlite_conn.execute(
        "SELECT id, company_id, type, url FROM socials"
    ).fetchall()

    data = []
    ids = []
    for r in rows:
        ids.append(r["id"])
        data.append((r["id"], r["company_id"], r["type"], r["url"]))

    upserted = batch_execute(pg_cur, """
        INSERT INTO socials (id, company_id, type, url)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (company_id, type, url) DO UPDATE SET
            url = EXCLUDED.url
        WHERE
            socials.url IS DISTINCT FROM EXCLUDED.url
    """, data, "socials")

    deleted = delete_removed(pg_cur, "socials", ids)
    reset_serial_sequence(pg_cur, "socials")
    return upserted, deleted


def sync_categories(sqlite_conn, pg_cur):
    print("--- SYNC categories START ---")
    rows = sqlite_conn.execute(
        "SELECT id, name, parent_id FROM categories ORDER BY id"
    ).fetchall()

    data = []
    ids = []
    for r in rows:
        ids.append(r["id"])
        data.append((r["id"], r["name"], r["parent_id"]))

    upserted = batch_execute(pg_cur, """
        INSERT INTO categories (id, name, parent_id)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = EXCLUDED.parent_id
        WHERE
            categories.name IS DISTINCT FROM EXCLUDED.name OR
            categories.parent_id IS DISTINCT FROM EXCLUDED.parent_id
    """, data, "categories")

    deleted = delete_removed(pg_cur, "categories", ids)
    reset_serial_sequence(pg_cur, "categories")
    return upserted, deleted


def sync_company_categories(sqlite_conn, pg_cur):
    print("--- SYNC company_categories START ---")
    rows = sqlite_conn.execute(
        "SELECT company_id, category_id FROM company_categories"
    ).fetchall()

    data = []
    pairs = []
    for r in rows:
        pairs.append((r["company_id"], r["category_id"]))
        data.append((r["company_id"], r["category_id"]))

    upserted = batch_execute(pg_cur, """
        INSERT INTO company_categories (company_id, category_id)
        VALUES (%s, %s)
        ON CONFLICT (company_id, category_id) DO NOTHING
    """, data, "company_categories")

    deleted = delete_removed_composite(
        pg_cur, "company_categories", pairs, "company_id", "category_id"
    )
    return upserted, deleted

# ============================================================
# ОРКЕСТРАЦИЯ
# ============================================================

# Порядок: сначала родительские, потом дочерние
SYNC_STEPS = [
    ("companies",          sync_companies),
    ("company_aliases",    sync_company_aliases),
    ("categories",         sync_categories),
    ("branches",           sync_branches),
    ("phones",             sync_phones),
    ("emails",             sync_emails),
    ("socials",            sync_socials),
    ("company_categories", sync_company_categories),
]

# Удаление в обратном порядке (дочерние → родительские) — FK не нарушаются
DELETE_ORDER = list(reversed(SYNC_STEPS))


def sync_data():
    """Инкрементальная синхронизация SQLite → PostgreSQL."""

    print(f"SQLite: {SQLITE_PATH}")
    print(f"PostgreSQL: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    print(f"Начало синхронизации: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    sqlite_conn = get_sqlite_connection(SQLITE_PATH)
    pg_conn = get_postgres_connection()
    pg_cur = pg_conn.cursor()

    try:
        total_upserted = 0
        total_deleted = 0

        for table_name, sync_fn in SYNC_STEPS:
            print(f"  [{table_name}] синхронизация...")
            upserted, deleted = sync_fn(sqlite_conn, pg_cur)
            total_upserted += upserted
            total_deleted += deleted
            print(f"  [{table_name}] UPSERT: {upserted}, DELETE: {deleted}")

        pg_conn.commit()
        print("=" * 60)
        print(f"UPSERT всего: {total_upserted}")
        print(f"DELETE всего: {total_deleted}")

        # VACUUM ANALYZE — очистка мёртвых строк и обновление статистики
        # Выполняется вне транзакции (требует autocommit)
        pg_cur.close()
        pg_conn.set_session(autocommit=True)
        pg_cur = pg_conn.cursor()

        print("=" * 60)
        print("=== VACUUM START ===")
        vacuum_tables = [
            "companies", "company_aliases", "categories", "branches",
            "phones", "emails", "socials", "company_categories"
        ]
        for table in vacuum_tables:
            print(f"  VACUUM ANALYZE {table}...")
            pg_cur.execute(f"VACUUM ANALYZE {table}")
        print("=== VACUUM DONE ===")

        print("=" * 60)
        print(f"Синхронизация завершена: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    except Exception as e:
        pg_conn.rollback()
        print(f"\nОшибка при синхронизации: {e}")
        raise
    finally:
        pg_cur.close()
        pg_conn.close()
        sqlite_conn.close()


if __name__ == "__main__":
    try:
        sync_data()
    except Exception as e:
        print(f"\nОшибка: {e}")
        exit(1)
