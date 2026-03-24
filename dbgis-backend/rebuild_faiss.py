#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rebuild_faiss.py — Пересборка FAISS индекса из PostgreSQL.

Шаги:
  0. Настройка логирования
  1. Очистка старых артефактов (index + mapping)
  2. Загрузка категорий из PostgreSQL
  3. Построение эмбеддингов (intfloat/multilingual-e5-base)
  4. Построение FAISS IndexFlatIP
  5. Сохранение index + mapping
  6. Быстрая проверка (top-3 для "автосервис")

Запуск:
    python rebuild_faiss.py
    python rebuild_faiss.py --test-query "кафе"
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import psycopg2
import psycopg2.extras
import faiss
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# ============================================================
# КОНФИГУРАЦИЯ
# ============================================================

load_dotenv()

SCRIPT_DIR = Path(__file__).parent
INDEX_FILE = SCRIPT_DIR / "categories_faiss_e5.index"
MAPPING_FILE = SCRIPT_DIR / "category_mapping_e5.json"
CATEGORIES_JSON = SCRIPT_DIR / "categories.json"  # НЕ удалять

MODEL_NAME = "intfloat/multilingual-e5-base"
MIN_CATEGORIES_WARNING = 100
DEFAULT_TEST_QUERY = "автосервис"

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

# ============================================================
# ШАГ 0: ЛОГИРОВАНИЕ
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("rebuild_faiss")

# ============================================================
# УТИЛИТЫ
# ============================================================

def get_pg():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
        cursor_factory=psycopg2.extras.DictCursor
    )


def safe_delete(path: Path):
    """Удаляет файл если существует, логирует результат."""
    if path.exists():
        size = path.stat().st_size
        path.unlink()
        log.info("Удалён: %s (%s KB)", path.name, f"{size / 1024:.1f}")
    else:
        log.info("Пропуск (не найден): %s", path.name)


def format_size(path: Path) -> str:
    if path.exists():
        size = path.stat().st_size
        if size > 1024 * 1024:
            return f"{size / 1024 / 1024:.1f} MB"
        return f"{size / 1024:.1f} KB"
    return "—"

# ============================================================
# ШАГ 1: ОЧИСТКА
# ============================================================

def step1_cleanup():
    log.info("=" * 60)
    log.info("ШАГ 1: ОЧИСТКА СТАРЫХ АРТЕФАКТОВ")
    log.info("=" * 60)

    safe_delete(INDEX_FILE)
    safe_delete(MAPPING_FILE)

    # categories.json НЕ трогаем
    if CATEGORIES_JSON.exists():
        log.info("categories.json — оставлен (исходные данные)")
    else:
        log.info("categories.json — не найден (не критично, строим из PostgreSQL)")

# ============================================================
# ШАГ 2: ЗАГРУЗКА ДАННЫХ ИЗ POSTGRESQL
# ============================================================

def step2_load_categories():
    log.info("=" * 60)
    log.info("ШАГ 2: ЗАГРУЗКА КАТЕГОРИЙ ИЗ POSTGRESQL")
    log.info("=" * 60)

    conn = get_pg()
    try:
        cur = conn.cursor()

        # Уникальные имена категорий + массив category_id для каждой
        # ВАЖНО: ids = category_id (НЕ company_id!)
        # SQL в main.py использует: WHERE cc.category_id = ANY(%s)
        cur.execute("""
            SELECT cat.name, ARRAY_AGG(DISTINCT cat.id ORDER BY cat.id) as category_ids
            FROM categories cat
            GROUP BY cat.name
            ORDER BY cat.name
        """)
        rows = cur.fetchall()

        categories = []
        for r in rows:
            categories.append({
                "name": r["name"],
                "ids": r["category_ids"]
            })

        cur.close()
    finally:
        conn.close()

    log.info("Загружено категорий: %d", len(categories))

    if len(categories) < MIN_CATEGORIES_WARNING:
        log.warning("⚠ Категорий меньше %d — возможно база неполная!", MIN_CATEGORIES_WARNING)

    # Показать первые 10
    log.info("Первые 10 категорий:")
    for i, cat in enumerate(categories[:10]):
        log.info("  [%d] \"%s\" → %d компаний", i, cat["name"], len(cat["ids"]))

    total_links = sum(len(c["ids"]) for c in categories)
    log.info("Всего связей категория→компания: %d", total_links)

    return categories

# ============================================================
# ШАГ 3: ПОСТРОЕНИЕ ЭМБЕДДИНГОВ
# ============================================================

def step3_build_embeddings(categories):
    log.info("=" * 60)
    log.info("ШАГ 3: ПОСТРОЕНИЕ ЭМБЕДДИНГОВ")
    log.info("=" * 60)
    log.info("Модель: %s", MODEL_NAME)
    log.info("Категорий для кодирования: %d", len(categories))

    t0 = time.time()
    log.info("Загрузка модели...")
    model = SentenceTransformer(MODEL_NAME)
    log.info("Модель загружена за %.1f сек", time.time() - t0)

    # E5 требует префикс "passage:" для документов
    passages = [f"passage: {cat['name']}" for cat in categories]

    t0 = time.time()
    log.info("Кодирование %d категорий...", len(passages))
    embeddings = model.encode(passages, normalize_embeddings=True, show_progress_bar=True)
    embeddings = np.array(embeddings).astype("float32")
    elapsed = time.time() - t0

    log.info("Эмбеддинги готовы: shape=%s, время=%.1f сек", embeddings.shape, elapsed)

    return model, embeddings

# ============================================================
# ШАГ 4: ПОСТРОЕНИЕ FAISS ИНДЕКСА
# ============================================================

def step4_build_index(embeddings):
    log.info("=" * 60)
    log.info("ШАГ 4: ПОСТРОЕНИЕ FAISS ИНДЕКСА")
    log.info("=" * 60)

    dim = embeddings.shape[1]
    log.info("Размерность: %d", dim)
    log.info("Тип индекса: IndexFlatIP (Inner Product / cosine similarity)")

    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    log.info("Индекс построен: %d векторов", index.ntotal)
    return index

# ============================================================
# ШАГ 5: СОХРАНЕНИЕ
# ============================================================

def step5_save(index, categories):
    log.info("=" * 60)
    log.info("ШАГ 5: СОХРАНЕНИЕ")
    log.info("=" * 60)

    # FAISS индекс
    faiss.write_index(index, str(INDEX_FILE))
    log.info("Индекс сохранён: %s (%s)", INDEX_FILE.name, format_size(INDEX_FILE))

    # Mapping: faiss_position → {"name": ..., "ids": [...]}
    mapping = {
        str(i): {"name": cat["name"], "ids": cat["ids"]}
        for i, cat in enumerate(categories)
    }
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    log.info("Mapping сохранён: %s (%s)", MAPPING_FILE.name, format_size(MAPPING_FILE))

    return mapping

# ============================================================
# ШАГ 6: ПРОВЕРКА
# ============================================================

def step6_verify(model, index, mapping, test_query):
    log.info("=" * 60)
    log.info("ШАГ 6: БЫСТРАЯ ПРОВЕРКА")
    log.info("=" * 60)
    log.info("Тестовый запрос: \"%s\"", test_query)

    query_text = f"query: {test_query}"
    emb = model.encode([query_text], normalize_embeddings=True)

    D, I = index.search(emb, 5)

    log.info("Top-5 результатов FAISS:")
    top_category_ids = []
    for rank, (idx, score) in enumerate(zip(I[0], D[0])):
        cat = mapping[str(idx)]
        log.info("  [%d] score=%.4f  \"%s\"  (category_ids: %s)",
                 rank + 1, score, cat["name"], cat["ids"])
        top_category_ids.extend(cat["ids"])

    # Проверка через PostgreSQL: category_ids → компании
    if top_category_ids:
        log.info("")
        log.info("Проверка category_ids через PostgreSQL:")
        conn = get_pg()
        try:
            cur = conn.cursor()

            # Сколько компаний найдётся по этим category_ids
            cur.execute("""
                SELECT COUNT(DISTINCT cc.company_id) as cnt
                FROM company_categories cc
                WHERE cc.category_id = ANY(%s)
            """, (top_category_ids,))
            cnt = cur.fetchone()["cnt"]
            log.info("  Компаний по category_ids %s: %d", top_category_ids, cnt)

            # Показать первые 10 компаний
            cur.execute("""
                SELECT c.id, c.name,
                       STRING_AGG(DISTINCT cat.name, ', ' ORDER BY cat.name) as categories
                FROM companies c
                JOIN company_categories cc ON c.id = cc.company_id
                JOIN categories cat ON cc.category_id = cat.id
                WHERE cc.category_id = ANY(%s)
                GROUP BY c.id, c.name
                ORDER BY c.name
                LIMIT 10
            """, (top_category_ids,))
            rows = cur.fetchall()

            for r in rows:
                log.info("  id=%d  \"%s\"  → [%s]", r["id"], r["name"], r["categories"])

            cur.close()
        finally:
            conn.close()

    log.info("")
    log.info("Проверка завершена.")

# ============================================================
# MAIN
# ============================================================

def main():
    test_query = DEFAULT_TEST_QUERY

    # Аргументы командной строки
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--test-query" and i + 1 < len(args):
            test_query = args[i + 1]

    log.info("╔══════════════════════════════════════════════════════════╗")
    log.info("║          REBUILD FAISS INDEX FROM POSTGRESQL            ║")
    log.info("╚══════════════════════════════════════════════════════════╝")
    log.info("Время: %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log.info("PostgreSQL: %s:%d/%s", DB_HOST, DB_PORT, DB_NAME)
    log.info("Модель: %s", MODEL_NAME)
    log.info("Выходные файлы: %s, %s", INDEX_FILE.name, MAPPING_FILE.name)

    t_total = time.time()

    # ШАГ 1
    step1_cleanup()

    # ШАГ 2
    categories = step2_load_categories()
    if not categories:
        log.error("Нет категорий в БД. Невозможно построить индекс.")
        sys.exit(1)

    # ШАГ 3
    model, embeddings = step3_build_embeddings(categories)

    # ШАГ 4
    index = step4_build_index(embeddings)

    # ШАГ 5
    mapping = step5_save(index, categories)

    # ШАГ 6
    step6_verify(model, index, mapping, test_query)

    # ИТОГ
    elapsed = time.time() - t_total
    log.info("=" * 60)
    log.info("ГОТОВО")
    log.info("  Категорий: %d", len(categories))
    log.info("  Индекс: %s (%s)", INDEX_FILE.name, format_size(INDEX_FILE))
    log.info("  Mapping: %s (%s)", MAPPING_FILE.name, format_size(MAPPING_FILE))
    log.info("  Общее время: %.1f сек", elapsed)
    log.info("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log.error("Ошибка: %s", e, exc_info=True)
        sys.exit(1)
