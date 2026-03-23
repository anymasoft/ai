#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестирование системы AI-поиска.
Прогоняет список запросов через resolve_category_with_ai() и выводит таблицу результатов.

Запуск:
    python test_search.py
"""

import os
import sys
import time
import json
from dotenv import load_dotenv

load_dotenv()

import psycopg2
from psycopg2.extras import RealDictCursor

from ai_parser import resolve_category_with_ai

# --- Подключение к БД ---
def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "dbgis"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        cursor_factory=RealDictCursor
    )


# --- Тестовые запросы ---
TEST_QUERIES = [
    # Еда / рестораны
    "где поесть",
    "где покушать",
    "где можно нормально поесть вечером",
    "еда рядом",
    "хочу поесть вкусно",
    "food near me",
    "где купить еду",
    "купить продукты",
    "продукты рядом",
    "магазины еды",
    # Ремонт телефонов
    "починить айфон",
    "где ремонтируют телефоны",
    "разбил экран куда идти",
    "ремонт техники срочно",
    "fix iphone near me",
    # Автомойка
    "помыть машину",
    "где помыть авто",
    "автомойка рядом",
    "помыть машину быстро",
    "car wash",
    # Парикмахерские
    "подстричься",
    "где сделать стрижку",
    "барбершоп рядом",
    "haircut near me",
    "салон красоты недорого",
    # Медицина
    "врач рядом",
    "где лечат зубы",
    "болит зуб куда идти",
    "стоматология срочно",
    "dentist near me",
    # Аптеки
    "где купить лекарства",
    "аптека рядом",
    "нужны таблетки срочно",
    "pharmacy near me",
    # Цветы
    "где купить цветы",
    "цветы рядом",
    "flower shop",
    "букет срочно",
    # Одежда
    "где купить одежду",
    "одежда недорого",
    "магазин вещей",
    "clothes shop",
    # Развлечения
    "где провести время",
    "куда сходить вечером",
    "развлечения рядом",
    "куда пойти",
    "fun near me",
    # Бары / алкоголь
    "где выпить",
    "бар рядом",
    "алкоголь где купить",
    "wine shop",
    # Отели
    "где переночевать",
    "гостиница рядом",
    "отель недорого",
    "hotel near me",
    # Суши
    "где поесть суши",
    "суши рядом",
    "роллы заказать",
    "sushi near me",
    # Мебель
    "где купить мебель",
    "мебельный магазин",
    "диван купить",
    "furniture shop",
    # Ремонт квартир
    "где сделать ремонт квартиры",
    "строительные услуги",
    "ремонт дома",
    "renovation services",
    # Автозапчасти
    "где купить запчасти",
    "автозапчасти",
    "parts for car",
    # Печать / копирование
    "где распечатать документы",
    "печать рядом",
    "копицентр",
    # Фото
    "где сделать фото",
    "фото на документы",
    "photo studio",
    # Спорт
    "где заняться спортом",
    "зал рядом",
    "gym near me",
    # Отдых
    "где отдохнуть",
    "отдых рядом",
    "релакс",
    # Электроника
    "где купить технику",
    "электроника магазин",
    "electronics shop",
]


def run_tests():
    conn = get_connection()
    results = []
    total = len(TEST_QUERIES)

    print(f"\n{'='*100}")
    print(f"ТЕСТИРОВАНИЕ AI-ПОИСКА — {total} запросов")
    print(f"{'='*100}\n")

    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"[{i}/{total}] Тестирую: \"{query}\" ...", end=" ", flush=True)

        start = time.time()
        try:
            result = resolve_category_with_ai(query, conn)
            elapsed = time.time() - start

            root = result.get("root_category")
            final = result.get("final_category")
            normalized = result.get("normalized_query", "")
            method = result.get("method", "")

            root_name = root["name"] if root else "—"
            final_name = final["name"] if final else "—"

            results.append({
                "query": query,
                "root": root_name,
                "final": final_name,
                "normalized": normalized,
                "method": method,
                "elapsed": elapsed,
                "error": None,
            })

            print(f"→ {root_name} → {final_name} ({elapsed:.1f}s)")

        except Exception as e:
            elapsed = time.time() - start
            results.append({
                "query": query,
                "root": "ERROR",
                "final": "ERROR",
                "normalized": "",
                "method": "error",
                "elapsed": elapsed,
                "error": str(e),
            })
            print(f"→ ОШИБКА: {e}")

        # Небольшая пауза чтобы не упереться в rate limit
        time.sleep(0.3)

    conn.close()

    # --- Вывод таблицы ---
    print(f"\n\n{'='*140}")
    print("РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ")
    print(f"{'='*140}")
    print(f"{'QUERY':<40} | {'ROOT':<25} | {'FINAL':<25} | {'NORMALIZED':<25} | {'METHOD':<10} | {'TIME':>5}")
    print(f"{'-'*40}-+-{'-'*25}-+-{'-'*25}-+-{'-'*25}-+-{'-'*10}-+-{'-'*5}")

    for r in results:
        q = r["query"][:38]
        root = r["root"][:23]
        final = r["final"][:23]
        norm = r["normalized"][:23]
        method = r["method"][:8]
        t = f"{r['elapsed']:.1f}s"
        print(f"{q:<40} | {root:<25} | {final:<25} | {norm:<25} | {method:<10} | {t:>5}")

    # --- Сохранение JSON ---
    output_file = "test_search_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nРезультаты сохранены в {output_file}")

    # --- Статистика ---
    exact_count = sum(1 for r in results if r["method"] == "exact")
    fallback_count = sum(1 for r in results if r["method"] == "fallback")
    error_count = sum(1 for r in results if r["error"])
    avg_time = sum(r["elapsed"] for r in results) / len(results) if results else 0

    print(f"\n{'='*60}")
    print(f"СТАТИСТИКА:")
    print(f"  Всего запросов:    {len(results)}")
    print(f"  Exact match:       {exact_count}")
    print(f"  Fallback:          {fallback_count}")
    print(f"  Ошибки:            {error_count}")
    print(f"  Среднее время:     {avg_time:.1f}s")
    print(f"{'='*60}")


if __name__ == "__main__":
    run_tests()
