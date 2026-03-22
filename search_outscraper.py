#!/usr/bin/env python3
"""
Поиск компаний через Outscraper (Google Maps API).
Простой, прямолинейный скрипт без излишних абстракций.
"""

import csv
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Загрузить переменные из .env
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def parse_query_with_llm(query: str) -> tuple[str, str]:
    """
    Парсит текстовый запрос и извлекает нишу и город.

    Args:
        query: Текстовый запрос (например, "тату-салоны в братске")

    Returns:
        (niche, city) — кортеж с нишей и городом

    Пример:
        niche, city = parse_query_with_llm("кофейни в москве")
        # niche = "кофейни"
        # city = "москве"
    """
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("[✗] Требуется установка: pip install openai")
        sys.exit(1)

    openai_api_key = os.getenv("OPENAI_API_KEY")
    openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not openai_api_key:
        logger.error("[✗] OPENAI_API_KEY не установлен в .env")
        sys.exit(1)

    client = OpenAI(api_key=openai_api_key)

    prompt = f"""Распарси запрос и извлеки нишу (тип бизнеса) и город.
Запрос: "{query}"

Ответь ТОЛЬКО в формате:
NICHE:xxx
CITY:yyy

Где:
- NICHE = тип бизнеса/категория (например: тату-салоны, кофейни, парикмахерские)
- CITY = название города (например: москве, братске, санкт-петербурге)

Если города нет в запросе, используй пустую строку для CITY."""

    try:
        response = client.messages.create(
            model=openai_model,
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text.strip()

        niche = ""
        city = ""

        for line in response_text.split("\n"):
            if line.startswith("NICHE:"):
                niche = line.replace("NICHE:", "").strip()
            elif line.startswith("CITY:"):
                city = line.replace("CITY:", "").strip()

        if not niche:
            niche = query

        return niche, city

    except Exception as e:
        logger.error(f"[✗] Ошибка LLM: {e}")
        sys.exit(1)


def main():
    """Основная логика скрипта."""

    # === 1. Чтение query.txt ===
    query_file = Path("query.txt")

    if not query_file.exists():
        logger.error("[✗] Файл query.txt не найден в текущей папке")
        sys.exit(1)

    try:
        with open(query_file, "r", encoding="utf-8") as f:
            query = f.read().strip()
    except Exception as e:
        logger.error(f"[✗] Ошибка при чтении query.txt: {e}")
        sys.exit(1)

    if not query:
        logger.error("[✗] query.txt пуст")
        sys.exit(1)

    logger.info(f"[✓] Прочитан query.txt: '{query}'")

    # === 2. Парсинг через LLM ===
    niche, city = parse_query_with_llm(query)
    logger.info(f"[✓] LLM распарсил: Ниша = '{niche}', Город = '{city}'")

    # === 3. Формирование запроса ===
    search_query = f"{niche} {city}".strip()
    if not search_query:
        search_query = niche

    logger.info(f"[✓] Запрос к Outscraper: '{search_query}'")

    # === 4. Инициализация Outscraper ===
    try:
        from outscraper import ApiClient
    except ImportError:
        logger.error("[✗] Требуется установка: pip install outscraper")
        sys.exit(1)

    outscraper_api_key = os.getenv("OUTSCRAPER_API_KEY")
    if not outscraper_api_key:
        logger.error("[✗] OUTSCRAPER_API_KEY не установлен в .env")
        sys.exit(1)

    try:
        client = ApiClient(api_key=outscraper_api_key)
    except Exception as e:
        logger.error(f"[✗] Ошибка инициализации Outscraper: {e}")
        sys.exit(1)

    # === 5. Запрос к Outscraper ===
    try:
        response = client.google_maps_search_v2(
            queries=[search_query],
            limit=100,
            language="ru"
        )
    except Exception as e:
        logger.error(f"[✗] Ошибка API Outscraper: {e}")
        sys.exit(1)

    # === 6. Обработка результата ===
    results = []

    # Обработка вложенной структуры (может быть list[list[dict]])
    if not response:
        logger.warning("[⚠] API вернул пустой результат")
    else:
        # Flatten результат если нужно
        items_to_process = []

        if isinstance(response, list) and len(response) > 0:
            if isinstance(response[0], list):
                # Вложенный список: response = [[{...}, {...}], ...]
                for sublist in response:
                    if isinstance(sublist, list):
                        items_to_process.extend(sublist)
                    else:
                        items_to_process.append(sublist)
            else:
                # Простой список: response = [{...}, {...}]
                items_to_process = response

        # Извлечение данных
        for item in items_to_process:
            if isinstance(item, dict):
                name = item.get("name", "")
                site = item.get("site") or ""

                if name:  # Добавляем только если есть название
                    results.append({
                        "name": name,
                        "site": site
                    })

    companies_total = len(results)
    companies_with_site = sum(1 for r in results if r["site"])

    logger.info(f"[✓] Найдено {companies_total} компаний, из них {companies_with_site} с сайтом")

    # === 7. Сохранение CSV ===
    output_file = "results.csv"

    try:
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "site"])
            writer.writeheader()
            writer.writerows(results)
    except Exception as e:
        logger.error(f"[✗] Ошибка при сохранении CSV: {e}")
        sys.exit(1)

    logger.info(f"[✓] Результаты сохранены в {output_file}")


if __name__ == "__main__":
    main()
