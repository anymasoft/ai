#!/usr/bin/env python3
"""
Enrichment worker — обогащение контактов компаний из PostgreSQL.

Для каждой компании с доменом:
  1. Находим релевантные страницы сайта (crawler)
  2. Скачиваем HTML каждой страницы
  3. Извлекаем email и телефоны (extractor)
  4. Сохраняем в БД (emails + phones)
  5. Обновляем enrichment_status

Запуск:
  python enrich.py                    # батч по умолчанию (100 компаний)
  python enrich.py --batch-size 200   # размер батча
  python enrich.py --company-id 12345 # одна конкретная компания
  python enrich.py --status           # статистика без обработки
  python enrich.py --start            # сбросить все в pending и начать заново

Resume:
  Скрипт обрабатывает только компании с enrichment_status IN ('pending', 'failed').
  При прерывании (Ctrl+C) текущие 'processing' → 'failed' при следующем запуске.
  Повторный запуск продолжает с места остановки.

Cron (каждые 30 минут, батч 200):
  */30 * * * * cd /path/to/dbgis-backend && python enrich.py --batch-size 200 >> logs/enrich.log 2>&1
"""

import os
import re
import sys
import time
import hashlib
import logging
import argparse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from enrichment.crawler import get_relevant_links, fetch_url
from enrichment.extractor import extract_contacts

# ============================================================
# ВАЛИДАЦИЯ ДОМЕНОВ
# ============================================================

def is_valid_domain(domain: str) -> bool:
    """Проверяет, что домен валиден для обогащения.

    Пропускает только домены 2-го уровня (example.com)
    и www-субдомены (www.example.com).
    Отбрасывает поддомены 3+ уровня, домены с пробелами,
    домены без точки.
    """
    if not domain:
        return False
    domain = domain.strip().lower()
    if ' ' in domain:
        return False
    parts = domain.split('.')
    if len(parts) < 2:
        return False
    if len(parts) == 2:
        return True
    if len(parts) == 3 and parts[0] == "www":
        return True
    return False


# ============================================================
# КОНФИГУРАЦИЯ
# ============================================================

load_dotenv()

BATCH_SIZE = 100
MAX_WORKERS = 5              # параллельных потоков
DELAY_BETWEEN_SITES = 0.5   # пауза между сайтами (сек)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

LOG_FILE = os.path.join(os.path.dirname(__file__), "logs", "enrich.log")

# ============================================================
# ЛОГИРОВАНИЕ
# ============================================================

os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("enrich")


# ============================================================
# ПОДКЛЮЧЕНИЕ К БД
# ============================================================

def get_connection():
    """Открывает новое соединение с PostgreSQL."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


# ============================================================
# РАБОТА С БД
# ============================================================

def reset_stale_processing(conn):
    """
    Сбрасывает зависшие 'processing' → 'failed'.
    Вызывается при старте — защита от краша предыдущего запуска.
    """
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE companies
            SET enrichment_status = 'failed'
            WHERE enrichment_status = 'processing'
        """)
        count = cur.rowcount
        conn.commit()
    if count > 0:
        log.info(f"Сброшено зависших 'processing' → 'failed': {count}")


def reset_all_to_pending(conn):
    """Сбрасывает все компании с доменом обратно в 'pending'."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE companies
            SET enrichment_status = 'pending', enriched_at = NULL
            WHERE domain IS NOT NULL AND domain != ''
        """)
        count = cur.rowcount
        conn.commit()
    log.info(f"Сброшено в 'pending': {count} компаний")
    return count


def get_pending_batch(conn, batch_size: int) -> list[dict]:
    """Выбирает батч компаний для обогащения."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, domain
            FROM companies
            WHERE domain IS NOT NULL AND domain != ''
              AND (enrichment_status IS NULL OR enrichment_status IN ('pending', 'failed'))
            ORDER BY id
            LIMIT %s
        """, (batch_size,))
        return [dict(row) for row in cur.fetchall()]


def mark_processing(conn, company_id: int):
    """Отмечает компанию как 'в обработке'."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE companies SET enrichment_status = 'processing' WHERE id = %s",
            (company_id,)
        )
        conn.commit()


def mark_done(conn, company_id: int):
    """Отмечает компанию как успешно обогащённую."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE companies
            SET enrichment_status = 'done', enriched_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (company_id,))
        conn.commit()


def mark_failed(conn, company_id: int):
    """Отмечает компанию как неудачную."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE companies SET enrichment_status = 'failed' WHERE id = %s",
            (company_id,)
        )
        conn.commit()


def get_or_create_enrichment_branch(cur, company_id: int) -> int:
    """
    Возвращает branch_id для сохранения обогащённых телефонов.
    Сначала ищет существующий филиал. Если нет — создаёт виртуальный.
    """
    # Ищем первый существующий филиал компании
    cur.execute(
        "SELECT id FROM branches WHERE company_id = %s ORDER BY id LIMIT 1",
        (company_id,)
    )
    row = cur.fetchone()
    if row:
        return row["id"]

    # Создаём виртуальный филиал для enriched-телефонов
    branch_hash = hashlib.md5(f"enriched_{company_id}".encode()).hexdigest()
    cur.execute("""
        INSERT INTO branches (company_id, address, branch_hash)
        VALUES (%s, 'enriched', %s)
        ON CONFLICT (branch_hash) DO NOTHING
        RETURNING id
    """, (company_id, branch_hash))
    result = cur.fetchone()
    if result:
        return result["id"]

    # Конфликт — берём существующий
    cur.execute(
        "SELECT id FROM branches WHERE branch_hash = %s",
        (branch_hash,)
    )
    return cur.fetchone()["id"]


def save_contacts(conn, company_id: int, emails: list[str], phones: list[str]) -> dict:
    """
    Сохраняет emails и phones в БД.
    Возвращает {"emails_added": N, "phones_added": N}.
    """
    emails_added = 0
    phones_added = 0

    with conn.cursor() as cur:
        # Emails (привязаны к company_id)
        for email in emails:
            cur.execute("""
                INSERT INTO emails (company_id, email)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (company_id, email))
            if cur.rowcount:
                emails_added += 1

        # Phones (привязаны к branch_id)
        if phones:
            branch_id = get_or_create_enrichment_branch(cur, company_id)
            for phone in phones:
                cur.execute("""
                    INSERT INTO phones (branch_id, phone)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                """, (branch_id, phone))
                if cur.rowcount:
                    phones_added += 1

        conn.commit()

    return {"emails_added": emails_added, "phones_added": phones_added}


# ============================================================
# ОБРАБОТКА ОДНОЙ КОМПАНИИ
# ============================================================

def enrich_one(company_id: int, domain: str) -> dict:
    """
    Обогащает одну компанию: crawl → fetch → extract.
    Использует собственное соединение с БД (thread-safe).

    Returns:
        {"success": bool, "emails": [...], "phones": [...], "pages": N}
    """
    conn = None
    try:
        conn = get_connection()
        mark_processing(conn, company_id)

        # Получаем релевантные ссылки
        links = get_relevant_links(domain)
        if not links:
            log.warning(f"[{company_id}] {domain}: сайт недоступен")
            mark_failed(conn, company_id)
            return {"success": False, "emails": [], "phones": [], "pages": 0}

        all_emails: list[str] = []
        all_phones: list[str] = []
        seen_emails: set[str] = set()
        seen_digits: set[str] = set()
        pages_crawled = 0

        for url in links:
            try:
                html = fetch_url(url)
                if not html:
                    continue
                pages_crawled += 1

                contacts = extract_contacts(html)

                for email in contacts["emails"]:
                    if email not in seen_emails:
                        seen_emails.add(email)
                        all_emails.append(email)

                for phone in contacts["phones"]:
                    digits = re.sub(r"\D", "", phone)
                    if digits not in seen_digits:
                        seen_digits.add(digits)
                        all_phones.append(phone)

            except Exception as e:
                log.debug(f"[{company_id}] Ошибка страницы {url}: {e}")
                continue

        # Сохраняем контакты в БД
        stats = save_contacts(conn, company_id, all_emails, all_phones)
        mark_done(conn, company_id)

        log.info(
            f"[{company_id}] {domain}: "
            f"страниц={pages_crawled}, "
            f"+email={stats['emails_added']}, "
            f"+phone={stats['phones_added']}"
        )
        return {
            "success": True,
            "emails": all_emails,
            "phones": all_phones,
            "pages": pages_crawled,
        }

    except Exception as e:
        log.error(f"[{company_id}] {domain}: критическая ошибка — {e}")
        if conn:
            try:
                conn.rollback()
                mark_failed(conn, company_id)
            except Exception:
                pass
        return {"success": False, "emails": [], "phones": [], "pages": 0}

    finally:
        if conn:
            conn.close()


# ============================================================
# БАТЧЕВАЯ ОБРАБОТКА
# ============================================================

def process_batch(batch: list[dict]):
    """Обрабатывает батч компаний через ThreadPoolExecutor."""
    total = len(batch)
    success = 0
    failed = 0
    emails_total = 0
    phones_total = 0

    log.info(f"Начало батча: {total} компаний, {MAX_WORKERS} потоков")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(enrich_one, c["id"], c["domain"]): c
            for c in batch
        }

        for future in as_completed(futures):
            company = futures[future]
            try:
                result = future.result()
                if result["success"]:
                    success += 1
                    emails_total += len(result["emails"])
                    phones_total += len(result["phones"])
                else:
                    failed += 1
            except Exception as e:
                failed += 1
                log.error(f"[{company['id']}] Неожиданная ошибка: {e}")

            # Небольшая пауза для снижения нагрузки на сеть
            time.sleep(DELAY_BETWEEN_SITES)

    log.info(
        f"Батч завершён: успех={success}, ошибки={failed}, "
        f"email={emails_total}, телефоны={phones_total}"
    )


# ============================================================
# СТАТИСТИКА
# ============================================================

def show_status(conn):
    """Выводит статистику обогащения."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE domain IS NOT NULL AND domain != '') AS with_domain,
                COUNT(*) FILTER (WHERE enrichment_status = 'pending') AS pending,
                COUNT(*) FILTER (WHERE enrichment_status = 'processing') AS processing,
                COUNT(*) FILTER (WHERE enrichment_status = 'done') AS done,
                COUNT(*) FILTER (WHERE enrichment_status = 'failed') AS failed
            FROM companies
        """)
        row = dict(cur.fetchone())

    total = row["with_domain"]
    done = row["done"]
    pct = round(done / total * 100, 1) if total else 0

    print("\n=== СТАТИСТИКА ОБОГАЩЕНИЯ ===")
    print(f"  Компаний с доменом : {total}")
    print(f"  pending            : {row['pending']}")
    print(f"  processing         : {row['processing']}")
    print(f"  done               : {done}")
    print(f"  failed             : {row['failed']}")
    print(f"  Прогресс           : {done} / {total} ({pct}%)")
    print("=" * 32)


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Enrichment worker — обогащение контактов компаний"
    )
    parser.add_argument(
        "--batch-size", type=int, default=BATCH_SIZE,
        help=f"Размер батча (default: {BATCH_SIZE})"
    )
    parser.add_argument(
        "--company-id", type=int, default=None,
        help="Обработать одну конкретную компанию по ID"
    )
    parser.add_argument(
        "--status", action="store_true",
        help="Показать статистику и выйти"
    )
    parser.add_argument(
        "--start", action="store_true",
        help="Сбросить ВСЕ компании в pending и начать заново"
    )
    args = parser.parse_args()

    log.info(f"Запуск enrich.py: {' '.join(sys.argv[1:]) or '(батч по умолчанию)'}")

    conn = get_connection()

    try:
        if args.status:
            show_status(conn)
            return

        # Сбрасываем зависшие processing (crash recovery)
        reset_stale_processing(conn)

        if args.start:
            reset_all_to_pending(conn)

        if args.company_id:
            # Обработка одной компании
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name, domain FROM companies WHERE id = %s",
                    (args.company_id,)
                )
                company = cur.fetchone()

            if not company:
                log.error(f"Компания с id={args.company_id} не найдена")
                sys.exit(1)

            if not company["domain"]:
                log.error(f"У компании id={args.company_id} нет домена")
                sys.exit(1)

            log.info(f"Обработка одной компании: {company['name']} ({company['domain']})")
            result = enrich_one(args.company_id, company["domain"])
            print(f"Результат: {result}")
            return

        # Батчевая обработка
        batch = get_pending_batch(conn, args.batch_size)

        if not batch:
            log.info("Нет компаний для обогащения (все done или нет domain)")
            show_status(conn)
            return

        # Фильтруем невалидные домены (поддомены, мусор)
        valid_batch = []
        for c in batch:
            if is_valid_domain(c["domain"]):
                valid_batch.append(c)
            else:
                log.debug(f"[{c['id']}] Пропуск невалидного домена: {c['domain']}")
                # Помечаем как done — нечего обогащать
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE companies SET enrichment_status = 'done' WHERE id = %s",
                        (c["id"],)
                    )
                conn.commit()

        if not valid_batch:
            log.info("Нет компаний с валидными доменами для обогащения")
            show_status(conn)
            return

        log.info(f"Получено {len(valid_batch)} компаний для обогащения (отфильтровано {len(batch) - len(valid_batch)} невалидных доменов)")
        process_batch(valid_batch)
        show_status(conn)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
