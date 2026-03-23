# -*- coding: utf-8 -*-
"""
ai_parser.py — Простой парсер запросов (извлечение города и фильтров контактов).

LLM-логика категоризации УДАЛЕНА — заменена на FAISS (faiss_service.py).
"""

import logging
import re
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def normalize_city(city: str) -> str:
    """Убирает окончания русских падежей, чтобы ILIKE '%москв%' совпал с 'Москва'.

    москве → москв, петербурге → петербург, новосибирске → новосибирск,
    казани → казан, перми → перм, твери → твер
    """
    city = city.strip()
    if not city:
        return city
    # Убираем типичные падежные окончания (предложный, дательный)
    # -е (москве, петербурге), -и (казани, перми), -ах (горках)
    city = re.sub(r'(ск|вк|нк|рг|ов|ев|ин|ан|ер|ор|ад|яр|ом|ам|ыш|аз|ат|ёв|юк)е$', r'\1', city)
    city = re.sub(r'(ан|ер|ар|яр|ом|ам|ыш|аз|ат)и$', r'\1', city)
    # Простой fallback: если город кончается на "е" или "и" — обрезать
    # Но это слишком агрессивно, поэтому используем более точный подход:
    # просто обрежем последние 1-2 символа для ILIKE поиска
    if len(city) > 3 and city[-1] in ('е', 'и', 'у', 'ы'):
        city = city[:-1]
    return city


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
<<<<<<< HEAD
        raw_city = parts[1].split(" с ")[0].strip()
        filters["city"] = normalize_city(raw_city)
=======
        city_raw = parts[1].split(" с ")[0].strip()
        # Обрезаем окончание падежа (москве→моск, казани→казан, краснодаре→краснодар)
        if len(city_raw) > 3:
            filters["city"] = city_raw[:-2]
        elif len(city_raw) > 1:
            filters["city"] = city_raw[:-1]
        else:
            filters["city"] = city_raw
>>>>>>> origin/main
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
