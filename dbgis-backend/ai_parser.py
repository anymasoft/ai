# -*- coding: utf-8 -*-
"""
AI-парсер запросов через OpenAI API.
Прямая категоризация: запрос → leaf-категория из БД (без ROOT→CHILD).
"""

import os
import json
import logging
from typing import Dict, Optional, List

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    log.warning("OpenAI SDK не установлен. AI-парсер будет возвращать пустые фильтры.")


# ============================================================
# ФУНКЦИИ РАБОТЫ С КАТЕГОРИЯМИ ИЗ БД
# ============================================================

def get_leaf_categories(conn) -> List[Dict]:
    """Получить ВСЕ leaf-категории (бизнес-категории, parent_id IS NOT NULL)."""
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM categories WHERE parent_id IS NOT NULL ORDER BY name")
    rows = cur.fetchall()
    cur.close()
    return [dict(r) for r in rows]


def validate_category(selected_name: str, valid_categories: List[Dict]) -> Optional[Dict]:
    """Проверить что выбранная категория есть в списке.
    Возвращает dict {id, name} или None если не найдена."""
    if not selected_name:
        return None
    selected_lower = selected_name.strip().lower()
    for cat in valid_categories:
        if cat["name"].strip().lower() == selected_lower:
            return cat
    return None


# ============================================================
# LLM ВЫЗОВЫ
# ============================================================

def _get_openai_client():
    """Создать OpenAI клиент если доступен."""
    if not OPENAI_AVAILABLE:
        return None
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def _llm_select_category(client, query: str, categories: List[Dict], strict: bool = False) -> Optional[str]:
    """Попросить LLM выбрать одну категорию из списка."""
    names = [c["name"] for c in categories]
    names_str = "\n".join(f"- {n}" for n in names)

    if strict:
        prompt = f"""КРИТИЧЕСКАЯ ЗАДАЧА. Ошибка недопустима.

Пользователь ищет КОМПАНИИ. Запрос: "{query}"

Выбери СТРОГО ОДНУ категорию из списка ниже.
ЗАПРЕЩЕНО изменять текст, добавлять слова или придумывать новые.

ПРАВИЛА:
1. Пользователь ищет МЕСТО, УСЛУГУ или КОМПАНИЮ
2. Если запрос про товар — выбери место, где его продают
3. Если запрос про действие — выбери место, где это делают

ПРИМЕРЫ:
"где поесть" → ищи "Ресторан", "Кафе" и т.п.
"купить продукты" → ищи "Магазин продуктов", "Супермаркет"
"подстричься" → ищи "Парикмахерская", "Барбершоп"
"починить телефон" → ищи "Ремонт телефонов"

Если ни одна не подходит — выбери НАИБОЛЕЕ БЛИЗКУЮ.

Список категорий:
{names_str}

Ответ — ТОЛЬКО название категории из списка, без кавычек, без пояснений."""
    else:
        prompt = f"""Пользователь ищет КОМПАНИИ. Запрос: "{query}"

Выбери ОДНУ наиболее подходящую категорию из списка ниже.

ПРАВИЛА:
1. Пользователь ищет МЕСТО, УСЛУГУ или КОМПАНИЮ
2. Если запрос про товар — выбери место, где его продают
3. Если запрос про действие — выбери место, где это делают
4. Если есть несколько подходящих — выбери наиболее популярный/общий вариант
5. НЕ выбирай товарные категории (еда, напитки, материалы) — только бизнес

ПРИМЕРЫ:
"где поесть" → "Ресторан" или "Кафе"
"купить продукты" → "Магазин продуктов" или "Супермаркет"
"подстричься" → "Парикмахерская"
"починить телефон" → "Ремонт телефонов"
"где купить цветы" → "Цветочный магазин"

Список категорий:
{names_str}

Ответ — ТОЛЬКО название категории из списка, без кавычек, без пояснений."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=100
        )
        result = response.choices[0].message.content.strip().strip('"\'')
        log.info(f"[SEARCH] LLM выбрал: '{result}' (strict={strict})")
        return result
    except Exception as e:
        log.error(f"[SEARCH] Ошибка LLM: {e}")
        return None


def _llm_filter_categories(client, query: str, categories: List[Dict]) -> List[Dict]:
    """Мягкая фильтрация: убирает только явные товарные категории.

    Гарантирует минимум 10 категорий на выходе.
    """
    if len(categories) <= 15:
        return categories

    names = [c["name"] for c in categories]
    names_str = "\n".join(f"- {n}" for n in names)

    prompt = f"""Пользователь ищет КОМПАНИИ. Запрос: "{query}"

Твоя задача — слегка очистить список категорий.

ПРАВИЛА:
1. УДАЛИ только очевидные товарные категории (еда, напитки, материалы, продукция, сырьё)
2. НЕ удаляй категории бизнеса, даже если они кажутся нерелевантными
3. Если есть сомнение — ОСТАВЬ
4. Лучше оставить лишнее, чем удалить нужное

ВАЖНО:
- Верни НЕ МЕНЕЕ 10 категорий
- Верни НЕ БОЛЕЕ 30 категорий
- Если все категории — бизнес, верни ВСЕ

ПРИМЕР:
"продуктовые магазины"
❌ удалить: Продукты питания, Напитки, Мясо
✅ оставить: Магазин продуктов, Супермаркет, Торговые комплексы, Ресторан, и т.д.

Список категорий:
{names_str}

ФОРМАТ:
{{"categories": ["название1", "название2", ...]}}

ТОЛЬКО JSON, ничего больше."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=2000
        )
        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)
        filtered_names = set(n.strip().lower() for n in parsed.get("categories", []))

        filtered = [c for c in categories if c["name"].strip().lower() in filtered_names]

        log.info(f"[SEARCH] Filter: {len(categories)} → {len(filtered)}")

        if len(filtered) < 10:
            log.warning(f"[SEARCH] Filter слишком агрессивный ({len(filtered)} < 10), используем исходный список")
            return categories

        return filtered
    except Exception as e:
        log.error(f"[SEARCH] Ошибка LLM filter: {e}")
        return categories


def _llm_normalize_query(client, query: str) -> str:
    """Нормализовать запрос: превратить в название типа бизнеса для поиска по категориям."""
    prompt = f"""Преобразуй поисковый запрос в название ТИПА БИЗНЕСА или ОРГАНИЗАЦИИ.

Запрос: "{query}"

ПРАВИЛА:
1. Убери слова-мусор (срочно, дешево, рядом, быстро, где, как найти, купить и т.д.)
2. Преврати запрос в тип компании/места, а не в товар
3. Результат должен подходить для поиска по названиям категорий компаний

ПРИМЕРЫ:
"где купить покушать" → "кафе ресторан"
"продукты" → "продуктовый магазин"
"купить цветы срочно" → "цветочный магазин"
"ремонт айфонов дешево" → "ремонт телефонов"
"где поесть сегодня" → "ресторан кафе"
"купить еду" → "магазин продуктов"

Ответ — ТОЛЬКО нормализованный текст, без кавычек, без пояснений."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=100
        )
        return response.choices[0].message.content.strip().strip('"\'')
    except Exception:
        return query


def _llm_parse_filters(client, query: str) -> Dict:
    """Извлечь город и фильтры контактов из запроса (без категории)."""
    prompt = f"""Разбери поисковый запрос. Извлеки ТОЛЬКО город и фильтры контактов.

Запрос: "{query}"

Верни ТОЛЬКО валидный JSON:
{{"city": "город или null", "has_phone": false, "has_website": false, "has_email": false}}

Примеры:
"кафе в москве с телефоном" → {{"city": "москва", "has_phone": true, "has_website": false, "has_email": false}}
"ремонт телефонов" → {{"city": null, "has_phone": false, "has_website": false, "has_email": false}}

ТОЛЬКО JSON, ничего больше."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=200
        )
        content = response.choices[0].message.content.strip()
        return json.loads(content)
    except Exception:
        return {}


# ============================================================
# ОСНОВНАЯ ФУНКЦИЯ — ПРЯМАЯ КАТЕГОРИЗАЦИЯ (FLAT)
# ============================================================

def resolve_category_with_ai(query: str, conn) -> Dict:
    """Прямая категоризация: запрос → одна leaf-категория из БД.

    Без ROOT→CHILD. LLM сразу выбирает из бизнес-категорий (leaf).

    Returns:
        {
            "final_category": {"id": ..., "name": ...} или None,
            "normalized_query": "...",
            "city": "..." или None,
            "has_phone": bool,
            "has_website": bool,
            "has_email": bool,
            "method": "exact" | "fallback"
        }
    """
    result = {
        "final_category": None,
        "normalized_query": query,
        "city": None,
        "has_phone": False,
        "has_website": False,
        "has_email": False,
        "method": "fallback"
    }

    log.info(f"[SEARCH] QUERY: {query}")

    client = _get_openai_client()
    if not client:
        log.warning("[SEARCH] OpenAI недоступен, используем fallback")
        return result

    # --- Нормализация + фильтры ---
    normalized = _llm_normalize_query(client, query)
    result["normalized_query"] = normalized
    log.info(f"[SEARCH] NORMALIZED: {normalized}")

    filters = _llm_parse_filters(client, query)
    result["city"] = filters.get("city")
    result["has_phone"] = filters.get("has_phone", False)
    result["has_website"] = filters.get("has_website", False)
    result["has_email"] = filters.get("has_email", False)

    # --- Получаем ВСЕ leaf-категории ---
    leaf_categories = get_leaf_categories(conn)
    if not leaf_categories:
        log.warning("[SEARCH] Нет leaf-категорий в БД!")
        return result

    log.info(f"[SEARCH] Всего leaf-категорий: {len(leaf_categories)}")

    # --- Мягкая фильтрация (убираем только товары) ---
    filtered = _llm_filter_categories(client, query, leaf_categories)

    # --- Выбор финальной категории ---
    selected_name = _llm_select_category(client, query, filtered)
    final_cat = validate_category(selected_name, filtered) if selected_name else None

    # RETRY с strict-промптом
    if not final_cat:
        log.warning(f"[SEARCH] VALIDATION FAIL: '{selected_name}' не найден в списке. RETRY...")
        selected_name = _llm_select_category(client, query, filtered, strict=True)
        final_cat = validate_category(selected_name, filtered) if selected_name else None

    if not final_cat:
        log.warning(f"[SEARCH] RETRY FAILED. Используем fallback с normalized_query: '{normalized}'")
        return result

    result["final_category"] = final_cat
    result["method"] = "exact"
    log.info(f"[SEARCH] FINAL CATEGORY: {final_cat['name']} (id={final_cat['id']}) [exact]")

    return result


# ============================================================
# LEGACY ФУНКЦИИ (для совместимости)
# ============================================================

def parse_query_with_ai(query: str) -> Dict[str, Optional[str]]:
    """Legacy: Разбирает запрос через OpenAI (без категоризации по БД).
    Используется как fallback если conn недоступен."""
    if not OPENAI_AVAILABLE:
        return {}
    client = _get_openai_client()
    if not client:
        return {}

    try:
        prompt = f"""Разбери пользовательский поисковый запрос в JSON фильтры для поиска компаний.

Запрос: "{query}"

Верни ТОЛЬКО валидный JSON (без комментариев, без markdown), с полями:
- "category": строка (категория/тип организации) или null
- "city": строка (город) или null
- "has_phone": boolean (есть ли слова про телефон?)
- "has_website": boolean (есть ли слова про сайт?)
- "has_email": boolean (есть ли слова про email?)

Верни ТОЛЬКО JSON, никаких других текстов."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=200
        )
        content = response.choices[0].message.content.strip()
        filters = json.loads(content)
        log.info(f"[SEARCH] Legacy AI-парсер: '{query}' → {filters}")
        return filters
    except Exception as e:
        log.error(f"[SEARCH] Ошибка legacy AI: {e}")
        return {}


def parse_query_fallback(query: str) -> Dict[str, Optional[str]]:
    """Простой fallback парсер если AI недоступен."""
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
        filters["city"] = parts[1].split(" с ")[0].strip()
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
