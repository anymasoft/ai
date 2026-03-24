#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Диагностический скрипт: проверяет, привязаны ли компании к category IDs из FAISS mapping.

Запуск:
  cd dbgis-backend
  python debug_category_ids.py

Ожидаемый результат (если баг подтверждён):
  - "Автосервис" (27 IDs) → 0 компаний ← БАГ
  - "Легковой автосервис" (226 IDs) → >0 компаний ← ОК
  - ILIKE '%Автосервис%' → >0 компаний ← ОК (fallback работает)
"""

import json
import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "dbname": os.getenv("DB_NAME", "dbgis"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
}


def main():
    # Загружаем FAISS mapping
    with open("category_mapping_e5.json", "r", encoding="utf-8") as f:
        mapping = json.load(f)

    # Находим категории с "автосервис" в имени
    auto_categories = []
    for k, v in mapping.items():
        if "автосервис" in v["name"].lower():
            auto_categories.append(v)

    conn = psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)
    cur = conn.cursor()

    print("=" * 70)
    print("ДИАГНОСТИКА: Привязка компаний к category IDs из FAISS mapping")
    print("=" * 70)

    # ТЕСТ 1: Проверяем каждую «автосервис» категорию
    print("\n--- ТЕСТ 1: Компании по category_ids для каждой категории ---")
    for cat in auto_categories:
        ids = cat["ids"]
        cur.execute(
            "SELECT COUNT(DISTINCT cc.company_id) as cnt "
            "FROM company_categories cc "
            "WHERE cc.category_id = ANY(%s)",
            (ids,)
        )
        cnt = cur.fetchone()["cnt"]
        status = "✓ OK" if cnt > 0 else "✗ БАГ — 0 компаний!"
        print(f"  {cat['name']:40s} {len(ids):4d} IDs → {cnt:6d} компаний  {status}")

    # ТЕСТ 2: depth=1 (только "Автосервис")
    print("\n--- ТЕСТ 2: Симуляция depth=1 (cc.category_id = ANY(ids)) ---")
    main_cat = next(c for c in auto_categories if c["name"] == "Автосервис")
    cur.execute(
        "SELECT COUNT(DISTINCT c.id) as cnt "
        "FROM companies c "
        "JOIN company_categories cc ON c.id = cc.company_id "
        "WHERE cc.category_id = ANY(%s)",
        (main_cat["ids"],)
    )
    cnt_depth1 = cur.fetchone()["cnt"]
    print(f"  depth=1 IDs ({len(main_cat['ids'])} шт) → {cnt_depth1} компаний")

    # ТЕСТ 3: depth=3 (3 категории)
    print("\n--- ТЕСТ 3: Симуляция depth=3 (3 категории) ---")
    # Берём 3 самые релевантные (как FAISS бы вернул)
    top3_names = ["Автосервис", "Легковой автосервис", "Выездной автосервис"]
    all_ids = set()
    for cat in auto_categories:
        if cat["name"] in top3_names:
            all_ids.update(cat["ids"])
    cur.execute(
        "SELECT COUNT(DISTINCT c.id) as cnt "
        "FROM companies c "
        "JOIN company_categories cc ON c.id = cc.company_id "
        "WHERE cc.category_id = ANY(%s)",
        (list(all_ids),)
    )
    cnt_depth3 = cur.fetchone()["cnt"]
    print(f"  depth=3 IDs ({len(all_ids)} шт) → {cnt_depth3} компаний")

    # ТЕСТ 4: ILIKE fallback
    print("\n--- ТЕСТ 4: ILIKE fallback (как сейчас работает) ---")
    cur.execute(
        "SELECT COUNT(DISTINCT c.id) as cnt "
        "FROM companies c "
        "JOIN company_categories cc ON c.id = cc.company_id "
        "JOIN categories cat ON cc.category_id = cat.id "
        "WHERE cat.name ILIKE %s",
        ("%Автосервис%",)
    )
    cnt_ilike = cur.fetchone()["cnt"]
    print(f"  cat.name ILIKE '%%Автосервис%%' → {cnt_ilike} компаний")

    # ТЕСТ 5: Проверяем, существуют ли эти IDs в таблице categories
    print("\n--- ТЕСТ 5: Существуют ли depth=1 IDs в таблице categories? ---")
    cur.execute(
        "SELECT id, name FROM categories WHERE id = ANY(%s) ORDER BY id",
        (main_cat["ids"][:10],)
    )
    rows = cur.fetchall()
    print(f"  Найдено {len(rows)} из {min(10, len(main_cat['ids']))} запрошенных:")
    for r in rows:
        print(f"    id={r['id']}, name='{r['name']}'")

    # ТЕСТ 6: Есть ли записи в company_categories для этих IDs?
    print("\n--- ТЕСТ 6: Записи в company_categories для depth=1 IDs ---")
    cur.execute(
        "SELECT cc.category_id, COUNT(*) as cnt "
        "FROM company_categories cc "
        "WHERE cc.category_id = ANY(%s) "
        "GROUP BY cc.category_id ORDER BY cnt DESC LIMIT 10",
        (main_cat["ids"],)
    )
    rows = cur.fetchall()
    if rows:
        print(f"  Найдены записи для {len(rows)} category_ids:")
        for r in rows:
            print(f"    category_id={r['category_id']} → {r['cnt']} компаний")
    else:
        print("  ✗ НЕТ ЗАПИСЕЙ — подтверждение бага!")
        print("    Компании НЕ привязаны к обобщённым category IDs.")
        print("    Они привязаны к конкретным подкатегориям.")

    # ИТОГ
    print("\n" + "=" * 70)
    print("ИТОГ:")
    if cnt_depth1 == 0 and cnt_depth3 > 0:
        print("  ✗ БАГ ПОДТВЕРЖДЁН")
        print(f"    depth=1: {cnt_depth1} компаний (обобщённая категория)")
        print(f"    depth=3: {cnt_depth3} компаний (включает подкатегории)")
        print(f"    ILIKE:   {cnt_ilike} компаний (все совпадения по имени)")
        print()
        print("  ПРИЧИНА: Компании привязаны к КОНКРЕТНЫМ подкатегориям,")
        print("  а не к обобщённым. depth=1 выбирает только обобщённую.")
    elif cnt_depth1 > 0:
        print("  Баг НЕ подтверждён — depth=1 IDs дают результаты.")
        print("  Проблема в другом месте (проверить psycopg2 типы).")
    print("=" * 70)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
