# -*- coding: utf-8 -*-
"""
faiss_service.py — Семантический поиск категорий через FAISS + E5 embeddings.

Заменяет LLM-логику выбора категорий.
Модель и индекс загружаются ОДИН РАЗ при импорте модуля.
Latency: < 50 мс на запрос.

Формат mapping:
  {"0": {"name": "Кафе", "ids": [127, 4821, 9932]}, ...}

find_category() возвращает:
  {"name": "Кафе", "ids": [127, 4821, 9932]}
"""

import json
import logging
from pathlib import Path

from sentence_transformers import SentenceTransformer
import faiss

log = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
INDEX_FILE = SCRIPT_DIR / "categories_faiss_e5.index"
MAPPING_FILE = SCRIPT_DIR / "category_mapping_e5.json"

MODEL_NAME = "intfloat/multilingual-e5-base"

# Загружаем ОДИН РАЗ при импорте модуля
log.info("[FAISS] Загрузка модели %s ...", MODEL_NAME)
model = SentenceTransformer(MODEL_NAME)
index = faiss.read_index(str(INDEX_FILE))

with open(MAPPING_FILE, "r", encoding="utf-8") as f:
    mapping = json.load(f)

log.info("[FAISS] Модель и индекс загружены (%d категорий)", len(mapping))


def normalize_query(q: str) -> str:
    """Нормализация частых пользовательских запросов в бизнес-термины."""
    q = q.lower().strip()
    if "поесть" in q or "еда" in q:
        return "ресторан кафе"
    if "переночевать" in q:
        return "гостиница отель"
    if "распечатать" in q:
        return "печать копицентр"
    return q


def pick_best(query: str, candidates: list[dict]) -> dict:
    """Из top-5 кандидатов выбирает лучшего: приоритет — точное вхождение имени в запрос."""
    q = query.lower()
    for c in candidates:
        if c["name"].lower() in q:
            return c
    return candidates[0]


def find_category(query: str) -> dict:
    """Находит наиболее подходящую категорию для запроса через FAISS.

    Returns:
        {"name": str, "ids": list[int]}
    """
    normalized = normalize_query(query)
    # E5 требует префикс "query:" для запросов
    query_text = f"query: {normalized}"
    emb = model.encode([query_text], normalize_embeddings=True)

    # TOP-5 кандидатов
    D, I = index.search(emb, 5)

    candidates = [mapping[str(i)] for i in I[0]]
    best = pick_best(normalized, candidates)

    log.info("[FAISS] '%s' → '%s' (ids=%s), top-5: %s",
             query, best["name"], best["ids"],
             [c["name"] for c in candidates])

    return best
