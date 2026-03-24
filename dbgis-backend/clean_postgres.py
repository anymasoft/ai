#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
clean_postgres.py — Полная очистка и оптимизация PostgreSQL базы.

Удаляет ВСЕ данные из таблиц, VACUUM ANALYZE для сжатия.

ВНИМАНИЕ: операция необратима. Используйте перед пересоздание
данных из SQLite (sync_sqlite_to_postgres.py).

Запуск:
    python clean_postgres.py
    python clean_postgres.py --force  (без запроса подтверждения)
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

# Порядок удаления: дочерние таблицы → родительские (FK не нарушаются)
TRUNCATE_ORDER = [
    "company_categories",
    "phones",
    "emails",
    "socials",
    "company_aliases",
    "branches",
    "categories",
    "companies",
]

VACUUM_TABLES = TRUNCATE_ORDER


def get_pg():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    conn.autocommit = False
    return conn


def header(title):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def confirm_dangerous_operation():
    """Запрашивает подтверждение перед опасной операцией."""
    if "--force" in sys.argv:
        return True

    header("ПРЕДУПРЕЖДЕНИЕ: ВСЕ ДАННЫЕ БУДУТ УДАЛЕНЫ")
    print(f"  База: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    print(f"  Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("  Это действие необратимо!")
    print()
    response = input("  Вы уверены? Введите 'yes' для подтверждения: ").strip().lower()
    return response == "yes"


def get_table_counts(conn):
    """Возвращает количество записей в каждой таблице."""
    cur = conn.cursor()
    counts = {}
    for table in TRUNCATE_ORDER:
        cur.execute(f"SELECT COUNT(*) as cnt FROM {table}")
        counts[table] = cur.fetchone()[0]
    cur.close()
    return counts


def step1_show_current_state(conn):
    """Показывает текущее состояние базы."""
    header("ШАГ 1: ТЕКУЩЕЕ СОСТОЯНИЕ")
    counts = get_table_counts(conn)
    for table in TRUNCATE_ORDER:
        cnt = counts[table]
        marker = "" if cnt == 0 else " ⚠ НЕ ПУСТО"
        print(f"  {table:25} {cnt:>10} записей{marker}")

    total = sum(counts.values())
    print(f"\n  Всего записей: {total}")
    return total


def step2_truncate_tables(conn):
    """Удаляет все данные из таблиц."""
    header("ШАГ 2: УДАЛЕНИЕ ДАННЫХ")
    cur = conn.cursor()

    for table in TRUNCATE_ORDER:
        cur.execute(f"TRUNCATE TABLE {table} CASCADE")
        print(f"  TRUNCATE {table} — OK")

    conn.commit()
    cur.close()
    print()
    print("  Все данные удалены.")


def step3_reset_sequences(conn):
    """Сбрасывает SERIAL sequences."""
    header("ШАГ 3: СБРОС SEQUENCES")
    cur = conn.cursor()

    tables_with_serial = [
        ("company_aliases", "id"),
        ("branches", "id"),
        ("phones", "id"),
        ("emails", "id"),
        ("socials", "id"),
        ("categories", "id"),
    ]

    for table, col in tables_with_serial:
        cur.execute(f"""
            SELECT setval(
                pg_get_serial_sequence('{table}', '{col}'),
                1,
                false
            )
        """)
        print(f"  setval({table}.{col}) → 1")

    conn.commit()
    cur.close()


def step4_vacuum_analyze(conn):
    """Выполняет VACUUM ANALYZE для оптимизации."""
    header("ШАГ 4: VACUUM ANALYZE (ОПТИМИЗАЦИЯ)")
    cur = conn.cursor()

    # VACUUM нужно запускать вне транзакции
    conn.set_session(autocommit=True)

    print("\n  VACUUM FULL (сжатие)...")
    cur.execute("VACUUM FULL")

    for table in VACUUM_TABLES:
        print(f"  ANALYZE {table}...")
        cur.execute(f"ANALYZE {table}")

    cur.close()
    print("\n  Оптимизация завершена.")


def step5_final_check(conn):
    """Проверяет, что все таблицы пусты."""
    header("ШАГ 5: ФИНАЛЬНАЯ ПРОВЕРКА")
    counts = get_table_counts(conn)
    all_clean = all(cnt == 0 for cnt in counts.values())

    for table in TRUNCATE_ORDER:
        cnt = counts[table]
        status = "✓ пусто" if cnt == 0 else "✗ ОШИБКА"
        print(f"  {table:25} {cnt:>10} записей  [{status}]")

    if all_clean:
        print("\n  ✓ ВСЕ ТАБЛИЦЫ ОЧИЩЕНЫ")
        return True
    else:
        print("\n  ✗ ОШИБКА: таблицы содержат данные")
        return False


def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║          ОЧИСТКА И ОПТИМИЗАЦИЯ POSTGRESQL               ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"  Хост: {DB_HOST}:{DB_PORT}")
    print(f"  База: {DB_NAME}")
    print(f"  Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if not confirm_dangerous_operation():
        print("\n  Операция отменена.")
        return

    print()
    conn = get_pg()

    try:
        # ШАГ 1
        total_before = step1_show_current_state(conn)

        if total_before == 0:
            print("\n  База уже пуста. Пропуск удаления.")
        else:
            # ШАГ 2
            step2_truncate_tables(conn)

            # ШАГ 3
            step3_reset_sequences(conn)

        # ШАГ 4
        step4_vacuum_analyze(conn)

        # ШАГ 5
        success = step5_final_check(conn)

        # ИТОГ
        header("ИТОГ")
        if success:
            if total_before > 0:
                print(f"  ✓ Удалено записей: {total_before}")
            print(f"  ✓ База очищена и оптимизирована")
            print(f"  Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            print("  ✗ Ошибка при очистке")
            sys.exit(1)

        print("=" * 60)
        print()

    except Exception as e:
        print(f"\n✗ Ошибка: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
