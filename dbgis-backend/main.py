#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI backend для dbgis — поиск и фильтрация компаний из 2ГИС.
PostgreSQL + HTML5 + Vanilla JS.

Оптимизация:
- LATERAL JOIN вместо коррелированных подзапросов
- Без DISTINCT (GROUP BY на PK)
- Connection pool (psycopg2.pool)
- In-memory кеш с TTL
- Индексы pg_trgm для ILIKE
"""

import os
import csv
import io
import sys
import hashlib
import logging
import subprocess
import time
from typing import Optional
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from jinja2 import Environment, FileSystemLoader
from dotenv import load_dotenv

# AI-парсер запросов
try:
    from ai_parser import parse_query_with_ai, parse_query_fallback, resolve_category_with_ai
    AI_PARSER_AVAILABLE = True
except ImportError:
    AI_PARSER_AVAILABLE = False

# ============================================================
# ГЛОБАЛЬНОЕ СОСТОЯНИЕ ОБОГАЩЕНИЯ (ОТКЛЮЧЕНО)
# ============================================================
# Функции обогащения удалены по запросу пользователя

def _decode_one_domain(d: str) -> str:
    """Декодирует один Punycode-домен в Unicode."""
    try:
        return d.encode('ascii').decode('idna')
    except Exception:
        return d


def decode_punycode_domain(domain: str) -> str:
    """Декодирует Punycode-домены в Unicode кириллицу.

    Поддерживает несколько доменов через запятую:
    'stoautomaster.business.site, xn----ctbholqj.xn--p1ai'
    → 'stoautomaster.business.site, вин-код.рф'
    """
    if not domain:
        return domain
    parts = [p.strip() for p in domain.split(",")]
    decoded = [_decode_one_domain(p) for p in parts]
    return ", ".join(decoded)


# ============================================================
# IN-MEMORY КЕШ (TTL)
# ============================================================

class SimpleCache:
    """Простой in-memory кеш с TTL. Без Redis, без зависимостей."""

    def __init__(self, ttl: int = 60):
        self._store: dict = {}
        self._ttl = ttl

    def _make_key(self, prefix: str, params: dict) -> str:
        """Хеш-ключ из параметров запроса."""
        raw = f"{prefix}:{sorted(params.items())}"
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, prefix: str, params: dict):
        """Возвращает кешированное значение или None."""
        key = self._make_key(prefix, params)
        entry = self._store.get(key)
        if entry is None:
            return None
        value, ts = entry
        if time.time() - ts > self._ttl:
            del self._store[key]
            return None
        return value

    def set(self, prefix: str, params: dict, value):
        """Сохраняет значение в кеш."""
        key = self._make_key(prefix, params)
        self._store[key] = (value, time.time())
        # Периодическая очистка устаревших записей (каждые 100 вставок)
        if len(self._store) % 100 == 0:
            self._cleanup()

    def _cleanup(self):
        """Удаляет устаревшие записи."""
        now = time.time()
        expired = [k for k, (_, ts) in self._store.items()
                   if now - ts > self._ttl]
        for k in expired:
            del self._store[k]


cache = SimpleCache(ttl=60)

# ============================================================
# ИНИЦИАЛИЗАЦИЯ
# ============================================================

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

POOL_MIN = int(os.getenv("DB_POOL_MIN", 2))
POOL_MAX = int(os.getenv("DB_POOL_MAX", 10))

app = FastAPI(title="dbgis API", debug=DEBUG)

# Jinja2 для шаблонов
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
jinja_env = Environment(loader=FileSystemLoader(templates_dir))

# ============================================================
# CONNECTION POOL
# ============================================================

_pool: psycopg2.pool.SimpleConnectionPool | None = None


def get_pool() -> psycopg2.pool.SimpleConnectionPool:
    """Ленивая инициализация пула соединений."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.SimpleConnectionPool(
            POOL_MIN, POOL_MAX,
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            cursor_factory=RealDictCursor
        )
    return _pool


def get_db_connection():
    """Получает соединение из пула."""
    try:
        return get_pool().getconn()
    except Exception as e:
        print(f"Ошибка подключения к БД: {e}")
        return None


def release_db_connection(conn):
    """Возвращает соединение в пул."""
    try:
        get_pool().putconn(conn)
    except Exception:
        pass


# ============================================================
# SQL-ЗАПРОСЫ (ОПТИМИЗИРОВАННЫЕ)
# ============================================================

# Основной запрос /api/companies: LATERAL JOIN вместо коррелированных подзапросов.
# PostgreSQL выполняет LATERAL один раз на строку (как JOIN),
# а не как подзапрос в SELECT (который планировщик может не оптимизировать).
# GROUP BY c.id без DISTINCT — categories агрегируются через STRING_AGG.
COMPANIES_LIST_SQL = """
    SELECT
        c.id,
        c.name,
        c.city,
        c.domain,
        c.website,
        c.created_at,
        COALESCE(ph.phones, '') as phones,
        COALESCE(em.emails, '') as emails,
        COALESCE(addr.address, '') as address,
        COALESCE(soc.socials, '') as socials,
        STRING_AGG(DISTINCT cat.name, ', ') as categories
    FROM companies c
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(p.phone, ', ' ORDER BY CASE WHEN p.source = 'enrichment' THEN 1 ELSE 2 END) as phones
        FROM phones p
        JOIN branches b ON p.branch_id = b.id
        WHERE b.company_id = c.id
    ) ph ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(e.email, ', ' ORDER BY CASE WHEN e.source = 'enrichment' THEN 1 ELSE 2 END) as emails
        FROM emails e
        WHERE e.company_id = c.id
    ) em ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(DISTINCT b.address, '; ') as address
        FROM branches b
        WHERE b.company_id = c.id
          AND b.address IS NOT NULL AND b.address != ''
          AND b.address != 'enriched'
    ) addr ON TRUE
    LEFT JOIN LATERAL (
        SELECT STRING_AGG(s.type || ':' || s.url, ', ') as socials
        FROM socials s
        WHERE s.company_id = c.id
    ) soc ON TRUE
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

# COUNT использует ту же фильтрацию, но без LATERAL (не нужны данные контактов)
COMPANIES_COUNT_SQL = """
    SELECT COUNT(DISTINCT c.id) as total
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""


def build_filter_clause(city, category, has_email, has_phone, has_website,
                        category_id=None, category_exact=None):
    """Строит WHERE-условия и параметры для фильтрации компаний.

    Приоритет фильтрации по категории:
    1. category_id — точный ID категории из БД (наивысший приоритет)
    2. category_exact — точное совпадение имени (cat.name = ...)
    3. category — ILIKE поиск (fallback)
    """
    clauses = []
    params = []

    if city:
        clauses.append("c.city ILIKE %s")
        params.append(f"%{city}%")

    if category_id:
        # Точный поиск по ID категории (включая дочерние)
        clauses.append(
            "(cat.id = %s OR cat.parent_id = %s)"
        )
        params.extend([category_id, category_id])
    elif category_exact:
        clauses.append("cat.name = %s")
        params.append(category_exact)
    elif category:
        clauses.append("cat.name ILIKE %s")
        params.append(f"%{category}%")

    if has_email:
        clauses.append("EXISTS (SELECT 1 FROM emails WHERE company_id = c.id)")

    if has_phone:
        clauses.append(
            "EXISTS (SELECT 1 FROM phones p "
            "JOIN branches b ON p.branch_id = b.id "
            "WHERE b.company_id = c.id)"
        )

    if has_website:
        clauses.append("c.domain IS NOT NULL AND c.domain != ''")

    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    return where, params


def decode_rows(rows):
    """Декодирует Punycode во всех строках."""
    result = []
    for row in rows:
        d = dict(row)
        if d.get("domain"):
            d["domain"] = decode_punycode_domain(d["domain"])
        if d.get("website"):
            d["website"] = decode_punycode_domain(d["website"])
        result.append(d)
    return result


# ============================================================
# API ENDPOINTS
# ============================================================

@app.get("/health")
async def health():
    """Проверка здоровья сервера и БД."""
    conn = get_db_connection()
    if conn is None:
        return {"status": "error", "message": "Database connection failed"}
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        return {"status": "ok", "message": "API и БД работают"}
    finally:
        release_db_connection(conn)


@app.get("/api/companies")
async def get_companies(
    query: Optional[str] = Query(None, description="Текстовый поиск (AI-парсинг)"),
    city: Optional[str] = Query(None, description="Фильтр по городу (ILIKE)"),
    category: Optional[str] = Query(None, description="Фильтр по категории (ILIKE)"),
    has_email: Optional[bool] = Query(None, description="Только с email"),
    has_phone: Optional[bool] = Query(None, description="Только с телефоном"),
    has_website: Optional[bool] = Query(None, description="Только с сайтом"),
    limit: int = Query(50, ge=1, le=1000, description="Лимит результатов"),
    offset: int = Query(0, ge=0, description="Смещение")
):
    """Получить список компаний с фильтрами или AI-парсингом запроса."""

    category_id = None
    category_exact = None
    normalized_query = None
    search_method = None

    # Двухшаговая AI-категоризация если передан query
    if query and AI_PARSER_AVAILABLE:
        conn_for_ai = get_db_connection()
        if conn_for_ai:
            try:
                ai_result = resolve_category_with_ai(query, conn_for_ai)

                # Город и фильтры из AI
                city = ai_result.get("city") or city
                has_phone = ai_result.get("has_phone") or has_phone
                has_email = ai_result.get("has_email") or has_email
                has_website = ai_result.get("has_website") or has_website
                normalized_query = ai_result.get("normalized_query")

                if ai_result.get("final_category") and ai_result.get("method") == "exact":
                    # Точное совпадение — используем ID категории
                    category_id = ai_result["final_category"]["id"]
                    search_method = "exact"
                    log.info(f"[SEARCH] Используем точную категорию: id={category_id}, "
                             f"name='{ai_result['final_category']['name']}'")
                else:
                    # Fallback — ILIKE по normalized_query
                    category = normalized_query or category or query
                    search_method = "fallback"
                    log.info(f"[SEARCH] Fallback ILIKE по: '{category}'")
            except Exception as e:
                log.error(f"[SEARCH] Ошибка AI-категоризации: {e}")
                # При ошибке используем legacy парсер
                ai_filters = parse_query_with_ai(query)
                if ai_filters:
                    city = ai_filters.get("city") or city
                    category = ai_filters.get("category") or category
                    has_phone = ai_filters.get("has_phone") or has_phone
                    has_email = ai_filters.get("has_email") or has_email
                    has_website = ai_filters.get("has_website") or has_website
                search_method = "legacy"
            finally:
                release_db_connection(conn_for_ai)
        else:
            # Не удалось получить соединение для AI — legacy
            ai_filters = parse_query_with_ai(query)
            if ai_filters:
                city = ai_filters.get("city") or city
                category = ai_filters.get("category") or category
                has_phone = ai_filters.get("has_phone") or has_phone
                has_email = ai_filters.get("has_email") or has_email
                has_website = ai_filters.get("has_website") or has_website
            search_method = "legacy"
    elif query:
        # Fallback на локальный парсер если OpenAI недоступна
        ai_filters = parse_query_fallback(query)
        if ai_filters:
            city = ai_filters.get("city") or city
            category = ai_filters.get("category") or category
            has_phone = ai_filters.get("has_phone") or has_phone
            has_email = ai_filters.get("has_email") or has_email
            has_website = ai_filters.get("has_website") or has_website
        search_method = "regex"

    # Проверяем кеш
    cache_params = {
        "city": city, "category": category, "category_id": category_id,
        "has_email": has_email, "has_phone": has_phone,
        "has_website": has_website, "limit": limit, "offset": offset
    }
    cached = cache.get("companies", cache_params)
    if cached is not None:
        return cached

    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()
        where, params = build_filter_clause(
            city, category, has_email, has_phone, has_website,
            category_id=category_id, category_exact=category_exact
        )

        # Основной запрос
        sql_query = (
            COMPANIES_LIST_SQL + where +
            " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
            " ph.phones, em.emails, addr.address, soc.socials"
            " ORDER BY c.name LIMIT %s OFFSET %s"
        )
        cur.execute(sql_query, params + [limit, offset])
        rows = cur.fetchall()

        # COUNT (тот же WHERE, но без LATERAL)
        count_query = COMPANIES_COUNT_SQL + where
        cur.execute(count_query, params)
        total = cur.fetchone()["total"]

        # Если exact дал 0 результатов — fallback на ILIKE по категории
        if total == 0 and search_method == "exact" and normalized_query:
            log.warning(f"[SEARCH] Exact дал 0 результатов, fallback ILIKE категория: '{normalized_query}'")
            where, params = build_filter_clause(
                city, None, has_email, has_phone, has_website,
                category_id=None, category_exact=None
            )
            if where:
                where += " AND cat.name ILIKE %s"
            else:
                where = " WHERE cat.name ILIKE %s"
            params.append(f"%{normalized_query}%")

            sql_query = (
                COMPANIES_LIST_SQL + where +
                " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
                " ph.phones, em.emails, addr.address, soc.socials"
                " ORDER BY c.name LIMIT %s OFFSET %s"
            )
            cur.execute(sql_query, params + [limit, offset])
            rows = cur.fetchall()

            count_query = COMPANIES_COUNT_SQL + where
            cur.execute(count_query, params)
            total = cur.fetchone()["total"]
            search_method = "fallback_ilike_cat"
            log.info(f"[SEARCH] Fallback ILIKE категория: {total} компаний")

        # Если ILIKE по категории тоже дал 0 — fallback по имени компании
        if total == 0 and normalized_query:
            log.warning(f"[SEARCH] ILIKE категория дал 0, fallback по имени компании: '{normalized_query}'")
            where, params = build_filter_clause(
                city, None, has_email, has_phone, has_website,
                category_id=None, category_exact=None
            )
            if where:
                where += " AND c.name ILIKE %s"
            else:
                where = " WHERE c.name ILIKE %s"
            params.append(f"%{normalized_query}%")

            sql_query = (
                COMPANIES_LIST_SQL + where +
                " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
                " ph.phones, em.emails, addr.address, soc.socials"
                " ORDER BY c.name LIMIT %s OFFSET %s"
            )
            cur.execute(sql_query, params + [limit, offset])
            rows = cur.fetchall()

            count_query = COMPANIES_COUNT_SQL + where
            cur.execute(count_query, params)
            total = cur.fetchone()["total"]
            search_method = "fallback_name"
            log.info(f"[SEARCH] Fallback имя компании: {total} компаний")

        # Последний рубеж — поиск по исходному query (без нормализации)
        if total == 0 and query:
            original_query = query.strip()
            log.warning(f"[SEARCH] Все fallback дали 0, поиск по оригинальному запросу: '{original_query}'")
            where, params = build_filter_clause(
                city, None, has_email, has_phone, has_website,
                category_id=None, category_exact=None
            )
            # Ищем по имени компании ИЛИ по категории
            if where:
                where += " AND (c.name ILIKE %s OR cat.name ILIKE %s)"
            else:
                where = " WHERE (c.name ILIKE %s OR cat.name ILIKE %s)"
            params.extend([f"%{original_query}%", f"%{original_query}%"])

            sql_query = (
                COMPANIES_LIST_SQL + where +
                " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
                " ph.phones, em.emails, addr.address, soc.socials"
                " ORDER BY c.name LIMIT %s OFFSET %s"
            )
            cur.execute(sql_query, params + [limit, offset])
            rows = cur.fetchall()

            count_query = COMPANIES_COUNT_SQL + where
            cur.execute(count_query, params)
            total = cur.fetchone()["total"]
            search_method = "fallback_original"
            log.info(f"[SEARCH] Fallback оригинальный запрос: {total} компаний")

        cur.close()

        log.info(f"[SEARCH] RESULT COUNT: {total}, METHOD: {search_method}")

        result = {
            "total": total,
            "limit": limit,
            "offset": offset,
            "data": decode_rows(rows)
        }

        cache.set("companies", cache_params, result)
        return result

    except Exception as e:
        # Логируем ошибку
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"❌ ОШИБКА в /api/companies: {error_msg}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Ошибка при получении компаний: {str(e)[:200]}")
    finally:
        release_db_connection(conn)


@app.get("/api/companies/{company_id}")
async def get_company_detail(company_id: int):
    """Получить полную информацию о компании."""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()

        # Компания
        cur.execute(
            "SELECT * FROM companies WHERE id = %s", (company_id,)
        )
        company = cur.fetchone()
        if not company:
            raise HTTPException(status_code=404, detail="Компания не найдена")

        company_dict = dict(company)

        # Филиалы + телефоны одним запросом
        cur.execute("""
            SELECT b.id, b.address, b.postal_code, b.working_hours,
                   b.building_name, b.building_type,
                   COALESCE(
                       (SELECT STRING_AGG(p.phone, ', ' ORDER BY CASE WHEN p.source = 'enrichment' THEN 1 ELSE 2 END)
                        FROM phones p WHERE p.branch_id = b.id), ''
                   ) as phones
            FROM branches b
            WHERE b.company_id = %s
            ORDER BY b.address
        """, (company_id,))
        branches = []
        for row in cur.fetchall():
            bd = dict(row)
            bd["phones"] = [p.strip() for p in bd["phones"].split(",")
                            if p.strip()] if bd["phones"] else []
            branches.append(bd)

        # Email (сортируем: enrichment первым)
        cur.execute(
            "SELECT email FROM emails WHERE company_id = %s ORDER BY CASE WHEN source = 'enrichment' THEN 1 ELSE 2 END",
            (company_id,)
        )
        emails = [row["email"] for row in cur.fetchall()]

        # Категории
        cur.execute("""
            SELECT cat.id, cat.name, cat.parent_id
            FROM categories cat
            JOIN company_categories cc ON cat.id = cc.category_id
            WHERE cc.company_id = %s
        """, (company_id,))
        categories = [dict(row) for row in cur.fetchall()]

        # Соцсети (группируем по типу)
        cur.execute(
            "SELECT type, url FROM socials WHERE company_id = %s ORDER BY type",
            (company_id,)
        )
        socials = {}
        for row in cur.fetchall():
            stype = row["type"]
            if stype not in socials:
                socials[stype] = []
            socials[stype].append(row["url"])

        cur.close()

        if company_dict.get("domain"):
            company_dict["domain"] = decode_punycode_domain(company_dict["domain"])
        if company_dict.get("website"):
            company_dict["website"] = decode_punycode_domain(company_dict["website"])

        return {
            "company": company_dict,
            "branches": branches,
            "emails": emails,
            "categories": categories,
            "socials": socials
        }

    except HTTPException:
        raise
    except Exception as e:
        # Логируем ошибку
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"❌ ОШИБКА в /api/companies/{company_id}: {error_msg}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Ошибка при получении деталей компании: {str(e)[:200]}")
    finally:
        release_db_connection(conn)


@app.get("/api/export")
async def export_csv(
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    has_email: Optional[bool] = Query(None),
    has_phone: Optional[bool] = Query(None),
    has_website: Optional[bool] = Query(None),
    limit: int = Query(5000, ge=1, le=50000)
):
    """Экспорт результатов в CSV."""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()
        where, params = build_filter_clause(
            city, category, has_email, has_phone, has_website
        )

        query = (
            COMPANIES_LIST_SQL + where +
            " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
            " ph.phones, em.emails, addr.address, soc.socials"
            " ORDER BY c.name LIMIT %s"
        )
        cur.execute(query, params + [limit])
        rows = cur.fetchall()
        cur.close()

        # Формирование CSV
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["ID", "Название", "Город", "Домен", "Сайт",
                         "Телефоны", "Email", "Адрес", "Соцсети", "Категории"])

        for row in rows:
            domain = row["domain"] or ""
            if domain:
                domain = decode_punycode_domain(domain)
            website = row["website"] or ""
            if website:
                website = decode_punycode_domain(website)
            writer.writerow([
                row["id"],
                row["name"],
                row["city"] or "",
                domain,
                website,
                row["phones"] or "",
                row["emails"] or "",
                row["address"] or "",
                row["socials"] or "",
                row["categories"] or ""
            ])

        output.seek(0)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"dbgis_export_{timestamp}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_db_connection(conn)


# ============================================================
# EXPLAIN ANALYZE (DEBUG)
# ============================================================

@app.get("/api/debug/explain")
async def explain_query(
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    has_email: Optional[bool] = Query(None),
    has_phone: Optional[bool] = Query(None),
    has_website: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """EXPLAIN ANALYZE для отладки производительности запроса.
    Доступен только при DEBUG=true."""
    if not DEBUG:
        raise HTTPException(status_code=403, detail="Только в режиме DEBUG")

    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()
        where, params = build_filter_clause(
            city, category, has_email, has_phone, has_website
        )

        query = (
            "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " +
            COMPANIES_LIST_SQL + where +
            " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
            " ph.phones, em.emails, addr.address, soc.socials"
            " ORDER BY c.name LIMIT %s OFFSET %s"
        )
        cur.execute(query, params + [limit, offset])
        plan = [row["QUERY PLAN"] for row in cur.fetchall()]

        cur.close()
        return {"plan": plan}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_db_connection(conn)


# ============================================================
# ENRICHMENT API (ОТКЛЮЧЕНО)
# ============================================================
# Функция удалена по запросу пользователя
# @app.post("/api/enrich/start")
# async def start_enrichment(
#     batch_size: int = Query(100, ge=1, le=1000, description="Размер батча"),
#     reset: bool = Query(False, description="Сбросить все в pending перед запуском"),
# ):
# (ОТКЛЮЧЕНО - ФУНКЦИЯ УДАЛЕНА ПО ЗАПРОСУ ПОЛЬЗОВАТЕЛЯ)


# ============================================================
# WEB UI
# ============================================================

@app.get("/", response_class=HTMLResponse)
async def index():
    """Главная страница с UI для поиска."""
    try:
        template = jinja_env.get_template("index.html")
        return template.render()
    except Exception as e:
        return f"<h1>Ошибка загрузки шаблона:</h1><p>{e}</p>"


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=API_HOST,
        port=API_PORT,
        reload=DEBUG
    )
