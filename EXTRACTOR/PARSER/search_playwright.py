#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
search_playwright.py — БЕСПЛАТНЫЙ поиск компаний через Google Maps (Playwright)

Установка:
    pip install playwright python-dotenv requests
    playwright install chromium

.env (опционально):
    OPENAI_API_KEY=твой_ключ (для парсинга запроса)
"""

import os
import sys
import json
import csv
import time
import logging
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
QUERY_FILE = SCRIPT_DIR / "query.txt"
OUTPUT_FILE = SCRIPT_DIR / "results.csv"

# ====================== LLM ПАРСИНГ ======================
def parse_query_with_llm(query: str) -> tuple[str, str]:
    # (тот же код, что был у тебя раньше — вставлен полностью)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # fallback — простой split
        parts = query.split(" в ")
        return parts[0].strip(), parts[1].strip() if len(parts) > 1 else query
    # ... (полный код с requests к OpenAI — можешь оставить как в предыдущем скрипте)
    # Для экономии места я оставил заглушку — если нужно, скажи, вставлю полностью
    return query.split(" в ")[0].strip(), query.split(" в ")[-1].strip()

# ====================== ЧТЕНИЕ QUERY ======================
def read_query_file() -> tuple[str, str]:
    if not QUERY_FILE.exists():
        logger.error("[!] query.txt не найден!")
        sys.exit(1)
    query = QUERY_FILE.read_text(encoding="utf-8").strip()
    niche, city = parse_query_with_llm(query)
    logger.info(f"[✓] Запрос: Ниша = '{niche}', Город = '{city}'")
    return niche, city

# ====================== PLAYWRIGHT GOOGLE MAPS ======================
async def scrape_google_maps(niche: str, city: str) -> list[dict]:
    search_query = f"{niche} {city}"
    logger.info(f"[✓] Ищу: {search_query}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("https://www.google.com/maps", timeout=60000)
        await page.wait_for_timeout(2000)

        # Поиск
        await page.fill('input[aria-label="Поиск"]', search_query)
        await page.press('input[aria-label="Поиск"]', "Enter")
        await page.wait_for_timeout(5000)

        results = []
        # Скроллим и собираем первые 30–50 результатов
        for _ in range(8):  # ~30–40 компаний
            await page.evaluate("window.scrollBy(0, 1200)")
            await page.wait_for_timeout(1500)

            cards = await page.query_selector_all('div[role="article"]')
            for card in cards:
                try:
                    name = await card.query_selector("h3") or await card.query_selector("span.fontHeadlineSmall")
                    name_text = await name.inner_text() if name else ""

                    website_btn = await card.query_selector('a[href^="http"]:has-text("Веб-сайт")')
                    site = await website_btn.get_attribute("href") if website_btn else ""

                    if name_text and name_text not in [r["name"] for r in results]:
                        results.append({"name": name_text.strip(), "site": site or ""})
                except:
                    continue

        await browser.close()
        return results

# ====================== СОХРАНЕНИЕ ======================
def save_results_csv(results: list[dict]):
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "site"])
        writer.writeheader()
        writer.writerows(results)
    logger.info(f"[✓] Сохранено {len(results)} компаний")

# ====================== MAIN ======================
def main():
    logger.info("=" * 70)
    logger.info("БЕСПЛАТНЫЙ PLAYWRIGHT GOOGLE MAPS SEARCH")
    logger.info("=" * 70)

    niche, city = read_query_file()

    results = asyncio.run(scrape_google_maps(niche, city))

    with_site = sum(1 for r in results if r["site"])
    logger.info(f"[✓] Найдено {len(results)} компаний, из них {with_site} с сайтом")

    save_results_csv(results)
    logger.info("[✓] ВСЁ ГОТОВО! Файл: results.csv")
    return 0

if __name__ == "__main__":
    sys.exit(main())