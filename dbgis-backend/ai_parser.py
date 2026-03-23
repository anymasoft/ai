# -*- coding: utf-8 -*-
"""
AI-парсер запросов через OpenAI API.
Двухшаговая категоризация: ROOT → CHILD → точная категория из БД.
"""

import os
import json
import logging
from typing import Dict, Optional, List, Tuple

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


# ============================================================
# ФУНКЦИИ РАБОТЫ С КАТЕГОРИЯМИ ИЗ БД
# ============================================================

def get_root_categories(conn) -> List[Dict]:
    """Получить список ROOT категорий (parent_id IS NULL)."""
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM categories WHERE parent_id IS NULL ORDER BY name")
    rows = cur.fetchall()
    cur.close()
    return [dict(r) for r in rows]


def get_child_categories(conn, parent_id: int) -> List[Dict]:
    """Получить дочерние категории для parent_id."""
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM categories WHERE parent_id = %s ORDER BY name", (parent_id,))
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
# LLM ВЫЗОВЫ ДЛЯ КАТЕГОРИЗАЦИИ
# ============================================================

def _get_openai_client():
    """Создать OpenAI клиент если доступен."""
    if not OPENAI_AVAILABLE:
        return None
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def _llm_select_category(client, query: str, categories: List[Dict], step: str, strict: bool = False) -> Optional[str]:
    """Попросить LLM выбрать одну категорию из списка.

    Args:
        client: OpenAI клиент
        query: поисковый запрос пользователя
        categories: список {id, name} — допустимые категории
        step: "ROOT" или "CHILD" — для логирования
        strict: True = retry-режим с усиленными ограничениями
    """
    names = [c["name"] for c in categories]
    names_str = "\n".join(f"- {n}" for n in names)

    # Правило выбора бизнес-категорий (общее для обоих режимов)
    business_rule = """ПРАВИЛО ВЫБОРА КАТЕГОРИИ:
Пользователь ищет КОМПАНИИ, а не товары.
Категории бывают двух типов:
1. Тип бизнеса (компания, сервис, место) — отвечает на вопрос "кто это?"
2. Тип товара (еда, продукция, вещи) — отвечает на вопрос "что это?"

Выбирай ТОЛЬКО тип бизнеса. Товарные категории ЗАПРЕЩЕНЫ.

Примеры:
- "продуктовые магазины" → выбери категорию про магазины, НЕ про продукты питания
- "где поесть" → выбери категорию про рестораны/кафе, НЕ про еду/блюда
- "купить цветы" → выбери категорию про цветочные магазины, НЕ про растения

Если есть выбор между товаром и бизнесом — ВСЕГДА выбирай бизнес."""

    if strict:
        prompt = f"""КРИТИЧЕСКАЯ ЗАДАЧА. Ошибка недопустима.

Пользователь ищет: "{query}"

{business_rule}

Выбери СТРОГО ОДНУ категорию из списка ниже. ЗАПРЕЩЕНО изменять текст, добавлять слова или придумывать новые категории.
Верни ТОЛЬКО название категории из списка — ничего больше.

Список категорий:
{names_str}

Если ни одна не подходит — выбери НАИБОЛЕЕ БЛИЗКУЮ категорию бизнеса.
Ответ — ТОЛЬКО название категории, без кавычек, без пояснений."""
    else:
        prompt = f"""Пользователь ищет: "{query}"

{business_rule}

Выбери ОДНУ наиболее подходящую категорию из списка ниже.
Верни ТОЛЬКО название категории из списка — ничего больше.

Список категорий:
{names_str}

Ответ — ТОЛЬКО название категории, без кавычек, без пояснений."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=100
        )
        result = response.choices[0].message.content.strip()
        # Убираем кавычки если LLM их добавил
        result = result.strip('"\'')
        log.info(f"[SEARCH] STEP {step}: LLM выбрал '{result}' (strict={strict})")
        return result
    except Exception as e:
        log.error(f"[SEARCH] Ошибка LLM на шаге {step}: {e}")
        return None


def _llm_filter_categories(client, query: str, categories: List[Dict], step: str) -> List[Dict]:
    """Отфильтровать список категорий через LLM — оставить только бизнес-категории.

    Args:
        client: OpenAI клиент
        query: поисковый запрос пользователя
        categories: список {id, name} из БД
        step: "ROOT" или "CHILD" — для логирования

    Returns:
        Отфильтрованный список {id, name}. Если LLM вернул пустой — исходный список (fail-safe).
    """
    if len(categories) <= 3:
        # Слишком мало категорий — фильтрация не нужна
        return categories

    names = [c["name"] for c in categories]
    names_str = "\n".join(f"- {n}" for n in names)

    prompt = f"""Пользователь ищет: "{query}"

Ниже список категорий из справочника 2ГИС. Пользователь ищет КОМПАНИИ (места, сервисы, организации).

Твоя задача: убрать из списка категории, которые являются ТОВАРАМИ или ПРОДУКЦИЕЙ, и оставить только те, которые описывают ТИП БИЗНЕСА.

Как определить:
- "кто это?" (магазин, ресторан, мастерская, салон) → ОСТАВИТЬ
- "что это?" (еда, напитки, мясо, одежда, мебель) → УБРАТЬ

Примеры:
- "Магазин продуктов" → ОСТАВИТЬ (это бизнес)
- "Продукты питания" → УБРАТЬ (это товар)
- "Ресторан" → ОСТАВИТЬ (это бизнес)
- "Напитки" → УБРАТЬ (это товар)

Из списка ниже оставь ТОЛЬКО бизнес-категории, релевантные запросу "{query}".
Верни JSON: {{"categories": ["название1", "название2", ...]}}

Список категорий:
{names_str}

ТОЛЬКО JSON, ничего больше."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=1000
        )
        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)
        filtered_names = set(n.strip().lower() for n in parsed.get("categories", []))

        # Сопоставляем обратно с id
        filtered = [c for c in categories if c["name"].strip().lower() in filtered_names]

        log.info(f"[SEARCH] {step} filter: {len(categories)} → {len(filtered)}")

        # Fail-safe: если LLM убрал всё — вернуть исходный список
        if not filtered:
            log.warning(f"[SEARCH] {step} filter вернул пустой список, используем исходный")
            return categories

        return filtered
    except Exception as e:
        log.error(f"[SEARCH] Ошибка LLM filter ({step}): {e}")
        return categories


def _llm_normalize_query(client, query: str) -> str:
    """Нормализовать запрос: убрать мусор, оставить суть."""
    prompt = f"""Нормализуй поисковый запрос. Убери слова-мусор (срочно, дешево, рядом, быстро, недорого, сегодня, где, как найти и т.д.).
Оставь только суть запроса для поиска по категориям.

Запрос: "{query}"

Ответ — ТОЛЬКО нормализованный текст, без кавычек, без пояснений."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=100
        )
        result = response.choices[0].message.content.strip().strip('"\'')
        return result
    except Exception:
        # Fallback: вернуть исходный запрос
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
# ОСНОВНАЯ ФУНКЦИЯ — ДВУХШАГОВАЯ КАТЕГОРИЗАЦИЯ
# ============================================================

def resolve_category_with_ai(query: str, conn) -> Dict:
    """Двухшаговая категоризация запроса через LLM.

    Шаг 1: Выбор ROOT категории из БД
    Шаг 2: Выбор CHILD категории из БД
    + нормализация запроса
    + извлечение города/фильтров

    Returns:
        {
            "root_category": {"id": ..., "name": ...} или None,
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
        "root_category": None,
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
        result["normalized_query"] = query
        return result

    # --- Параллельно: нормализация + фильтры ---
    normalized = _llm_normalize_query(client, query)
    result["normalized_query"] = normalized
    log.info(f"[SEARCH] NORMALIZED: {normalized}")

    filters = _llm_parse_filters(client, query)
    result["city"] = filters.get("city")
    result["has_phone"] = filters.get("has_phone", False)
    result["has_website"] = filters.get("has_website", False)
    result["has_email"] = filters.get("has_email", False)

    # --- ШАГ 1: Выбор ROOT категории ---
    root_categories = get_root_categories(conn)
    if not root_categories:
        log.warning("[SEARCH] Нет ROOT категорий в БД!")
        return result

    # Фильтрация ROOT: убираем товарные категории
    root_categories = _llm_filter_categories(client, query, root_categories, "ROOT")

    root_name = _llm_select_category(client, query, root_categories, "ROOT")
    root_cat = validate_category(root_name, root_categories) if root_name else None

    # RETRY для ROOT
    if not root_cat:
        log.warning(f"[SEARCH] VALIDATION FAIL ROOT: '{root_name}' не найден в списке. RETRY...")
        root_name = _llm_select_category(client, query, root_categories, "ROOT", strict=True)
        root_cat = validate_category(root_name, root_categories) if root_name else None

    if not root_cat:
        log.warning(f"[SEARCH] ROOT RETRY FAILED. Используем fallback с normalized_query: '{normalized}'")
        return result

    result["root_category"] = root_cat
    log.info(f"[SEARCH] STEP 1 ROOT: {root_cat['name']} (id={root_cat['id']})")

    # --- ШАГ 2: Выбор CHILD категории ---
    child_categories = get_child_categories(conn, root_cat["id"])

    if not child_categories:
        # Нет дочерних — root IS финальная категория
        log.info(f"[SEARCH] Нет CHILD для root '{root_cat['name']}', используем root как финальную")
        result["final_category"] = root_cat
        result["method"] = "exact"
        log.info(f"[SEARCH] FINAL CATEGORY: {root_cat['name']} (id={root_cat['id']}) [exact]")
        return result

    # Фильтрация CHILD: убираем товарные категории
    child_categories = _llm_filter_categories(client, query, child_categories, "CHILD")

    child_name = _llm_select_category(client, query, child_categories, "CHILD")
    child_cat = validate_category(child_name, child_categories) if child_name else None

    # RETRY для CHILD
    if not child_cat:
        log.warning(f"[SEARCH] VALIDATION FAIL CHILD: '{child_name}' не найден в списке. RETRY...")
        child_name = _llm_select_category(client, query, child_categories, "CHILD", strict=True)
        child_cat = validate_category(child_name, child_categories) if child_name else None

    if not child_cat:
        # Fallback: используем root как финальную категорию
        log.warning(f"[SEARCH] CHILD RETRY FAILED. Используем root '{root_cat['name']}' как финальную")
        result["final_category"] = root_cat
        result["method"] = "exact"
        return result

    result["final_category"] = child_cat
    result["method"] = "exact"
    log.info(f"[SEARCH] STEP 2 CHILD: {child_cat['name']} (id={child_cat['id']})")
    log.info(f"[SEARCH] FINAL CATEGORY: {child_cat['name']} (id={child_cat['id']}) [exact]")

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
