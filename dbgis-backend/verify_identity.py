#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_identity.py — Доказательство идентичности результатов до/после оптимизации SQL.

Запускает ОРИГИНАЛЬНЫЙ и ОПТИМИЗИРОВАННЫЙ запрос с одинаковыми параметрами
и сравнивает результаты строка за строкой.

Запуск:
    python verify_identity.py                  # Все тесты
    python verify_identity.py --verbose        # С деталями
    python verify_identity.py --explain        # + EXPLAIN ANALYZE

Требует: PostgreSQL с данными (dbgis).
"""

import argparse
import os
import sys
import time

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


def get_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
        cursor_factory=RealDictCursor
    )


# ============================================================
# ОРИГИНАЛЬНЫЕ SQL (скопированы из main.py ДО оптимизации)
# ============================================================

ORIGINAL_LIST_SQL = """
    SELECT
        c.id, c.name, c.city, c.domain, c.website, c.created_at,
        COALESCE(ph.phones, '') as phones,
        COALESCE(em.emails, '') as emails,
        COALESCE(addr.address, '') as address,
        COALESCE(soc.socials, '') as socials,
        STRING_AGG(DISTINCT cat.name, ', ') as categories
    FROM companies c
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(p.phone, ', ' ORDER BY CASE WHEN p.source = 'enrichment' THEN 1 ELSE 2 END) as phones
        FROM phones p JOIN branches b ON p.branch_id = b.id WHERE b.company_id = c.id
    ) ph ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(e.email, ', ' ORDER BY CASE WHEN e.source = 'enrichment' THEN 1 ELSE 2 END) as emails
        FROM emails e WHERE e.company_id = c.id
    ) em ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(DISTINCT b.address, '; ') as address
        FROM branches b WHERE b.company_id = c.id
          AND b.address IS NOT NULL AND b.address != '' AND b.address != 'enriched'
    ) addr ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(s.type || ':' || s.url, ', ') as socials
        FROM socials s WHERE s.company_id = c.id
    ) soc ON TRUE
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

ORIGINAL_COUNT_SQL = """
    SELECT COUNT(DISTINCT c.id) as total
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

# ============================================================
# ОПТИМИЗИРОВАННЫЕ SQL (текущие из main.py)
# ============================================================

OPTIMIZED_FILTER_SQL = """
    SELECT c.id,
           (EXISTS (
               SELECT 1 FROM phones p
               JOIN branches b ON p.branch_id = b.id
               WHERE b.company_id = c.id
           )) as has_phones,
           (EXISTS (
               SELECT 1 FROM emails e WHERE e.company_id = c.id
           )) as has_emails,
           (c.domain IS NOT NULL AND c.domain != '') as has_domain
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

OPTIMIZED_ENRICH_FROM = """
    SELECT
        c.id, c.name, c.city, c.domain, c.website, c.created_at,
        COALESCE(ph.phones, '') as phones,
        COALESCE(em.emails, '') as emails,
        COALESCE(addr.address, '') as address,
        COALESCE(soc.socials, '') as socials,
        STRING_AGG(DISTINCT cat.name, ', ') as categories
    FROM filtered f
    JOIN companies c ON c.id = f.id
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(p.phone, ', ' ORDER BY CASE WHEN p.source = 'enrichment' THEN 1 ELSE 2 END) as phones
        FROM phones p JOIN branches b ON p.branch_id = b.id WHERE b.company_id = c.id
    ) ph ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(e.email, ', ' ORDER BY CASE WHEN e.source = 'enrichment' THEN 1 ELSE 2 END) as emails
        FROM emails e WHERE e.company_id = c.id
    ) em ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(DISTINCT b.address, '; ') as address
        FROM branches b WHERE b.company_id = c.id
          AND b.address IS NOT NULL AND b.address != '' AND b.address != 'enriched'
    ) addr ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(s.type || ':' || s.url, ', ') as socials
        FROM socials s WHERE s.company_id = c.id
    ) soc ON TRUE
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

OPTIMIZED_ENRICH_GROUP = """
    GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,
             ph.phones, em.emails, addr.address, soc.socials,
             f.has_phones, f.has_emails, f.has_domain
"""

OPTIMIZED_COUNT_SQL = """
    SELECT COUNT(DISTINCT c.id) as total
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
"""


# ============================================================
# ТЕСТОВЫЕ СЦЕНАРИИ
# ============================================================

def prepare_test_cases(conn):
    """Генерирует тестовые наборы из реальных данных."""
    cur = conn.cursor()

    # Популярные category_id
    cur.execute("""
        SELECT cc.category_id, COUNT(DISTINCT cc.company_id) as cnt
        FROM company_categories cc
        GROUP BY cc.category_id ORDER BY cnt DESC LIMIT 200
    """)
    popular_cats = [r["category_id"] for r in cur.fetchall()]

    # Город с наибольшим числом компаний
    cur.execute("""
        SELECT ci.id FROM cities ci
        JOIN companies c ON c.city_id = ci.id
        GROUP BY ci.id ORDER BY COUNT(*) DESC LIMIT 1
    """)
    row = cur.fetchone()
    top_city_id = row["id"] if row else None

    cur.close()

    if len(popular_cats) < 5:
        print("ОШИБКА: слишком мало категорий. Нужно минимум 5.")
        sys.exit(1)

    tests = [
        {
            "name": "1. Precision (15 cat_ids, без города)",
            "category_ids": popular_cats[:15],
            "city_ids": None,
            "category_filter_ids": None,
            "category_ilike": None,
        },
        {
            "name": "2. Precision + город",
            "category_ids": popular_cats[:15],
            "city_ids": [top_city_id] if top_city_id else None,
            "category_filter_ids": None,
            "category_ilike": None,
        },
        {
            "name": "3. Coverage (100+ cat_ids)",
            "category_ids": popular_cats[:min(120, len(popular_cats))],
            "city_ids": None,
            "category_filter_ids": None,
            "category_ilike": None,
        },
        {
            "name": "4. Coverage + город",
            "category_ids": popular_cats[:min(120, len(popular_cats))],
            "city_ids": [top_city_id] if top_city_id else None,
            "category_filter_ids": None,
            "category_ilike": None,
        },
        {
            "name": "5. category_filter_ids AND (2 категории)",
            "category_ids": None,
            "city_ids": None,
            "category_filter_ids": popular_cats[:2],
            "category_ilike": None,
        },
        {
            "name": "6. Без категорий (только город)",
            "category_ids": None,
            "city_ids": [top_city_id] if top_city_id else None,
            "category_filter_ids": None,
            "category_ilike": None,
        },
        {
            "name": "7. Большой coverage (200+ cat_ids)",
            "category_ids": popular_cats,
            "city_ids": None,
            "category_filter_ids": None,
            "category_ilike": None,
        },
    ]

    return tests


def build_where(category_ids, city_ids, category_filter_ids, category_ilike):
    """Строит WHERE (упрощённый build_filter_clause для тестирования)."""
    clauses = []
    params = []

    if city_ids:
        clauses.append("c.city_id = ANY(%s)")
        params.append(list(city_ids))

    if category_filter_ids and len(category_filter_ids) >= 2:
        clauses.append("cc.category_id = ANY(%s)")
        params.append(list(category_filter_ids))
        having = " HAVING COUNT(DISTINCT cc.category_id) = %s"
        having_params = [len(category_filter_ids)]
    elif category_filter_ids and len(category_filter_ids) == 1:
        clauses.append("cc.category_id = %s")
        params.append(category_filter_ids[0])
        having = ""
        having_params = []
    elif category_ids:
        clauses.append("cc.category_id = ANY(%s)")
        params.append(list(category_ids))
        having = ""
        having_params = []
    elif category_ilike:
        clauses.append("cat.name ILIKE %s")
        params.append(f"%{category_ilike}%")
        having = ""
        having_params = []
    else:
        having = ""
        having_params = []

    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    return where, params, having, having_params


def build_enrich_where(category_ids, category_filter_ids, category_ilike):
    """Строит WHERE для фазы 2 ENRICH (фильтр категорий)."""
    if category_filter_ids:
        return " WHERE cc.category_id = ANY(%s)", [list(category_filter_ids)]
    elif category_ids:
        return " WHERE cc.category_id = ANY(%s)", [list(category_ids)]
    elif category_ilike:
        return " WHERE cat.name ILIKE %s", [f"%{category_ilike}%"]
    return "", []


# ============================================================
# ЗАПУСК ЗАПРОСОВ
# ============================================================

def run_original(conn, where, params, having, having_params, limit=100, offset=0):
    """Выполняет ОРИГИНАЛЬНЫЙ запрос."""
    order = (" ORDER BY (COALESCE(ph.phones, '') != '') DESC,"
             " (COALESCE(em.emails, '') != '') DESC,"
             " (c.domain IS NOT NULL AND c.domain != '') DESC,"
             " c.name ASC")
    group = (" GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
             " ph.phones, em.emails, addr.address, soc.socials")

    sql = ORIGINAL_LIST_SQL + where + group + having + order + " LIMIT %s OFFSET %s"
    cur = conn.cursor()
    start = time.perf_counter()
    cur.execute(sql, params + having_params + [limit, offset])
    rows = cur.fetchall()
    elapsed = time.perf_counter() - start

    # COUNT
    if having:
        count_sql = (
            "SELECT COUNT(*) as total FROM ("
            "  SELECT c.id FROM companies c"
            "  LEFT JOIN company_categories cc ON c.id = cc.company_id"
            "  LEFT JOIN categories cat ON cc.category_id = cat.id"
            + where + "  GROUP BY c.id" + having + ") sub"
        )
        cur.execute(count_sql, params + having_params)
    else:
        count_sql = ORIGINAL_COUNT_SQL + where
        cur.execute(count_sql, params)
    total = cur.fetchone()["total"]

    cur.close()
    return rows, total, elapsed


def run_optimized(conn, where, params, having, having_params,
                  enrich_where, enrich_params, limit=100, offset=0):
    """Выполняет ОПТИМИЗИРОВАННЫЙ запрос."""
    sql = (
        "WITH filtered AS ("
        + OPTIMIZED_FILTER_SQL + where
        + " GROUP BY c.id" + having
        + " ORDER BY has_phones DESC, has_emails DESC, has_domain DESC, c.name ASC"
        + " LIMIT %s OFFSET %s"
        + ")"
        + OPTIMIZED_ENRICH_FROM
        + enrich_where
        + OPTIMIZED_ENRICH_GROUP
        + " ORDER BY f.has_phones DESC, f.has_emails DESC, f.has_domain DESC, c.name ASC"
    )
    cur = conn.cursor()
    start = time.perf_counter()
    cur.execute(sql, params + having_params + [limit, offset] + enrich_params)
    rows = cur.fetchall()
    elapsed = time.perf_counter() - start

    # COUNT
    needs_cat = bool(enrich_where and "cat.name" in enrich_where)
    if having:
        count_sql = (
            "SELECT COUNT(*) as total FROM ("
            "  SELECT c.id FROM companies c"
            "  LEFT JOIN company_categories cc ON c.id = cc.company_id"
            + (" LEFT JOIN categories cat ON cc.category_id = cat.id" if needs_cat else "")
            + where + "  GROUP BY c.id" + having + ") sub"
        )
        cur.execute(count_sql, params + having_params)
    else:
        count_base = (ORIGINAL_COUNT_SQL if needs_cat else OPTIMIZED_COUNT_SQL)
        count_sql = count_base + where
        cur.execute(count_sql, params)
    total = cur.fetchone()["total"]

    cur.close()
    return rows, total, elapsed


# ============================================================
# СРАВНЕНИЕ
# ============================================================

def compare_rows(orig_rows, opt_rows, verbose=False):
    """Сравнивает два набора строк. Возвращает (ok, details)."""
    errors = []

    # 1. Количество
    if len(orig_rows) != len(opt_rows):
        errors.append(f"Количество строк: original={len(orig_rows)}, optimized={len(opt_rows)}")
        return False, errors

    # 2. company_id (тот же список, тот же порядок)
    orig_ids = [r["id"] for r in orig_rows]
    opt_ids = [r["id"] for r in opt_rows]

    if orig_ids != opt_ids:
        # Проверяем: те же множества, но другой порядок?
        if set(orig_ids) == set(opt_ids):
            errors.append("company_id: множества совпадают, но ПОРЯДОК ОТЛИЧАЕТСЯ")
            # Показать первые расхождения
            for i, (o, n) in enumerate(zip(orig_ids, opt_ids)):
                if o != n:
                    errors.append(f"  позиция {i}: original={o}, optimized={n}")
                    if len(errors) > 7:
                        errors.append("  ... (ещё расхождения)")
                        break
        else:
            missing = set(orig_ids) - set(opt_ids)
            extra = set(opt_ids) - set(orig_ids)
            errors.append(f"company_id: РАЗНЫЕ МНОЖЕСТВА! missing={list(missing)[:5]}, extra={list(extra)[:5]}")
        return False, errors

    # 3. Данные (phones, emails, address, socials, categories)
    fields = ["phones", "emails", "address", "socials", "categories"]
    data_ok = True
    for i, (orig, opt) in enumerate(zip(orig_rows, opt_rows)):
        for field in fields:
            ov = orig.get(field, "")
            nv = opt.get(field, "")
            if ov != nv:
                data_ok = False
                errors.append(
                    f"  row {i} (id={orig['id']}), '{field}':\n"
                    f"    original:  {str(ov)[:100]}\n"
                    f"    optimized: {str(nv)[:100]}"
                )
                if len(errors) > 10:
                    errors.append("  ... (ещё расхождения)")
                    return False, errors

    if not data_ok:
        return False, errors

    return True, []


# ============================================================
# MAIN
# ============================================================

def run_all_tests(verbose=False, explain=False):
    conn = get_conn()
    tests = prepare_test_cases(conn)

    print("=" * 70)
    print("ВЕРИФИКАЦИЯ ИДЕНТИЧНОСТИ: оригинал vs оптимизированный")
    print("=" * 70)

    all_passed = True

    for test in tests:
        print(f"\n--- {test['name']} ---")

        cat_ids = test["category_ids"]
        city_ids = test["city_ids"]
        cat_filter = test["category_filter_ids"]
        cat_ilike = test["category_ilike"]

        where, params, having, having_params = build_where(cat_ids, city_ids, cat_filter, cat_ilike)
        enrich_where, enrich_params = build_enrich_where(cat_ids, cat_filter, cat_ilike)

        # Прогрев
        try:
            run_original(conn, where, params, having, having_params)
            run_optimized(conn, where, params, having, having_params, enrich_where, enrich_params)
        except Exception as e:
            print(f"  ОШИБКА при прогреве: {e}")
            all_passed = False
            continue

        # Реальные замеры (3 прогона, берём последний)
        for _ in range(3):
            orig_rows, orig_total, orig_time = run_original(conn, where, params, having, having_params)
        for _ in range(3):
            opt_rows, opt_total, opt_time = run_optimized(
                conn, where, params, having, having_params, enrich_where, enrich_params)

        # Сравнение
        ok, errors = compare_rows(orig_rows, opt_rows, verbose)

        # COUNT
        count_ok = orig_total == opt_total

        if ok and count_ok:
            speedup = orig_time / opt_time if opt_time > 0 else float('inf')
            print(f"  ✅ company_id: ИДЕНТИЧНЫ ({len(orig_rows)} строк)")
            print(f"  ✅ Данные: ИДЕНТИЧНЫ (phones, emails, address, socials, categories)")
            print(f"  ✅ COUNT: ИДЕНТИЧЕН ({orig_total})")
            print(f"  ⏱  original: {orig_time*1000:.1f}ms, optimized: {opt_time*1000:.1f}ms ({speedup:.1f}x)")
        else:
            all_passed = False
            if not ok:
                print(f"  ❌ РАСХОЖДЕНИЕ в данных:")
                for err in errors:
                    print(f"    {err}")
            if not count_ok:
                print(f"  ❌ COUNT: original={orig_total}, optimized={opt_total}")

        if explain:
            cur = conn.cursor()
            print(f"\n  EXPLAIN ANALYZE (optimized):")
            sql = (
                "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) WITH filtered AS ("
                + OPTIMIZED_FILTER_SQL + where
                + " GROUP BY c.id" + having
                + " ORDER BY has_phones DESC, has_emails DESC, has_domain DESC, c.name ASC"
                + " LIMIT %s OFFSET %s"
                + ")"
                + OPTIMIZED_ENRICH_FROM + enrich_where + OPTIMIZED_ENRICH_GROUP
                + " ORDER BY f.has_phones DESC, f.has_emails DESC, f.has_domain DESC, c.name ASC"
            )
            cur.execute(sql, params + having_params + [100, 0] + enrich_params)
            for row in cur.fetchall():
                print(f"    {list(row.values())[0]}")
            cur.close()

    conn.close()

    print("\n" + "=" * 70)
    if all_passed:
        print("✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ: результаты 100% идентичны")
        print("   Вердикт: МОЖНО МЕРЖИТЬ")
    else:
        print("❌ ЕСТЬ РАСХОЖДЕНИЯ")
        print("   Вердикт: НЕЛЬЗЯ МЕРЖИТЬ без исправлений")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Верификация идентичности SQL-запросов")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--explain", action="store_true")
    args = parser.parse_args()
    run_all_tests(verbose=args.verbose, explain=args.explain)
