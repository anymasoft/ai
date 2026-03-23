# -*- coding: utf-8 -*-
"""
ai_parser.py — Простой парсер запросов (извлечение города и фильтров контактов).

LLM-логика категоризации УДАЛЕНА — заменена на FAISS (faiss_service.py).
"""

import logging
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def parse_query_fallback(query: str) -> Dict[str, Optional[str]]:
    """Простой парсер: извлекает город и фильтры контактов из запроса."""
    filters = {
        "category": None,
        "city": None,
        "has_phone": False,
        "has_website": False,
        "has_email": False
    }

    lower = query.lower()

    if " в " in lower:
        parts = lower.split(" в ")
        filters["category"] = parts[0].strip()
        city_raw = parts[1].split(" с ")[0].strip()
        # Обрезаем окончание падежа (москве→моск, казани→казан, краснодаре→краснодар)
        if len(city_raw) > 3:
            filters["city"] = city_raw[:-2]
        elif len(city_raw) > 1:
            filters["city"] = city_raw[:-1]
        else:
            filters["city"] = city_raw
    elif " с " in lower:
        filters["category"] = lower.split(" с ")[0].strip()
    else:
        filters["category"] = query.strip()

    if "телефон" in lower:
        filters["has_phone"] = True
    if "сайт" in lower:
        filters["has_website"] = True
    if "email" in lower or "почта" in lower:
        filters["has_email"] = True

    return filters
