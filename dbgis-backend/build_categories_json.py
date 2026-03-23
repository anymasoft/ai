#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_categories_json.py — Формирование categories.json из categories_raw.txt

Входной файл: categories_raw.txt
Формат строк: id|name (UTF-8, без заголовка)

Выходной файл: categories.json
Формат:
[
  {"name": "Кафе", "ids": [127, 4821, 9932]},
  {"name": "Автосервис", "ids": [6, 77]}
]

Группирует записи по name, собирает ВСЕ id в массив.
Это нужно, чтобы FAISS искал по уникальному name,
а SQL мог фильтровать по ВСЕМ связанным category_id.

Экспорт из SQLite:
  sqlite3 ../dgdat2xlsx/data/local.db "SELECT id || '|' || name FROM categories;" > categories_raw.txt
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
RAW_FILE = SCRIPT_DIR / "categories_raw.txt"
OUTPUT_FILE = SCRIPT_DIR / "categories.json"


def build():
    if not RAW_FILE.exists():
        print(f"[!] Файл не найден: {RAW_FILE}")
        print(f"    Экспортируй из SQLite:")
        print(f'    sqlite3 ../dgdat2xlsx/data/local.db "SELECT id || \'|\' || name FROM categories;" > categories_raw.txt')
        sys.exit(1)

    # Группируем id по name
    groups = defaultdict(set)
    total_lines = 0
    errors = 0

    with open(RAW_FILE, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            total_lines += 1

            parts = line.split("|", 1)
            if len(parts) != 2:
                print(f"  [!] Строка {line_num}: неверный формат: {line!r}")
                errors += 1
                continue

            raw_id, name = parts
            name = name.strip()
            if not name:
                print(f"  [!] Строка {line_num}: пустое имя для id={raw_id}")
                errors += 1
                continue

            try:
                cat_id = int(raw_id.strip())
            except ValueError:
                print(f"  [!] Строка {line_num}: невалидный id: {raw_id!r}")
                errors += 1
                continue

            groups[name].add(cat_id)

    # Формируем JSON
    categories = []
    for name in sorted(groups.keys()):
        categories.append({
            "name": name,
            "ids": sorted(groups[name])
        })

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(categories, f, ensure_ascii=False, indent=2)

    # Статистика
    print(f"[✓] categories.json сформирован")
    print(f"    Исходных строк:        {total_lines}")
    print(f"    Ошибок:                {errors}")
    print(f"    Уникальных категорий:  {len(categories)}")

    # Топ дублей
    multi = [(name, len(ids)) for name, ids in groups.items() if len(ids) > 1]
    multi.sort(key=lambda x: -x[1])
    if multi:
        print(f"    Категорий с >1 id:     {len(multi)}")
        print(f"    Топ-10 дублей:")
        for name, cnt in multi[:10]:
            print(f"      {name}: {cnt} id")

    return categories


if __name__ == "__main__":
    build()
