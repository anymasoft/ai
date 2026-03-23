#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2gis_categories_faiss_e5.py — Построение FAISS-индекса по categories.json (E5 model)

Модель: intfloat/multilingual-e5-base

Формат categories.json:
[
  {"name": "Кафе", "ids": [127, 4821, 9932]},
  {"name": "Автосервис", "ids": [6, 77]}
]

Формат category_mapping_e5.json (выходной):
{
  "0": {"name": "Кафе", "ids": [127, 4821, 9932]},
  "1": {"name": "Автосервис", "ids": [6, 77]}
}
"""

import json
import sys
import time
from pathlib import Path
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

SCRIPT_DIR = Path(__file__).parent
CATEGORIES_JSON = SCRIPT_DIR / "categories.json"
INDEX_FILE = SCRIPT_DIR / "categories_faiss_e5.index"
MAPPING_FILE = SCRIPT_DIR / "category_mapping_e5.json"

MODEL_NAME = "intfloat/multilingual-e5-base"

def load_categories():
    if not CATEGORIES_JSON.exists():
        print("[!] categories.json не найден рядом со скриптом!")
        sys.exit(1)

    with open(CATEGORIES_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"[✓] Загружено {len(data)} категорий")
    return data

def build_index():
    categories = load_categories()
    print("[*] Строим индекс с моделью multilingual-e5-base...")

    model = SentenceTransformer(MODEL_NAME)

    # КРИТИЧНО: E5 требует префиксы!
    passages = [f"passage: {cat['name']}" for cat in categories]

    embeddings = model.encode(passages, normalize_embeddings=True, show_progress_bar=True)
    embeddings = np.array(embeddings).astype("float32")

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    faiss.write_index(index, str(INDEX_FILE))

    # Mapping: индекс FAISS → {"name": ..., "ids": [...]}
    mapping = {
        str(i): {"name": cat["name"], "ids": cat["ids"]}
        for i, cat in enumerate(categories)
    }
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"[✓] Индекс E5 готов ({len(categories)} категорий)")
    return model, index, mapping

def query_to_category(query: str):
    if not INDEX_FILE.exists():
        model, index, mapping = build_index()
    else:
        model = SentenceTransformer(MODEL_NAME)
        index = faiss.read_index(str(INDEX_FILE))
        with open(MAPPING_FILE, "r", encoding="utf-8") as f:
            mapping = json.load(f)

    # Префикс для запроса
    query_text = f"query: {query}"
    emb = model.encode([query_text], normalize_embeddings=True)

    _, I = index.search(emb, 1)
    best_idx = str(I[0][0])
    cat = mapping[best_idx]

    return {
        "category_name": cat["name"],
        "category_ids":  cat["ids"]
    }

def main():
    print("=" * 70)
    print("2GIS CATEGORIES → E5 SEMANTIC SEARCH")
    print("=" * 70)

    if not INDEX_FILE.exists():
        print("[*] Первый запуск — строим индекс (20–40 секунд)...")
        build_index()

    while True:
        q = input("\nЗапрос → ").strip()
        if q.lower() in ("exit", "quit", ""):
            break

        start = time.time()
        res = query_to_category(q)
        elapsed = (time.time() - start) * 1000

        print(f"\n✅ Лучшая категория:")
        print(f"   {res['category_name']}")
        print(f"   IDs: {res['category_ids']}")
        print(f"   Время: {elapsed:.1f} мс")

if __name__ == "__main__":
    main()
