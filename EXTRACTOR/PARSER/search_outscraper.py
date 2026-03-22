#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
search_outscraper.py — поиск компаний через Outscraper (Google Maps API).

Установка зависимостей:
    pip install outscraper python-dotenv requests

Требуемые файлы:
    - query.txt (в одной строке, например: "тату-салоны в братске")
    - .env с OUTSCRAPER_API_KEY и OPENAI_API_KEY
"""

import os
import sys
import json
import csv
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# ============================================================================
# Конфигурация логирования
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# ============================================================================
# Константы
# ============================================================================

SCRIPT_DIR = Path(__file__).parent
QUERY_FILE = SCRIPT_DIR / "query.txt"
OUTPUT_FILE = SCRIPT_DIR / "results.csv"

# ============================================================================
# LLM Парсинг запроса (на основе search_2gis.py)
# ============================================================================


def parse_query_with_llm(query: str) -> tuple[str, str]:
    """
    Парсит поисковый запрос через OpenAI API.

    Вход: "тату-салоны в братске"
    Выход: ("тату-салоны", "братск")

    Возвращает:
        (niche, city) — кортеж с нишей и городом

    Выбросит исключение если:
    - Нет API ключа
    - Ошибка API
    - Невалидный JSON
    """
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        logger.error("[!] OPENAI_API_KEY не установлен в .env")
        sys.exit(1)

    # Промпт для LLM (идентичен search_2gis.py)
    system_prompt = """Ты извлекаешь структуру из поискового запроса.
Верни ТОЛЬКО JSON:
{
  "niche": "...",
  "city": "..."
}

Правила:
- city — в именительном падеже, без предлогов
- niche — без предлогов, в том виде как указано
- не добавляй ничего кроме JSON"""

    user_message = f"Распарси запрос: \"{query}\""

    # POST запрос к OpenAI API
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()  # Выбросит исключение если ошибка HTTP
    except requests.exceptions.RequestException as e:
        logger.error(f"[!] Ошибка при обращении к OpenAI API: {e}")
        sys.exit(1)

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()
        result = json.loads(content)

        niche = result.get("niche", "").strip()
        city = result.get("city", "").strip()

        if not niche or not city:
            logger.error("[!] LLM вернул пустые значения niche или city")
            sys.exit(1)

        return niche, city

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        logger.error(f"[!] Ошибка парсинга ответа LLM: {e}")
        sys.exit(1)

# ============================================================================
# Функции
# ============================================================================


def read_query_file() -> tuple[str, str]:
    """
    Читает query.txt и парсит строку на niche и city через LLM.

    Возвращает:
        (niche, city)
    """
    if not QUERY_FILE.exists():
        logger.error(f"[!] Файл {QUERY_FILE.name} не найден!")
        logger.error(f"\nСоздайте файл {QUERY_FILE.name} с одной строкой:")
        logger.error("  Пример: тату-салоны в братске")
        logger.error("  Пример: стоматологии в челябинске")
        sys.exit(1)

    try:
        with open(QUERY_FILE, "r", encoding="utf-8") as f:
            query = f.read().strip()
    except Exception as e:
        logger.error(f"[!] Ошибка при чтении {QUERY_FILE.name}: {e}")
        sys.exit(1)

    if not query:
        logger.error(f"[!] Файл {QUERY_FILE.name} пуст!")
        sys.exit(1)

    logger.info(f"[✓] Прочитан query.txt: '{query}'")

    # Парсим через LLM
    logger.info(f"[*] Парсинг через LLM...")
    niche, city = parse_query_with_llm(query)

    logger.info(f"[✓] LLM распарсил: Ниша = '{niche}', Город = '{city}'")

    return niche, city


def search_outscraper(niche: str, city: str) -> list[dict]:
    """
    Поиск компаний через Outscraper API.

    Args:
        niche: Ниша/категория (например: "тату-салоны")
        city: Город (например: "братск")

    Returns:
        Список словарей с полями: name, site
    """
    try:
        from outscraper import ApiClient
    except ImportError:
        logger.error("[!] Требуется установка: pip install outscraper")
        sys.exit(1)

    api_key = os.getenv("OUTSCRAPER_API_KEY")
    if not api_key:
        logger.error("[!] OUTSCRAPER_API_KEY не установлен в .env")
        sys.exit(1)

    # Формирование запроса
    search_query = f"{niche} {city}".strip()
    logger.info(f"[✓] Запрос к Outscraper: '{search_query}'")

    # Инициализация клиента и запрос
    try:
        client = ApiClient(api_key=api_key)
    except Exception as e:
        logger.error(f"[!] Ошибка инициализации Outscraper: {e}")
        sys.exit(1)

    try:
        logger.info(f"[*] Отправляю запрос к Outscraper...")
        response = client.google_maps_search(
            search_query,
            limit=100,
            language="ru"
        )
    except Exception as e:
        logger.error(f"[!] Ошибка API Outscraper: {e}")
        sys.exit(1)

    # Обработка результата
    results = []

    if not response:
        logger.warning("[⚠] API вернул пустой результат")
        return results

    # Flatten результат если вложенная структура
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

    return results


def save_results_csv(results: list[dict]) -> None:
    """
    Сохраняет результаты в CSV файл.

    Args:
        results: Список словарей с полями name, site
    """
    try:
        with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "site"])
            writer.writeheader()
            writer.writerows(results)

        logger.info(f"[✓] Результаты сохранены в {OUTPUT_FILE.name}")

    except Exception as e:
        logger.error(f"[!] Ошибка при сохранении CSV: {e}")
        sys.exit(1)


def main():
    """Основная функция."""
    logger.info("=" * 70)
    logger.info("ПОИСК КОМПАНИЙ ЧЕРЕЗ OUTSCRAPER (Google Maps API)")
    logger.info("=" * 70)

    # Читаем query.txt и парсим
    niche, city = read_query_file()

    # Поиск через Outscraper
    results = search_outscraper(niche, city)

    # Статистика
    companies_total = len(results)
    companies_with_site = sum(1 for r in results if r["site"])

    logger.info(f"[✓] Найдено {companies_total} компаний, "
                f"из них {companies_with_site} с сайтом")

    # Сохранение результатов
    if results:
        save_results_csv(results)
    else:
        logger.warning("[⚠] Результаты пусты, CSV не создан")

    logger.info("=" * 70)
    logger.info("[✓] ВСЁ ГОТОВО!")
    logger.info("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
