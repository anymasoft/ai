# -*- coding: utf-8 -*-
"""
AI-парсер запросов через OpenAI API.
Разбирает пользовательский текст в структурированные фильтры.
"""

import os
import json
import logging
from typing import Dict, Optional

# Инициализируем логирование
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Попытаемся импортировать OpenAI (опционально)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    log.warning("OpenAI SDK не установлен. AI-парсер будет возвращать пустые фильтры.")


def parse_query_with_ai(query: str) -> Dict[str, Optional[str]]:
    """
    Разбирает пользовательский запрос через OpenAI API.

    Входные примеры:
    - "кафе в москве"
    - "рестораны с телефоном"
    - "парикмахерская в спб с сайтом"

    Возвращает:
    {
        "category": "кафе" или null,
        "city": "Москва" или null,
        "has_phone": True/False,
        "has_website": True/False,
        "has_email": True/False
    }
    """
    if not OPENAI_AVAILABLE:
        log.warning(f"OpenAI не доступен. Пропускаем AI-парсинг для: {query}")
        return {}

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        log.warning("OPENAI_API_KEY не установлена в .env. Пропускаем AI-парсинг.")
        return {}

    try:
        client = OpenAI(api_key=api_key)

        # Промпт для LLM
        prompt = f"""Разбери пользовательский поисковый запрос в JSON фильтры для поиска компаний.

Запрос: "{query}"

Верни ТОЛЬКО валидный JSON (без комментариев, без markdown), с полями:
- "category": строка (категория/тип организации) или null
- "city": строка (город) или null
- "has_phone": boolean (есть ли слова про телефон?)
- "has_website": boolean (есть ли слова про сайт?)
- "has_email": boolean (есть ли слова про email?)

Примеры:
"кафе в москве" → {{"category": "кафе", "city": "москва", "has_phone": false, "has_website": false, "has_email": false}}
"парикмахерская спб с телефоном" → {{"category": "парикмахерская", "city": "санкт-петербург", "has_phone": true, "has_website": false, "has_email": false}}
"ресторан с сайтом" → {{"category": "ресторан", "city": null, "has_phone": false, "has_website": true, "has_email": false}}

Верни ТОЛЬКО JSON, никаких других текстов."""

        # Вызов OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Или "gpt-3.5-turbo" для экономии
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0,  # Детерминированный ответ
            max_tokens=200
        )

        # Парсим ответ
        content = response.choices[0].message.content.strip()
        filters = json.loads(content)

        log.info(f"✅ AI-парсер: '{query}' → {filters}")
        return filters

    except json.JSONDecodeError as e:
        log.error(f"❌ AI вернула невалидный JSON: {content}")
        return {}
    except Exception as e:
        log.error(f"❌ Ошибка OpenAI: {str(e)}")
        return {}


def parse_query_fallback(query: str) -> Dict[str, Optional[str]]:
    """
    Простой fallback парсер если AI недоступен.
    Использует регулярные выражения (аналог фронтенд parseSearch).
    """
    filters = {
        "category": None,
        "city": None,
        "has_phone": False,
        "has_website": False,
        "has_email": False
    }

    lower = query.lower()

    # Парсим категорию и город
    if " в " in lower:
        parts = lower.split(" в ")
        filters["category"] = parts[0].strip()
        # Упрощённый парсинг города
        filters["city"] = parts[1].split(" с ")[0].strip()
    elif " с " in lower:
        filters["category"] = lower.split(" с ")[0].strip()
    else:
        filters["category"] = query.strip()

    # Парсим требования к контактам
    if "телефон" in lower:
        filters["has_phone"] = True
    if "сайт" in lower or "сайт" in lower:
        filters["has_website"] = True
    if "email" in lower or "почта" in lower:
        filters["has_email"] = True

    return filters
