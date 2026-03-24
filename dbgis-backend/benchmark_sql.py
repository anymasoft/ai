#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
benchmark_sql.py — Бенчмарк SQL-запросов: генерация данных, замеры, сравнение до/после.

Этапы:
1. Генерация тестовых данных (малый/средний/большой)
2. Базовые замеры текущих запросов (EXPLAIN ANALYZE)
3. Замеры оптимизированных запросов
4. Сравнение результатов (company_id, порядок, данные)

Запуск:
    python benchmark_sql.py --generate        # Генерация данных
    python benchmark_sql.py --baseline        # Замеры текущих запросов
    python benchmark_sql.py --optimized       # Замеры оптимизированных запросов
    python benchmark_sql.py --compare         # Сравнение результатов
    python benchmark_sql.py --all             # Все этапы
    python benchmark_sql.py --explain         # EXPLAIN ANALYZE для ключевых запросов
"""

import argparse
import json
import os
import random
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
# ЭТАП 1: Проверка данных
# ============================================================

def check_data():
    """Проверяет текущее состояние данных в БД."""
    conn = get_conn()
    cur = conn.cursor()

    tables = ['cities', 'companies', 'branches', 'phones', 'emails',
              'socials', 'categories', 'company_categories', 'company_aliases']

    print("=" * 60)
    print("ТЕКУЩЕЕ СОСТОЯНИЕ ДАННЫХ")
    print("=" * 60)

    for t in tables:
        cur.execute(f"SELECT COUNT(*) as cnt FROM {t}")
        cnt = cur.fetchone()["cnt"]
        print(f"  {t:25s}: {cnt:>8,}")

    # Статистика по категориям на компанию
    cur.execute("""
        SELECT
            MIN(cat_count) as min_cats,
            AVG(cat_count)::numeric(10,1) as avg_cats,
            MAX(cat_count) as max_cats,
            COUNT(*) as total_companies
        FROM (
            SELECT company_id, COUNT(*) as cat_count
            FROM company_categories
            GROUP BY company_id
        ) sub
    """)
    stats = cur.fetchone()
    print(f"\n  Категорий на компанию: min={stats['min_cats']}, avg={stats['avg_cats']}, max={stats['max_cats']}")
    print(f"  Компаний с категориями: {stats['total_companies']}")

    # Статистика по городам
    cur.execute("""
        SELECT ci.name, COUNT(*) as cnt
        FROM companies c
        JOIN cities ci ON c.city_id = ci.id
        GROUP BY ci.name
        ORDER BY cnt DESC
        LIMIT 10
    """)
    rows = cur.fetchall()
    print(f"\n  Топ-10 городов:")
    for r in rows:
        print(f"    {r['name']:20s}: {r['cnt']:>6,}")

    # Количество уникальных category_ids в разных диапазонах
    cur.execute("SELECT COUNT(DISTINCT category_id) as cnt FROM company_categories")
    total_cats = cur.fetchone()["cnt"]
    print(f"\n  Уникальных category_id в company_categories: {total_cats}")

    cur.close()
    conn.close()


# ============================================================
# ЭТАП 2: Подготовка тестовых наборов category_ids
# ============================================================

def prepare_test_sets(conn):
    """Генерирует наборы category_ids для бенчмарка (имитация FAISS + coverage)."""
    cur = conn.cursor()

    # Берём реальные category_id с наибольшим числом компаний
    cur.execute("""
        SELECT cc.category_id, COUNT(DISTINCT cc.company_id) as company_count
        FROM company_categories cc
        GROUP BY cc.category_id
        ORDER BY company_count DESC
        LIMIT 200
    """)
    popular_cats = cur.fetchall()

    if len(popular_cats) < 10:
        print("ОШИБКА: слишком мало категорий в БД. Нужно минимум 10.")
        sys.exit(1)

    # Набор 1: Precision (10-30 ids) — как FAISS top-3 категории
    precision_ids = [r["category_id"] for r in popular_cats[:15]]

    # Набор 2: Coverage (100-200 ids) — после рекурсивного расширения
    coverage_ids = [r["category_id"] for r in popular_cats[:min(150, len(popular_cats))]]

    # Набор 3: Большой coverage (200+ ids)
    all_ids = [r["category_id"] for r in popular_cats]

    # Берём город с наибольшим числом компаний
    cur.execute("""
        SELECT ci.id, ci.name
        FROM cities ci
        JOIN companies c ON c.city_id = ci.id
        GROUP BY ci.id, ci.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    """)
    top_city = cur.fetchone()

    cur.close()

    test_sets = {
        "precision": {
            "category_ids": precision_ids,
            "city_ids": None,
            "label": f"Precision ({len(precision_ids)} cat_ids, без города)"
        },
        "precision_city": {
            "category_ids": precision_ids,
            "city_ids": [top_city["id"]] if top_city else None,
            "label": f"Precision ({len(precision_ids)} cat_ids, город: {top_city['name'] if top_city else 'N/A'})"
        },
        "coverage": {
            "category_ids": coverage_ids,
            "city_ids": None,
            "label": f"Coverage ({len(coverage_ids)} cat_ids, без города)"
        },
        "coverage_city": {
            "category_ids": coverage_ids,
            "city_ids": [top_city["id"]] if top_city else None,
            "label": f"Coverage ({len(coverage_ids)} cat_ids, город: {top_city['name'] if top_city else 'N/A'})"
        },
        "large_coverage": {
            "category_ids": all_ids,
            "city_ids": None,
            "label": f"Large coverage ({len(all_ids)} cat_ids, без города)"
        },
    }

    return test_sets


# ============================================================
# SQL ЗАПРОСЫ: текущие (baseline)
# ============================================================

# Текущий COMPANIES_LIST_SQL (копия из main.py)
CURRENT_LIST_SQL = """
    SELECT
        c.id,
        c.name,
        c.city,
        c.domain,
        c.website,
        c.created_at,
        COALESCE(ph.phones, '') as phones,
        COALESCE(em.emails, '') as emails,
        COALESCE(addr.address, '') as address,
        COALESCE(soc.socials, '') as socials,
        STRING_AGG(DISTINCT cat.name, ', ') as categories
    FROM companies c
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(p.phone, ', ' ORDER BY CASE WHEN p.source = 'enrichment' THEN 1 ELSE 2 END) as phones
        FROM phones p
        JOIN branches b ON p.branch_id = b.id
        WHERE b.company_id = c.id
    ) ph ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(e.email, ', ' ORDER BY CASE WHEN e.source = 'enrichment' THEN 1 ELSE 2 END) as emails
        FROM emails e
        WHERE e.company_id = c.id
    ) em ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(DISTINCT b.address, '; ') as address
        FROM branches b
        WHERE b.company_id = c.id
          AND b.address IS NOT NULL AND b.address != ''
          AND b.address != 'enriched'
    ) addr ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(s.type || ':' || s.url, ', ') as socials
        FROM socials s
        WHERE s.company_id = c.id
    ) soc ON TRUE
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

CURRENT_COUNT_SQL = """
    SELECT COUNT(DISTINCT c.id) as total
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

ORDER_CLAUSE = """
    ORDER BY
        (COALESCE(ph.phones, '') != '') DESC,
        (COALESCE(em.emails, '') != '') DESC,
        (c.domain IS NOT NULL AND c.domain != '') DESC,
        c.name ASC
"""

GROUP_BY_CLAUSE = """
    GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,
             ph.phones, em.emails, addr.address, soc.socials
"""


# ============================================================
# SQL ЗАПРОСЫ: оптимизированные
# ============================================================

# Двухфазный запрос: сначала фильтруем company_id, потом подгружаем данные
# Фаза 1: CTE filtered_ids — только id с фильтрацией + сортировка + LIMIT
# Фаза 2: JOIN с LATERAL только для отобранных строк

OPTIMIZED_LIST_SQL = """
    WITH filtered AS (
        SELECT c.id,
               (EXISTS (SELECT 1 FROM phones p JOIN branches b ON p.branch_id = b.id WHERE b.company_id = c.id)) as has_phones,
               (EXISTS (SELECT 1 FROM emails e WHERE e.company_id = c.id)) as has_emails,
               (c.domain IS NOT NULL AND c.domain != '') as has_domain
        FROM companies c
        JOIN company_categories cc ON c.id = cc.company_id
        WHERE cc.category_id = ANY(%s)
        {city_filter}
        GROUP BY c.id
        ORDER BY
            has_phones DESC,
            has_emails DESC,
            has_domain DESC,
            c.name ASC
        LIMIT %s OFFSET %s
    )
    SELECT
        c.id,
        c.name,
        c.city,
        c.domain,
        c.website,
        c.created_at,
        COALESCE(ph.phones, '') as phones,
        COALESCE(em.emails, '') as emails,
        COALESCE(addr.address, '') as address,
        COALESCE(soc.socials, '') as socials,
        STRING_AGG(DISTINCT cat.name, ', ') as categories
    FROM filtered f
    JOIN companies c ON c.id = f.id
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(p.phone, ', ' ORDER BY CASE WHEN p.source = 'enrichment' THEN 1 ELSE 2 END) as phones
        FROM phones p
        JOIN branches b ON p.branch_id = b.id
        WHERE b.company_id = c.id
    ) ph ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(e.email, ', ' ORDER BY CASE WHEN e.source = 'enrichment' THEN 1 ELSE 2 END) as emails
        FROM emails e
        WHERE e.company_id = c.id
    ) em ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(DISTINCT b.address, '; ') as address
        FROM branches b
        WHERE b.company_id = c.id
          AND b.address IS NOT NULL AND b.address != ''
          AND b.address != 'enriched'
    ) addr ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(s.type || ':' || s.url, ', ') as socials
        FROM socials s
        WHERE s.company_id = c.id
    ) soc ON TRUE
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
    GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,
             ph.phones, em.emails, addr.address, soc.socials,
             f.has_phones, f.has_emails, f.has_domain
    ORDER BY
        f.has_phones DESC,
        f.has_emails DESC,
        f.has_domain DESC,
        c.name ASC
"""

# Оптимизированный COUNT: без JOIN categories (не нужен для подсчёта)
OPTIMIZED_COUNT_SQL = """
    SELECT COUNT(DISTINCT cc.company_id) as total
    FROM company_categories cc
    JOIN companies c ON c.id = cc.company_id
    WHERE cc.category_id = ANY(%s)
    {city_filter}
"""


def build_current_query(category_ids, city_ids, limit=100, offset=0):
    """Строит текущий (baseline) запрос."""
    clauses = []
    params = []

    clauses.append("cc.category_id = ANY(%s)")
    params.append(list(category_ids))

    if city_ids:
        clauses.append("c.city_id = ANY(%s)")
        params.append(list(city_ids))

    where = " WHERE " + " AND ".join(clauses)

    list_query = CURRENT_LIST_SQL + where + GROUP_BY_CLAUSE + ORDER_CLAUSE + " LIMIT %s OFFSET %s"
    list_params = params + [limit, offset]

    count_query = CURRENT_COUNT_SQL + where
    count_params = params[:]

    return list_query, list_params, count_query, count_params


def build_optimized_query(category_ids, city_ids, limit=100, offset=0):
    """Строит оптимизированный запрос."""
    params = [list(category_ids)]

    city_filter = ""
    if city_ids:
        city_filter = "AND c.city_id = ANY(%s)"
        params.append(list(city_ids))

    params.extend([limit, offset])

    list_query = OPTIMIZED_LIST_SQL.format(city_filter=city_filter)

    count_params = [list(category_ids)]
    count_city = ""
    if city_ids:
        count_city = "AND c.city_id = ANY(%s)"
        count_params.append(list(city_ids))

    count_query = OPTIMIZED_COUNT_SQL.format(city_filter=count_city)

    return list_query, params, count_query, count_params


# ============================================================
# ЭТАП 3: Запуск бенчмарка
# ============================================================

def run_query(conn, query, params, label="", explain=False):
    """Выполняет запрос и возвращает результат + время."""
    cur = conn.cursor()

    if explain:
        explain_query = "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + query
        cur.execute(explain_query, params)
        plan = cur.fetchall()
        print(f"\n  EXPLAIN ANALYZE [{label}]:")
        for row in plan:
            line = list(row.values())[0]
            print(f"    {line}")

    start = time.perf_counter()
    cur.execute(query, params)
    rows = cur.fetchall()
    elapsed = time.perf_counter() - start

    cur.close()
    return rows, elapsed


def run_benchmark(mode="baseline", explain=False):
    """Запускает бенчмарк для всех тестовых наборов."""
    conn = get_conn()
    test_sets = prepare_test_sets(conn)

    results = {}

    print("=" * 70)
    print(f"БЕНЧМАРК: {'ТЕКУЩИЙ (baseline)' if mode == 'baseline' else 'ОПТИМИЗИРОВАННЫЙ'}")
    print("=" * 70)

    for name, ts in test_sets.items():
        print(f"\n--- {ts['label']} ---")

        cat_ids = ts["category_ids"]
        city_ids = ts["city_ids"]

        if mode == "baseline":
            list_q, list_p, count_q, count_p = build_current_query(cat_ids, city_ids)
        else:
            list_q, list_p, count_q, count_p = build_optimized_query(cat_ids, city_ids)

        # Прогрев (первый запрос может быть медленнее из-за кеша PostgreSQL)
        run_query(conn, list_q, list_p)

        # Замер LIST (3 прогона, берём среднее)
        list_times = []
        list_rows = None
        for _ in range(3):
            rows, elapsed = run_query(conn, list_q, list_p)
            list_times.append(elapsed)
            list_rows = rows

        # Замер COUNT (3 прогона)
        count_times = []
        count_result = None
        for _ in range(3):
            rows, elapsed = run_query(conn, count_q, count_p)
            count_times.append(elapsed)
            count_result = rows[0]["total"] if rows else 0

        avg_list = sum(list_times) / len(list_times)
        avg_count = sum(count_times) / len(count_times)

        print(f"  LIST:  {avg_list*1000:.1f}ms (avg of 3), rows={len(list_rows)}")
        print(f"  COUNT: {avg_count*1000:.1f}ms (avg of 3), total={count_result}")
        print(f"  TOTAL: {(avg_list+avg_count)*1000:.1f}ms")

        if explain:
            run_query(conn, list_q, list_p, label=f"LIST {name}", explain=True)
            run_query(conn, count_q, count_p, label=f"COUNT {name}", explain=True)

        # Сохраняем результат для сравнения
        results[name] = {
            "label": ts["label"],
            "list_time_ms": avg_list * 1000,
            "count_time_ms": avg_count * 1000,
            "total_time_ms": (avg_list + avg_count) * 1000,
            "count": count_result,
            "rows_returned": len(list_rows),
            "company_ids": [r["id"] for r in list_rows],
            "data": [dict(r) for r in list_rows],
        }

    conn.close()

    # Сохраняем в файл
    filename = f"benchmark_{mode}.json"
    # Конвертируем datetime для JSON
    for name, res in results.items():
        for row in res["data"]:
            for k, v in row.items():
                if hasattr(v, 'isoformat'):
                    row[k] = v.isoformat()

    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nРезультаты сохранены в {filename}")

    return results


# ============================================================
# ЭТАП 4: Сравнение результатов
# ============================================================

def compare_results():
    """Сравнивает baseline и optimized результаты."""
    try:
        with open("benchmark_baseline.json", 'r') as f:
            baseline = json.load(f)
        with open("benchmark_optimized.json", 'r') as f:
            optimized = json.load(f)
    except FileNotFoundError as e:
        print(f"ОШИБКА: файл не найден: {e}")
        print("Сначала запустите: --baseline и --optimized")
        return

    print("=" * 70)
    print("СРАВНЕНИЕ РЕЗУЛЬТАТОВ")
    print("=" * 70)

    all_ok = True

    for name in baseline:
        if name not in optimized:
            print(f"\n⚠ {name}: нет в optimized")
            continue

        b = baseline[name]
        o = optimized[name]

        print(f"\n--- {b['label']} ---")

        # 1. Сравнение company_id
        b_ids = b["company_ids"]
        o_ids = o["company_ids"]

        if b_ids == o_ids:
            print(f"  ✅ company_ids: ИДЕНТИЧНЫ ({len(b_ids)} шт)")
        else:
            all_ok = False
            b_set = set(b_ids)
            o_set = set(o_ids)
            missing = b_set - o_set
            extra = o_set - b_set
            print(f"  ❌ company_ids: ОТЛИЧАЮТСЯ!")
            print(f"     baseline: {len(b_ids)}, optimized: {len(o_ids)}")
            if missing:
                print(f"     Пропущены в optimized: {list(missing)[:10]}")
            if extra:
                print(f"     Лишние в optimized: {list(extra)[:10]}")

            # Сравнение порядка (если множества совпадают)
            if b_set == o_set and b_ids != o_ids:
                print(f"     Порядок отличается (множества совпадают)")

        # 2. Сравнение COUNT
        if b["count"] == o["count"]:
            print(f"  ✅ COUNT: ИДЕНТИЧЕН ({b['count']})")
        else:
            all_ok = False
            print(f"  ❌ COUNT: baseline={b['count']}, optimized={o['count']}")

        # 3. Сравнение данных (телефоны, email, категории, адреса)
        data_match = True
        for i, (br, opr) in enumerate(zip(b["data"], o["data"])):
            for field in ["phones", "emails", "address", "socials", "categories"]:
                bv = br.get(field, "")
                ov = opr.get(field, "")
                if bv != ov:
                    data_match = False
                    print(f"  ❌ Строка {i} (id={br['id']}), поле '{field}':")
                    print(f"     baseline:  {bv[:80]}")
                    print(f"     optimized: {ov[:80]}")
                    break
            if not data_match:
                break

        if data_match:
            print(f"  ✅ Данные: ИДЕНТИЧНЫ (phones, emails, address, socials, categories)")

        # 4. Сравнение производительности
        speedup_list = b["list_time_ms"] / o["list_time_ms"] if o["list_time_ms"] > 0 else 0
        speedup_count = b["count_time_ms"] / o["count_time_ms"] if o["count_time_ms"] > 0 else 0
        speedup_total = b["total_time_ms"] / o["total_time_ms"] if o["total_time_ms"] > 0 else 0

        print(f"  ⏱ LIST:  {b['list_time_ms']:.1f}ms → {o['list_time_ms']:.1f}ms ({speedup_list:.1f}x)")
        print(f"  ⏱ COUNT: {b['count_time_ms']:.1f}ms → {o['count_time_ms']:.1f}ms ({speedup_count:.1f}x)")
        print(f"  ⏱ TOTAL: {b['total_time_ms']:.1f}ms → {o['total_time_ms']:.1f}ms ({speedup_total:.1f}x)")

    print("\n" + "=" * 70)
    if all_ok:
        print("✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ: результаты идентичны")
    else:
        print("❌ ЕСТЬ РАСХОЖДЕНИЯ: см. выше")
    print("=" * 70)


# ============================================================
# EXPLAIN ANALYZE
# ============================================================

def run_explain():
    """Запускает EXPLAIN ANALYZE для ключевых запросов."""
    conn = get_conn()
    test_sets = prepare_test_sets(conn)

    # Берём coverage (самый тяжёлый)
    ts = test_sets.get("coverage", test_sets.get("precision"))

    print("=" * 70)
    print(f"EXPLAIN ANALYZE: {ts['label']}")
    print("=" * 70)

    cat_ids = ts["category_ids"]
    city_ids = ts["city_ids"]

    # Baseline LIST
    list_q, list_p, count_q, count_p = build_current_query(cat_ids, city_ids)
    print("\n" + "=" * 40)
    print("BASELINE LIST")
    print("=" * 40)
    run_query(conn, list_q, list_p, label="BASELINE LIST", explain=True)

    print("\n" + "=" * 40)
    print("BASELINE COUNT")
    print("=" * 40)
    run_query(conn, count_q, count_p, label="BASELINE COUNT", explain=True)

    # Optimized LIST
    list_q, list_p, count_q, count_p = build_optimized_query(cat_ids, city_ids)
    print("\n" + "=" * 40)
    print("OPTIMIZED LIST")
    print("=" * 40)
    run_query(conn, list_q, list_p, label="OPTIMIZED LIST", explain=True)

    print("\n" + "=" * 40)
    print("OPTIMIZED COUNT")
    print("=" * 40)
    run_query(conn, count_q, count_p, label="OPTIMIZED COUNT", explain=True)

    conn.close()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Бенчмарк SQL-запросов dbgis")
    parser.add_argument("--check", action="store_true", help="Проверить текущие данные")
    parser.add_argument("--baseline", action="store_true", help="Замеры текущих запросов")
    parser.add_argument("--optimized", action="store_true", help="Замеры оптимизированных запросов")
    parser.add_argument("--compare", action="store_true", help="Сравнение результатов")
    parser.add_argument("--explain", action="store_true", help="EXPLAIN ANALYZE")
    parser.add_argument("--all", action="store_true", help="Все этапы")

    args = parser.parse_args()

    if not any([args.check, args.baseline, args.optimized, args.compare, args.explain, args.all]):
        args.check = True  # По умолчанию — проверка данных

    if args.all or args.check:
        check_data()

    if args.all or args.baseline:
        run_benchmark("baseline")

    if args.all or args.optimized:
        run_benchmark("optimized")

    if args.all or args.compare:
        compare_results()

    if args.explain:
        run_explain()
