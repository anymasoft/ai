#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Диагностика поиска: FAISS → category_ids → PostgreSQL → companies.

Цель: определить, где именно появляются нерелевантные результаты.

Запуск:
    python debug_search.py
    python debug_search.py "автосервисы с сайтом в ижевске"
    python debug_search.py "кафе в москве" --company-id 12345
"""

import os
import sys
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

# ============================================================
# КОНФИГУРАЦИЯ
# ============================================================

DEFAULT_QUERY = "автосервисы с сайтом в ижевске"
DEBUG_COMPANY_ID = None  # Вставить ID для проверки конкретной компании

# ============================================================
# ПОДКЛЮЧЕНИЯ
# ============================================================

def get_pg():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
        cursor_factory=psycopg2.extras.DictCursor
    )
    return conn


def header(title):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def subheader(title):
    print(f"\n--- {title} ---")

# ============================================================
# ШАГ 1: FAISS
# ============================================================

def step1_faiss(query):
    header("ШАГ 1: FAISS — семантический поиск категорий")
    print(f"  Запрос: \"{query}\"")

    try:
        from faiss_service import find_top_categories
    except ImportError as e:
        print(f"  ОШИБКА: не удалось импортировать faiss_service: {e}")
        print("  Убедитесь, что запускаете из директории dbgis-backend/")
        return None, None

    top_categories = find_top_categories(query, k=3)

    all_ids = set()
    print(f"\n  Найдено категорий: {len(top_categories)}")
    for i, cat in enumerate(top_categories):
        cat_ids = cat["ids"]
        all_ids.update(cat_ids)
        print(f"  [{i+1}] \"{cat['name']}\" → {len(cat_ids)} ids")
        print(f"      первые 20: {cat_ids[:20]}")

    faiss_ids = list(all_ids)
    print(f"\n  Всего уникальных ids: {len(faiss_ids)}")
    print(f"  Первые 30: {faiss_ids[:30]}")

    return top_categories, faiss_ids

# ============================================================
# ШАГ 2: ПРОВЕРКА IDS В POSTGRES
# ============================================================

def step2_check_ids(pg_cur, faiss_ids):
    header("ШАГ 2: ПРОВЕРКА — что за категории по этим ids в PostgreSQL")

    if not faiss_ids:
        print("  Нет ids для проверки")
        return

    pg_cur.execute("""
        SELECT id, name, parent_id
        FROM categories
        WHERE id = ANY(%s)
        ORDER BY name
    """, (faiss_ids,))
    rows = pg_cur.fetchall()

    print(f"  Найдено категорий в БД: {len(rows)} (из {len(faiss_ids)} ids)")

    if len(rows) != len(faiss_ids):
        missing = set(faiss_ids) - {r["id"] for r in rows}
        if missing:
            print(f"  ВНИМАНИЕ: {len(missing)} ids НЕ найдены в БД: {list(missing)[:20]}")

    subheader("Категории по ids")
    for r in rows:
        parent = f" (parent_id={r['parent_id']})" if r["parent_id"] else " (корневая)"
        print(f"    id={r['id']:>6} → \"{r['name']}\"{parent}")

# ============================================================
# ШАГ 3: КОМПАНИИ ПО ЭТИМ IDS
# ============================================================

def step3_companies(pg_cur, faiss_ids):
    header("ШАГ 3: КОМПАНИИ — что возвращает SQL по этим category_ids")

    if not faiss_ids:
        print("  Нет ids для запроса")
        return []

    pg_cur.execute("""
        SELECT c.id, c.name, c.city
        FROM companies c
        JOIN company_categories cc ON c.id = cc.company_id
        WHERE cc.category_id = ANY(%s)
        GROUP BY c.id, c.name, c.city
        ORDER BY c.name
        LIMIT 50
    """, (faiss_ids,))
    rows = pg_cur.fetchall()

    # Общее количество
    pg_cur.execute("""
        SELECT COUNT(DISTINCT c.id) as total
        FROM companies c
        JOIN company_categories cc ON c.id = cc.company_id
        WHERE cc.category_id = ANY(%s)
    """, (faiss_ids,))
    total = pg_cur.fetchone()["total"]

    print(f"  Всего компаний: {total}")
    print(f"  Показаны первые {len(rows)}:")

    subheader("Выборка компаний")
    company_ids = []
    for r in rows:
        city = r["city"] or "—"
        print(f"    id={r['id']:>8}  [{city:>15}]  {r['name']}")
        company_ids.append(r["id"])

    return company_ids

# ============================================================
# ШАГ 4: РЕАЛЬНЫЕ КАТЕГОРИИ ЭТИХ КОМПАНИЙ
# ============================================================

def step4_real_categories(pg_cur, company_ids, faiss_ids):
    header("ШАГ 4: РЕАЛЬНЫЕ КАТЕГОРИИ — проверка каждой компании")

    if not company_ids:
        print("  Нет компаний для проверки")
        return

    pg_cur.execute("""
        SELECT c.id as company_id, c.name as company_name,
               cat.id as cat_id, cat.name as cat_name
        FROM companies c
        JOIN company_categories cc ON c.id = cc.company_id
        JOIN categories cat ON cc.category_id = cat.id
        WHERE c.id = ANY(%s)
        ORDER BY c.name, cat.name
    """, (company_ids,))
    rows = pg_cur.fetchall()

    faiss_set = set(faiss_ids) if faiss_ids else set()

    # Группируем по компании
    companies = {}
    for r in rows:
        cid = r["company_id"]
        if cid not in companies:
            companies[cid] = {"name": r["company_name"], "categories": []}
        in_faiss = "✓" if r["cat_id"] in faiss_set else "✗"
        companies[cid]["categories"].append(
            f"{r['cat_name']} (id={r['cat_id']}) [{in_faiss}]"
        )

    suspicious = 0
    for cid, info in companies.items():
        has_match = any("✓" in c for c in info["categories"])
        marker = "" if has_match else " ⚠ ПОДОЗРИТЕЛЬНАЯ"
        if not has_match:
            suspicious += 1
        print(f"\n  {info['name']} (id={cid}){marker}")
        for cat in info["categories"]:
            print(f"    → {cat}")

    subheader("ИТОГ ШАГА 4")
    print(f"  Компаний проверено: {len(companies)}")
    print(f"  С совпадением FAISS ids: {len(companies) - suspicious}")
    print(f"  БЕЗ совпадения (подозрительные): {suspicious}")
    if suspicious > 0:
        print("  ⚠ Подозрительные компании попали в результат через category_id,")
        print("    которого нет в FAISS ids — возможно, лишние ids в маппинге.")

# ============================================================
# ШАГ 5: ПРОВЕРКА КОНКРЕТНОЙ КОМПАНИИ
# ============================================================

def step5_debug_company(pg_cur, company_id):
    header(f"ШАГ 5: ДЕТАЛЬНАЯ ПРОВЕРКА КОМПАНИИ id={company_id}")

    pg_cur.execute("SELECT id, name, city, domain FROM companies WHERE id = %s", (company_id,))
    company = pg_cur.fetchone()

    if not company:
        print(f"  Компания id={company_id} НЕ найдена в БД")
        return

    print(f"  Название: {company['name']}")
    print(f"  Город: {company['city'] or '—'}")
    print(f"  Домен: {company['domain'] or '—'}")

    pg_cur.execute("""
        SELECT cat.id, cat.name, cat.parent_id,
               pcat.name as parent_name
        FROM company_categories cc
        JOIN categories cat ON cc.category_id = cat.id
        LEFT JOIN categories pcat ON cat.parent_id = pcat.id
        WHERE cc.company_id = %s
        ORDER BY cat.name
    """, (company_id,))
    cats = pg_cur.fetchall()

    subheader(f"Все категории компании ({len(cats)} шт.)")
    for c in cats:
        parent = f" ← {c['parent_name']}" if c["parent_name"] else ""
        print(f"    id={c['id']:>6}  \"{c['name']}\"{parent}")

# ============================================================
# MAIN
# ============================================================

def main():
    query = DEFAULT_QUERY
    company_id = DEBUG_COMPANY_ID

    # Аргументы командной строки
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--company-id" and i + 1 < len(args):
            company_id = int(args[i + 1])
        elif not arg.startswith("--"):
            query = arg

    print("╔══════════════════════════════════════════════════════════╗")
    print("║         ДИАГНОСТИКА ПОИСКА: FAISS → SQL → COMPANIES    ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"  Запрос: \"{query}\"")
    if company_id:
        print(f"  Debug company_id: {company_id}")

    # ШАГ 1: FAISS
    top_categories, faiss_ids = step1_faiss(query)

    if not faiss_ids:
        print("\n  FAISS не вернул результатов. Диагностика остановлена.")
        return

    # ШАГ 2-5: PostgreSQL
    conn = get_pg()
    try:
        cur = conn.cursor()

        step2_check_ids(cur, faiss_ids)
        company_ids = step3_companies(cur, faiss_ids)
        step4_real_categories(cur, company_ids, faiss_ids)

        if company_id:
            step5_debug_company(cur, company_id)

        cur.close()
    finally:
        conn.close()

    # ФИНАЛЬНЫЙ ВЕРДИКТ
    header("ВЕРДИКТ")
    print("  Проверьте вывод выше:")
    print("  1. FAISS ids соответствуют категориям? → ШАГ 2")
    print("  2. SQL возвращает лишние компании?     → ШАГ 3")
    print("  3. Компании реально имеют категории?   → ШАГ 4 (✓/✗)")
    print()


if __name__ == "__main__":
    main()
