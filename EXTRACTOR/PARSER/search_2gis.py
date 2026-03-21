#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
search_2gis.py — парсер 2GIS для поиска компаний по нише и городу.

Установка зависимостей:
    pip install pymorphy2 python-Levenshtein iuliia

Установка parser-2gis:
    pip install parser-2gis
    # или через npm если используется Node.js версия

Требуемые файлы:
    - query.txt (в одной строке, например: "автомойки в иркутске")
    - russia-cities.json (скачать с https://github.com/arbaev/russia-cities/blob/master/cities.json)
"""

import os
import sys
import json
import logging
import subprocess
import requests
from pathlib import Path
from dotenv import load_dotenv
import pymorphy2
from iuliia import YANDEX_MAPS

# Загружаем переменные окружения
load_dotenv()

# ============================================================================
# Конфигурация логирования
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# ============================================================================
# Константы
# ============================================================================

SCRIPT_DIR = Path(__file__).parent
QUERY_FILE = SCRIPT_DIR / "query.txt"
RUSSIA_CITIES_FILE = SCRIPT_DIR / "russia-cities.json"
OUTPUT_FILE = SCRIPT_DIR / "results.csv"

# Исключения для 2GIS (города с нестандартными slug'ами)
EXCEPTIONS_2GIS = {
    "moskva": "moscow",
    "москва": "moscow",
    "sankt-peterburg": "spb",
    "sanktpeterburg": "spb",
    "sv-peterburg": "spb",
    "pitep": "spb",
    "piter": "spb",
    "ekaterinburg": "ekaterinburg",
    "sverdlovsk": "ekaterinburg",
    "vladivostok": "vladivostok",
    "novosibirsk": "novosibirsk",
    "chelyabinsk": "chelyabinsk",
    "omsk": "omsk",
    "perm": "perm",
    "ufa": "ufa",
    "rostov-na-donu": "rostov",
    "rostovna": "rostov",
    "krasnodar": "krasnodar",
    "sochi": "sochi",
    "samara": "samara",
}

# ============================================================================
# Инициализация pymorphy2
# ============================================================================

morph = pymorphy2.MorphAnalyzer()

# ============================================================================
# LLM Парсинг запроса
# ============================================================================


def parse_query_with_llm(query: str) -> tuple[str, str]:
    """
    Парсит поисковый запрос через GPT-4o-mini.

    Вход: "тату-салоны в братске"
    Выход: ("тату-салоны", "братск")

    Возвращает:
        (niche, city)

    Выбросит исключение если:
    - Нет API ключа
    - Ошибка API
    - Невалидный JSON
    """
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        raise ValueError("[!] OPENAI_API_KEY не установлен. Создайте .env файл.")

    # Промпт для LLM
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

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()  # Выбросит исключение если ошибка HTTP

    data = response.json()

    # Извлекаем текст ответа
    content = data["choices"][0]["message"]["content"].strip()

    # Парсим JSON
    result = json.loads(content)

    niche = result.get("niche", "").strip()
    city = result.get("city", "").strip()

    if not niche or not city:
        raise ValueError("[!] LLM вернул пустые значения niche или city")

    return niche, city

# ============================================================================
# Функции
# ============================================================================


def normalize_city_word(word: str) -> str:
    """
    Приводит слово к именительному падежу (номинатив).
    Убирает предлоги типа 'в', 'во', 'при' и т.д.
    """
    word = word.lower().strip()

    # Убираем предлоги в начале
    prepositions = ["в", "во", "при", "на", "к"]
    for prep in prepositions:
        if word.startswith(prep + " "):
            word = word[len(prep):].strip()
            break

    # Привод к номинативу через pymorphy2
    parsed = morph.parse(word)[0]
    normal_form = parsed.normal_form

    return normal_form


def load_russia_cities() -> dict:
    """
    Загружает данные о русских городах из russia-cities.json.
    Возвращает словарь {label: slug} для быстрого поиска.
    """
    if not RUSSIA_CITIES_FILE.exists():
        logger.warning(f"[!] Файл {RUSSIA_CITIES_FILE.name} не найден!")
        logger.warning("\nСкачайте файл с помощью:")
        logger.warning(f"  curl -o {RUSSIA_CITIES_FILE.name} https://raw.githubusercontent.com/arbaev/russia-cities/master/cities.json")
        logger.warning("\nИли вручную скачайте:")
        logger.warning("  https://github.com/arbaev/russia-cities/blob/master/cities.json")
        return {}

    try:
        with open(RUSSIA_CITIES_FILE, "r", encoding="utf-8") as f:
            cities_data = json.load(f)

        # Создаём словарь {label: slug}
        cities_map = {}
        if isinstance(cities_data, list):
            for city in cities_data:
                if "label" in city and "value" in city:
                    label = city["label"].lower()
                    slug = city["value"].lower()
                    cities_map[label] = slug
        elif isinstance(cities_data, dict):
            for label, slug in cities_data.items():
                cities_map[label.lower()] = slug.lower()

        logger.info(f"[✓] Загружено {len(cities_map)} городов из russia-cities.json")
        return cities_map

    except Exception as e:
        logger.error(f"[!] Ошибка при загрузке russia-cities.json: {e}")
        return {}

def city_to_2gis_slug(raw_city: str, cities_map: dict) -> str:
    """
    Преобразует raw_city в slug для 2GIS.

    Алгоритм:
    1. Нормализация через pymorphy2 (приведение к номинативу)
    2. Поиск в исключениях (EXCEPTIONS_2GIS)
    3. Поиск в russia-cities.json
    5. Если ничего не сработало: возвращаем как есть
    """
    raw_city = raw_city.strip()
    if not raw_city:
        return ""

    # Шаг 1: Нормализация через pymorphy2
    normalized = normalize_city_word(raw_city)
    normalized_slug = normalized.replace(" ", "-").lower()

    logger.info(f"[*] Исходный город: '{raw_city}'")
    logger.info(f"[*] После pymorphy2: '{normalized}'")

    # Шаг 2: Проверка исключений
    if normalized_slug in EXCEPTIONS_2GIS:
        slug = EXCEPTIONS_2GIS[normalized_slug]
        logger.info(f"[*] Найдено в исключениях: '{slug}'")
        return slug

    # Альтернативный ключ без дефисов
    normalized_key = normalized_slug.replace("-", "")
    if normalized_key in EXCEPTIONS_2GIS:
        slug = EXCEPTIONS_2GIS[normalized_key]
        logger.info(f"[*] Найдено в исключениях (без дефисов): '{slug}'")
        return slug

    # Шаг 3: Поиск в russia-cities.json
    if normalized_slug in cities_map:
        slug = cities_map[normalized_slug]
        logger.info(f"[*] Найдено в russia-cities.json: '{slug}'")
        return slug

    # Попробуем поиск по нормализованному названию
    if normalized in cities_map:
        slug = cities_map[normalized]
        logger.info(f"[*] Найдено в russia-cities.json (по нормализованному имени): '{slug}'")
        return slug

    # Шаг 4: Fallback через iuliia
    slug = YANDEX_MAPS.translate(normalized)
    slug = slug.replace(" ", "-").lower()
    logger.debug(f"[DEBUG] iuliia result: '{slug}'")
    logger.info(f"[*] Использован iuliia (yandex_maps): '{slug}'")
    return slug

def read_query_file() -> tuple[str, str]:
    """
    Читает query.txt и парсит строку на niche и city.

    Формат: "niche в city" или "niche в city1 city2"

    Возвращает:
        (niche, city_raw)
    """
    if not QUERY_FILE.exists():
        logger.error(f"[!] Файл {QUERY_FILE.name} не найден!")
        logger.error(f"\nСоздайте файл {QUERY_FILE.name} с одной строкой:")
        logger.error("  Пример: автомойки в иркутске")
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
    logger.info(f"[*] LLM parsing используется")
    niche, city_raw = parse_query_with_llm(query)

    logger.info(f"    Ниша: '{niche}'")
    logger.info(f"    Город (raw): '{city_raw}'")

    return niche, city_raw


def build_2gis_url(niche: str, city_slug: str) -> str:
    """Строит URL для 2GIS."""
    url = f"https://2gis.ru/{city_slug}/search/{niche}"
    return url


def run_parser(url: str, output_file: Path) -> bool:
    """
    Запускает parser-2gis через subprocess и выводит результаты в консоль.

    Процесс:
    1. Парсер сохраняет результаты в JSON (временный файл)
    2. JSON читается и парсится
    3. Данные выводятся красиво в консоль
    4. Временный файл удаляется

    Возвращает:
        True если успешно, False если ошибка
    """
    temp_json = output_file.parent / "temp_results.json"

    cmd = [
        "parser-2gis",
        "-i", url,
        "-o", str(temp_json),
        "-f", "json",
        "--parser.delay_between_clicks", "200",
        "--chrome.headless", "yes",
    ]

    logger.info(f"[*] Запуск парсера...")
    logger.info(f"    URL: {url}")

    result = subprocess.run(cmd, timeout=3600)

    if result.returncode == 0:
        logger.info(f"[✓] Парсер завершён успешно!")

        if temp_json.exists():
            with open(temp_json, "r", encoding="utf-8") as f:
                results = json.load(f)

            if results:
                logger.info(f"[*] Найдено записей: {len(results)}")
                logger.info("")

                print("=" * 100)
                print("РЕЗУЛЬТАТЫ ПАРСИНГА")
                print("=" * 100)

                for idx, item in enumerate(results, 1):
                    print(f"\n{idx}. {item.get('Наименование', 'N/A')}")
                    print(f"   Адрес: {item.get('Адрес', 'N/A')}")
                    print(f"   Телефон: {item.get('Телефон_1', 'N/A')}")
                    if item.get('Телефон_2'):
                        print(f"   Телефон_2: {item.get('Телефон_2')}")
                    if item.get('Телефон_3'):
                        print(f"   Телефон_3: {item.get('Телефон_3')}")
                    if item.get('Email'):
                        print(f"   Email: {item.get('Email')}")
                    if item.get('Сайт'):
                        print(f"   Сайт: {item.get('Сайт')}")
                    if item.get('Часы работы'):
                        print(f"   Часы работы: {item.get('Часы работы')}")
                    if item.get('Рубрики'):
                        print(f"   Рубрики: {item.get('Рубрики')}")

                print("\n" + "=" * 100)
            else:
                print("Результатов не найдено")

            temp_json.unlink()
            logger.info(f"[✓] Временный файл удалён")

        return True
    else:
        logger.error(f"[!] Парсер вернул код ошибки: {result.returncode}")
        return False


def main():
    """Основная функция."""
    logger.info("=" * 70)
    logger.info("PARSER 2GIS — Поиск компаний по нише и городу")
    logger.info("=" * 70)

    # Читаем query.txt
    niche, city_raw = read_query_file()

    # Загружаем города
    cities_map = load_russia_cities()

    # Преобразуем город в slug для 2GIS
    city_slug = city_to_2gis_slug(city_raw, cities_map)

    if not city_slug:
        logger.error(f"[!] Не удалось преобразовать город: '{city_raw}'")
        sys.exit(1)

    logger.info(f"[✓] City slug для 2GIS: '{city_slug}'")

    # Строим URL
    url = build_2gis_url(niche, city_slug)
    logger.info(f"[✓] Построен URL: {url}")

    # Запускаем парсер
    success = run_parser(url, OUTPUT_FILE)

    if success:
        logger.info(f"\n[✓] ВСЁ ГОТОВО!")
        logger.info(f"    Результаты выведены выше в консоль")
        return 0
    else:
        logger.error(f"\n[!] Ошибка при парсинге")
        return 1


if __name__ == "__main__":
    sys.exit(main())
