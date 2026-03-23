#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_categories.py — Экспорт категорий из SQLite в categories_raw.txt

Запуск:
  python export_categories.py
"""

import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SQLITE_PATH = SCRIPT_DIR / "../dgdat2xlsx/data/local.db"
OUTPUT_FILE = SCRIPT_DIR / "categories_raw.txt"


def export():
    if not SQLITE_PATH.exists():
        print(f"[!] Файл не найден: {SQLITE_PATH}")
        print(f"    Убедитесь, что путь корректен")
        sys.exit(1)

    try:
        conn = sqlite3.connect(str(SQLITE_PATH))
        cur = conn.cursor()

        cur.execute("SELECT id, name FROM categories ORDER BY id")
        rows = cur.fetchall()

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            for row_id, name in rows:
                f.write(f"{row_id}|{name}\n")

        cur.close()
        conn.close()

        print(f"[✓] Экспортировано {len(rows)} записей в {OUTPUT_FILE}")

    except Exception as e:
        print(f"[!] Ошибка: {e}")
        sys.exit(1)


if __name__ == "__main__":
    export()
