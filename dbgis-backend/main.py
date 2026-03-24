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
import hmac
import io
import secrets
import sys
import hashlib
import logging
import subprocess
import time
from collections import defaultdict
from typing import Optional
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Query, Request, HTTPException
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from jinja2 import Environment, FileSystemLoader
from dotenv import load_dotenv

# FAISS семантический поиск категорий
try:
    from faiss_service import find_category, find_top_categories
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    log.warning("faiss_service недоступен. Семантический поиск категорий отключён.")

# AI-парсер запросов (legacy — используется только parse_query_fallback для извлечения города/фильтров)
try:
    from ai_parser import parse_query_fallback
    FALLBACK_PARSER_AVAILABLE = True
except ImportError:
    FALLBACK_PARSER_AVAILABLE = False

# Авторизация: Yandex OAuth + API keys (shadow mode)
try:
    from auth import auth_router, AuthMiddleware, init_auth_schema
    AUTH_AVAILABLE = True
except ImportError:
    AUTH_AVAILABLE = False
    log.warning("auth модуль недоступен. Авторизация отключена.")

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

# Авторизация (shadow mode — не блокирует неавторизованные запросы)
if AUTH_AVAILABLE:
    app.add_middleware(AuthMiddleware)
    app.include_router(auth_router)
    try:
        init_auth_schema()
    except Exception as e:
        log.warning(f"[AUTH] Инициализация auth пропущена: {e}")

# ============================================================
# БЕЗОПАСНОСТЬ: лимиты, rate limiting, HMAC-токены
# ============================================================

# Секрет для HMAC-токенов доступа к /api/companies/{id}
# Генерируется при старте → токены инвалидируются при рестарте
DETAIL_TOKEN_SECRET = os.getenv("DETAIL_TOKEN_SECRET", secrets.token_hex(32))

# Максимальные лимиты
MAX_EXPORT_LIMIT = 5000      # Макс. записей в одном CSV-экспорте
MAX_OFFSET = 10000            # Макс. смещение для пагинации
MIN_QUERY_LENGTH = 3          # Мин. длина текстового запроса

# Rate limiting: простой in-memory счётчик по IP
RATE_LIMIT_WINDOW = 60        # Окно в секундах
RATE_LIMIT_MAX = 30           # Макс. запросов на IP в окне

_rate_limit_store: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> bool:
    """Проверяет rate limit для IP. Возвращает True если лимит превышен."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    # Очистка старых записей
    timestamps = _rate_limit_store[client_ip]
    _rate_limit_store[client_ip] = [t for t in timestamps if t > window_start]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        return True
    _rate_limit_store[client_ip].append(now)
    return False


def _generate_detail_token(company_id: int) -> str:
    """Генерирует HMAC-токен для доступа к деталям компании."""
    msg = f"detail:{company_id}".encode()
    return hmac.new(DETAIL_TOKEN_SECRET.encode(), msg, hashlib.sha256).hexdigest()[:16]


def _verify_detail_token(company_id: int, token: str) -> bool:
    """Проверяет HMAC-токен для доступа к деталям компании."""
    expected = _generate_detail_token(company_id)
    return hmac.compare_digest(expected, token)


def _sanitize_csv_value(value: str) -> str:
    """Экранирует CSV-значения для защиты от CSV injection в Excel.
    Если строка начинается с =, +, -, @ → добавляет апостроф-префикс."""
    if value and value[0] in ('=', '+', '-', '@'):
        return "'" + value
    return value


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
    except Exception as e:
        log.error(f"[DB] Ошибка при возврате соединения в пул: {e}")


# ============================================================
# SQL-ЗАПРОСЫ (ОПТИМИЗИРОВАННЫЕ)
# ============================================================

# Основной запрос /api/companies: LATERAL JOIN вместо коррелированных подзапросов.
# PostgreSQL выполняет LATERAL один раз на строку (как JOIN),
# а не как подзапрос в SELECT (который планировщик может не оптимизировать).
# GROUP BY c.id без DISTINCT — categories агрегируются через STRING_AGG.
#
# ОПТИМИЗАЦИЯ: двухфазный запрос.
# Фаза 1 (CTE filtered): фильтрация + сортировка + LIMIT/OFFSET без LATERAL.
#   EXISTS вместо STRING_AGG для определения has_phones/has_emails (тот же boolean).
# Фаза 2: LATERAL только для отобранных строк (≤ LIMIT, обычно 100).
#   Без двухфазности LATERAL выполняется для ВСЕХ строк WHERE (тысячи в coverage mode).

# --- Фаза 1: фильтрация company_id (без LATERAL — быстро) ---
# {where} и {having} подставляются из build_filter_clause()
# {order_by}, LIMIT, OFFSET подставляются из вызывающего кода
COMPANIES_FILTER_SQL = """
    SELECT c.id,
           (EXISTS (
               SELECT 1 FROM phones p
               JOIN branches b ON p.branch_id = b.id
               WHERE b.company_id = c.id
           )) as has_phones,
           (EXISTS (
               SELECT 1 FROM emails e WHERE e.company_id = c.id
           )) as has_emails,
           (c.domain IS NOT NULL AND c.domain != '') as has_domain
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""

# --- Фаза 2: подгрузка данных для отобранных id (LATERAL только здесь) ---
# Разделена на FROM (до WHERE) и GROUP BY (после WHERE).
# Между ними вставляется {enrich_where} — фильтр по cc.category_id,
# чтобы STRING_AGG(cat.name) показывал ТОЛЬКО совпавшие категории
# (идентично старому запросу, где WHERE фильтровал и компании, и категории).
COMPANIES_ENRICH_FROM = """
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
    FROM filtered f
    JOIN companies c ON c.id = f.id
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

COMPANIES_ENRICH_GROUP = """
    GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,
             ph.phones, em.emails, addr.address, soc.socials,
             f.has_phones, f.has_emails, f.has_domain
"""

# --- Старый монолитный запрос (закомментирован, сохранён для сравнения) ---
# COMPANIES_LIST_SQL_OLD = """
#     SELECT
#         c.id, c.name, c.city, c.domain, c.website, c.created_at,
#         COALESCE(ph.phones, '') as phones,
#         COALESCE(em.emails, '') as emails,
#         COALESCE(addr.address, '') as address,
#         COALESCE(soc.socials, '') as socials,
#         STRING_AGG(DISTINCT cat.name, ', ') as categories
#     FROM companies c
#     LEFT JOIN LATERAL (...phones...) ph ON TRUE
#     LEFT JOIN LATERAL (...emails...) em ON TRUE
#     LEFT JOIN LATERAL (...address...) addr ON TRUE
#     LEFT JOIN LATERAL (...socials...) soc ON TRUE
#     LEFT JOIN company_categories cc ON c.id = cc.company_id
#     LEFT JOIN categories cat ON cc.category_id = cat.id
# """
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

# COUNT: без LATERAL (не нужны данные контактов).
# Оптимизация: LEFT JOIN categories убран (не нужен для подсчёта, кроме ILIKE по cat.name).
# Когда фильтр по cat.name ILIKE — используется COMPANIES_COUNT_SQL_WITH_CAT.
COMPANIES_COUNT_SQL = """
    SELECT COUNT(DISTINCT c.id) as total
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
"""

# COUNT с JOIN categories — только для фильтра cat.name ILIKE
COMPANIES_COUNT_SQL_WITH_CAT = """
    SELECT COUNT(DISTINCT c.id) as total
    FROM companies c
    LEFT JOIN company_categories cc ON c.id = cc.company_id
    LEFT JOIN categories cat ON cc.category_id = cat.id
"""


def build_filter_clause(city, category, has_email, has_phone, has_website,
                        category_ids=None, category_filter_ids=None,
                        city_ids=None):
    """Строит WHERE-условия и параметры для фильтрации компаний.

    city_ids — жёсткий гео-фильтр (приоритет над city).
    category_filter_ids — AND-пересечение (HAVING COUNT(DISTINCT) = len).
    category_ids — OR по любой из категорий (FAISS).
    category — ILIKE поиск.
    """
    clauses = []
    params = []
    having = ""
    having_params = []

    # Гео-фильтр: city_ids (из UI) имеет приоритет над city (из текста)
    if city_ids:
        clauses.append("c.city_id = ANY(%s)")
        params.append(list(city_ids))
    elif city:
        clauses.append("c.city ILIKE %s")
        params.append(f"%{city}%")

    if category_filter_ids and len(category_filter_ids) >= 2:
        # AND-пересечение: компания должна иметь ВСЕ указанные категории
        clauses.append("cc.category_id = ANY(%s)")
        params.append(list(category_filter_ids))
        having = " HAVING COUNT(DISTINCT cc.category_id) = %s"
        having_params.append(len(category_filter_ids))
    elif category_filter_ids and len(category_filter_ids) == 1:
        # Одна категория — простой фильтр без HAVING
        clauses.append("cc.category_id = %s")
        params.append(category_filter_ids[0])
    elif category_ids:
        clauses.append("cc.category_id = ANY(%s)")
        params.append(list(category_ids))
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
    return where, params, having, having_params


def _build_enrich_category_filter(category_ids, category_filter_ids, category):
    """Строит WHERE-фильтр для фазы 2 (ENRICH), чтобы STRING_AGG(cat.name)
    показывал только совпавшие категории (идентично старому запросу).

    В старом монолитном запросе WHERE cc.category_id = ANY(...) фильтровал
    и компании, и видимые категории одновременно. В двухфазном запросе
    CTE фильтрует компании, а этот WHERE — видимые категории.
    """
    if category_filter_ids:
        return " WHERE cc.category_id = ANY(%s)", [list(category_filter_ids)]
    elif category_ids:
        return " WHERE cc.category_id = ANY(%s)", [list(category_ids)]
    elif category:
        return " WHERE cat.name ILIKE %s", [f"%{category}%"]
    return "", []


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

# ============================================================
# ГОРОДА: кеш для детекции в запросе
# ============================================================

_cities_cache: list[dict] | None = None
_cities_cache_ts: float = 0


def _load_cities_cache() -> list[dict]:
    """Загружает список городов из БД (кешируется на 5 минут)."""
    global _cities_cache, _cities_cache_ts
    if _cities_cache is not None and time.time() - _cities_cache_ts < 300:
        return _cities_cache

    conn = get_db_connection()
    if conn is None:
        return _cities_cache or []
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, name, normalized_name FROM cities ORDER BY name")
        _cities_cache = [dict(r) for r in cur.fetchall()]
        _cities_cache_ts = time.time()
        cur.close()
        return _cities_cache
    except Exception:
        return _cities_cache or []
    finally:
        release_db_connection(conn)


def detect_city_in_query(query: str) -> dict | None:
    """Ищет название города в тексте запроса (case-insensitive).

    Возвращает {"id": int, "name": str} или None.
    Приоритет — самое длинное совпадение (чтобы "Нижний Новгород" > "Новгород").
    """
    cities = _load_cities_cache()
    if not cities:
        return None

    q_lower = query.lower()
    best = None
    best_len = 0
    for city in cities:
        # Ищем по normalized_name (lowercase) в lowercase запросе
        cname = city["normalized_name"]
        if cname in q_lower and len(cname) > best_len:
            best = {"id": city["id"], "name": city["name"]}
            best_len = len(cname)
    return best


@app.get("/api/cities")
async def get_cities(
    q: Optional[str] = Query(None, description="Поиск по названию города"),
    limit: int = Query(20, ge=1, le=100)
):
    """Список городов для autocomplete."""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()
        if q and q.strip():
            # ILIKE поиск по названию
            cur.execute("""
                SELECT ci.id, ci.name,
                       (SELECT COUNT(*) FROM companies c WHERE c.city_id = ci.id) as company_count
                FROM cities ci
                WHERE ci.normalized_name ILIKE %s
                ORDER BY
                    CASE WHEN ci.normalized_name = %s THEN 0 ELSE 1 END,
                    ci.name
                LIMIT %s
            """, (f"%{q.strip().lower()}%", q.strip().lower(), limit))
        else:
            # Топ городов по количеству компаний
            cur.execute("""
                SELECT ci.id, ci.name,
                       (SELECT COUNT(*) FROM companies c WHERE c.city_id = ci.id) as company_count
                FROM cities ci
                ORDER BY company_count DESC, ci.name
                LIMIT %s
            """, (limit,))

        cities = [dict(r) for r in cur.fetchall()]
        cur.close()
        return {"cities": cities}
    finally:
        release_db_connection(conn)


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
    request: Request,
    query: Optional[str] = Query(None, description="Текстовый поиск (AI-парсинг)"),
    city: Optional[str] = Query(None, description="Фильтр по городу (ILIKE)"),
    category: Optional[str] = Query(None, description="Фильтр по категории (ILIKE)"),
    has_email: Optional[bool] = Query(None, description="Только с email"),
    has_phone: Optional[bool] = Query(None, description="Только с телефоном"),
    has_website: Optional[bool] = Query(None, description="Только с сайтом"),
    category_filter_ids: Optional[str] = Query(None, description="Фильтр по ID категорий (через запятую, AND-пересечение)"),
    city_ids: Optional[str] = Query(None, description="Фильтр по ID городов (через запятую)"),
    mode: str = Query("precision", description="Режим: precision | coverage"),
    limit: int = Query(100, ge=1, le=1000, description="Лимит результатов"),
    offset: int = Query(0, ge=0, description="Смещение")
):
    """Получить список компаний с фильтрами или AI-парсингом запроса."""

    # RATE LIMIT
    client_ip = request.client.host if request.client else "unknown"
    if _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Слишком много запросов. Попробуйте через минуту.")

    # GUARD: ограничение offset (защита от enumeration через пагинацию)
    if offset > MAX_OFFSET:
        return {"total": 0, "limit": limit, "offset": offset, "data": [], "search_method": None}

    # GUARD: пустой запрос без фильтров → пустой результат (защита от выгрузки всей БД)
    has_any_filter = (
        query or city or category or
        has_email or has_phone or has_website or
        category_filter_ids or city_ids
    )
    if not has_any_filter:
        return {"total": 0, "limit": limit, "offset": offset, "data": [], "search_method": None}

    # GUARD: слишком короткий query (защита от "а", "1" → вся база)
    if query and len(query.strip()) < MIN_QUERY_LENGTH:
        return {"total": 0, "limit": limit, "offset": offset, "data": [], "search_method": None}

    # Парсинг category_filter_ids из строки "19,25,42" в список int
    parsed_filter_ids = []
    if category_filter_ids:
        try:
            parsed_filter_ids = [int(x.strip()) for x in category_filter_ids.split(",") if x.strip()]
        except ValueError:
            pass

    # Парсинг city_ids из строки "1,5,12" в список int
    parsed_city_ids = []
    if city_ids:
        try:
            parsed_city_ids = [int(x.strip()) for x in city_ids.split(",") if x.strip()]
        except ValueError:
            pass

    category_ids = None
    search_method = None

    # FAISS семантический поиск категорий
    if query and FAISS_AVAILABLE:
        top_categories = find_top_categories(query, k=3)
        faiss_ids = set()
        for cat in top_categories:
            faiss_ids.update(cat["ids"])
        search_method = "faiss"

        print(f"MODE: {mode}")
        print(f"FAISS CATEGORIES: {[c['name'] for c in top_categories]}")
        print(f"FAISS CATEGORY_IDS: {len(faiss_ids)} (тип: category_id)")

        if mode == "coverage":
            # Recursive CTE — все дочерние категории через parent_id.
            # Используем отдельный коннект из пула (основной conn создаётся позже
            # после определения всех параметров фильтрации).
            expand_conn = get_db_connection()
            if expand_conn is None:
                raise HTTPException(status_code=503, detail="Database unavailable (expand)")
            try:
                expand_cur = expand_conn.cursor()
                expand_cur.execute("""
                    WITH RECURSIVE subcategories AS (
                        SELECT id FROM categories WHERE id = ANY(%s)
                        UNION ALL
                        SELECT c.id FROM categories c
                        JOIN subcategories s ON c.parent_id = s.id
                    )
                    SELECT id FROM subcategories
                """, (list(faiss_ids),))
                expanded_ids = [row["id"] for row in expand_cur.fetchall()]
                expand_cur.close()
            finally:
                release_db_connection(expand_conn)

            all_ids = set(faiss_ids)
            all_ids.update(expanded_ids)
            category_ids = list(all_ids)
            print(f"EXPANDED IDS: {len(expanded_ids)}")
        else:
            # precision — только faiss_ids
            category_ids = list(faiss_ids)

        print(f"IDS COUNT: {len(category_ids)}")
        log.info(f"[SEARCH] mode={mode}, FAISS: {[c['name'] for c in top_categories]}, ids={len(category_ids)}")

        # category_filter_ids OVERRIDE: клик по категориям заменяет FAISS-результат
        if parsed_filter_ids:
            category_ids = parsed_filter_ids
            print(f"CATEGORY FILTER OVERRIDE: {parsed_filter_ids}")

        # Извлекаем город и фильтры контактов из запроса (простой парсер)
        if FALLBACK_PARSER_AVAILABLE:
            filters = parse_query_fallback(query)
            if filters:
                city = filters.get("city") or city
                has_phone = filters.get("has_phone") or has_phone
                has_email = filters.get("has_email") or has_email
                has_website = filters.get("has_website") or has_website

    elif query and FALLBACK_PARSER_AVAILABLE:
        # FAISS недоступен — regex парсер (только город/фильтры)
        filters = parse_query_fallback(query)
        if filters:
            city = filters.get("city") or city
            category = filters.get("category") or category
            has_phone = filters.get("has_phone") or has_phone
            has_email = filters.get("has_email") or has_email
            has_website = filters.get("has_website") or has_website
        search_method = "regex"

    # category_filter_ids OVERRIDE без query (клик по категориям без текстового поиска)
    if parsed_filter_ids and not category_ids:
        category_ids = parsed_filter_ids
        print(f"CATEGORY FILTER OVERRIDE (no query): {parsed_filter_ids}")

    # Детекция города в запросе → жёсткий фильтр (пользователь явно указал город)
    if query and not parsed_city_ids:
        detected = detect_city_in_query(query)
        if detected:
            parsed_city_ids = [detected["id"]]
            print(f"DETECTED CITY: {detected['name']} (id={detected['id']}) → APPLIED AS FILTER")

    # Если city_ids заданы (из UI или из детекции) — НЕ использовать текстовый city
    suggested_city = None
    if parsed_city_ids:
        city = None
        print(f"CITY_IDS FILTER: {parsed_city_ids}")

    # Проверяем кеш
    cache_params = {
        "city": city, "category": category,
        "category_ids": tuple(category_ids) if category_ids else None,
        "category_filter_ids": tuple(parsed_filter_ids) if parsed_filter_ids else None,
        "city_ids": tuple(parsed_city_ids) if parsed_city_ids else None,
        "has_email": has_email, "has_phone": has_phone,
        "has_website": has_website, "mode": mode,
        "limit": limit, "offset": offset
    }
    cached = cache.get("companies", cache_params)
    if cached is not None:
        return cached

    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()
        where, params, having, having_params = build_filter_clause(
            city, category, has_email, has_phone, has_website,
            category_ids=category_ids,
            category_filter_ids=parsed_filter_ids,
            city_ids=parsed_city_ids
        )

        # --- Двухфазный запрос (оптимизация: LATERAL только для LIMIT строк) ---
        # Фаза 1: CTE filtered — фильтрация + сортировка + LIMIT (без LATERAL)
        # Фаза 2: LATERAL подгрузка данных только для отобранных company_id
        #
        # EXISTS в фазе 1 эквивалентен (COALESCE(STRING_AGG(...), '') != '') из старого запроса:
        #   STRING_AGG по пустому набору → NULL → COALESCE(NULL, '') → '' → ('' != '') = false
        #   EXISTS по пустому набору → false
        # Результат идентичен.
        #
        # CRITICAL: enrich_where фильтрует категории в фазе 2, чтобы STRING_AGG(cat.name)
        # показывал ТОЛЬКО совпавшие категории (как в старом запросе, где WHERE фильтровал
        # и компании, и видимые категории одновременно).
        enrich_where, enrich_params = _build_enrich_category_filter(
            category_ids, parsed_filter_ids, category
        )

        sql_query = (
            "WITH filtered AS ("
            + COMPANIES_FILTER_SQL + where
            + " GROUP BY c.id" + having
            + " ORDER BY has_phones DESC, has_emails DESC, has_domain DESC, c.name ASC"
            + " LIMIT %s OFFSET %s"
            + ")"
            + COMPANIES_ENRICH_FROM
            + enrich_where
            + COMPANIES_ENRICH_GROUP
            + " ORDER BY f.has_phones DESC, f.has_emails DESC, f.has_domain DESC, c.name ASC"
        )
        cur.execute(sql_query, params + having_params + [limit, offset] + enrich_params)
        rows = cur.fetchall()

        # --- Старый монолитный запрос (закомментирован для сравнения) ---
        # order_clause = (
        #     " ORDER BY"
        #     " (COALESCE(ph.phones, '') != '') DESC,"
        #     " (COALESCE(em.emails, '') != '') DESC,"
        #     " (c.domain IS NOT NULL AND c.domain != '') DESC,"
        #     " c.name ASC"
        # )
        # sql_query = (
        #     COMPANIES_LIST_SQL + where +
        #     " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
        #     " ph.phones, em.emails, addr.address, soc.socials"
        #     + having + order_clause + " LIMIT %s OFFSET %s"
        # )
        # cur.execute(sql_query, params + having_params + [limit, offset])
        # rows = cur.fetchall()

        # COUNT (с HAVING для AND-пересечения)
        # Оптимизация: JOIN categories убран, если фильтр не по cat.name ILIKE
        needs_cat_join = bool(category)
        if having:
            count_query = (
                "SELECT COUNT(*) as total FROM ("
                "  SELECT c.id FROM companies c"
                "  LEFT JOIN company_categories cc ON c.id = cc.company_id"
                + ("  LEFT JOIN categories cat ON cc.category_id = cat.id" if needs_cat_join else "")
                + where
                + "  GROUP BY c.id" + having
                + ") sub"
            )
            cur.execute(count_query, params + having_params)
        else:
            count_base = COMPANIES_COUNT_SQL_WITH_CAT if needs_cat_join else COMPANIES_COUNT_SQL
            count_query = count_base + where
            cur.execute(count_query, params)
        total = cur.fetchone()["total"]

        cur.close()

        print(f"RESULT COUNT: {total}, METHOD: {search_method}, MODE: {mode}")
        log.info(f"[SEARCH] RESULT COUNT: {total}, METHOD: {search_method}, MODE: {mode}")

        decoded_data = decode_rows(rows)

        # Генерируем HMAC-токены для доступа к деталям каждой компании
        for item in decoded_data:
            item["_detail_token"] = _generate_detail_token(item["id"])

        result = {
            "total": total,
            "limit": limit,
            "offset": offset,
            "data": decoded_data
        }

        # Подсказка города (только если город НЕ был автоматически определён из текста)
        if suggested_city:
            result["suggested_city"] = suggested_city

        cache.set("companies", cache_params, result)
        return result
    finally:
        release_db_connection(conn)


@app.get("/api/companies/{company_id}")
async def get_company_detail(
    company_id: int,
    request: Request,
    token: str = Query(..., description="HMAC-токен доступа (из результатов поиска)")
):
    """Получить полную информацию о компании.
    Требует HMAC-токен, выданный при поиске через /api/companies."""

    # RATE LIMIT
    client_ip = request.client.host if request.client else "unknown"
    if _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Слишком много запросов. Попробуйте через минуту.")

    # Проверка HMAC-токена (защита от перебора ID)
    if not _verify_detail_token(company_id, token):
        raise HTTPException(status_code=403, detail="Недействительный токен доступа")

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
    request: Request,
    query: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    has_email: Optional[bool] = Query(None),
    has_phone: Optional[bool] = Query(None),
    has_website: Optional[bool] = Query(None),
    city_ids: Optional[str] = Query(None, description="Фильтр по ID городов"),
    mode: str = Query("precision", description="Режим: precision | coverage"),
    limit: int = Query(MAX_EXPORT_LIMIT, ge=1, le=MAX_EXPORT_LIMIT)
):
    """Экспорт результатов в CSV (макс. MAX_EXPORT_LIMIT записей)."""

    # RATE LIMIT
    client_ip = request.client.host if request.client else "unknown"
    if _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Слишком много запросов. Попробуйте через минуту.")

    # Принудительное ограничение лимита (на случай обхода валидации FastAPI)
    limit = min(limit, MAX_EXPORT_LIMIT)

    # GUARD: пустой запрос без фильтров → пустой CSV (защита от выгрузки всей БД)
    has_any_filter = (
        query or city or category or
        has_email or has_phone or has_website or
        city_ids
    )
    if not has_any_filter:
        return Response(
            content="Название,Город,Домен,Сайт,Телефоны,Email,Адрес,Соцсети,Категории\n",
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=empty_export.csv"}
        )

    # GUARD: слишком короткий query (защита от "а", "1" → вся база)
    if query and len(query.strip()) < MIN_QUERY_LENGTH:
        return Response(
            content="Название,Город,Домен,Сайт,Телефоны,Email,Адрес,Соцсети,Категории\n",
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=empty_export.csv"}
        )

    # Парсинг city_ids
    parsed_city_ids = []
    if city_ids:
        try:
            parsed_city_ids = [int(x.strip()) for x in city_ids.split(",") if x.strip()]
        except ValueError:
            pass

    # FAISS-поиск для экспорта (аналогично /api/companies)
    category_ids = None
    if query and FAISS_AVAILABLE:
        top_categories = find_top_categories(query, k=3)
        faiss_ids = set()
        for cat in top_categories:
            faiss_ids.update(cat["ids"])

        if mode == "coverage":
            expand_conn = get_db_connection()
            if expand_conn is None:
                raise HTTPException(status_code=503, detail="Database unavailable (expand)")
            try:
                expand_cur = expand_conn.cursor()
                expand_cur.execute("""
                    WITH RECURSIVE subcategories AS (
                        SELECT id FROM categories WHERE id = ANY(%s)
                        UNION ALL
                        SELECT c.id FROM categories c
                        JOIN subcategories s ON c.parent_id = s.id
                    )
                    SELECT id FROM subcategories
                """, (list(faiss_ids),))
                expanded_ids = [row["id"] for row in expand_cur.fetchall()]
                expand_cur.close()
            finally:
                release_db_connection(expand_conn)

            all_ids = set(faiss_ids)
            all_ids.update(expanded_ids)
            category_ids = list(all_ids)
        else:
            category_ids = list(faiss_ids)

        log.info(f"[EXPORT] mode={mode}, FAISS: {[c['name'] for c in top_categories]}, ids={len(category_ids)}")

        # Извлекаем город и фильтры из запроса
        if FALLBACK_PARSER_AVAILABLE:
            filters = parse_query_fallback(query)
            if filters:
                city = filters.get("city") or city
                has_phone = filters.get("has_phone") or has_phone
                has_email = filters.get("has_email") or has_email
                has_website = filters.get("has_website") or has_website

    # Детекция города в запросе → жёсткий фильтр (аналогично /api/companies)
    if query and not parsed_city_ids:
        detected = detect_city_in_query(query)
        if detected:
            parsed_city_ids = [detected["id"]]
            print(f"[EXPORT] DETECTED CITY: {detected['name']} (id={detected['id']}) → APPLIED AS FILTER")

    # Если city_ids заданы — не использовать текстовый city
    if parsed_city_ids:
        city = None

    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()
        where, params, having, having_params = build_filter_clause(
            city, category, has_email, has_phone, has_website,
            category_ids=category_ids,
            city_ids=parsed_city_ids
        )

        # Двухфазный запрос (аналогично /api/companies)
        # Export сортирует по c.name, не по has_phones/has_emails
        enrich_where, enrich_params = _build_enrich_category_filter(
            category_ids, None, category  # export не имеет category_filter_ids
        )

        export_query = (
            "WITH filtered AS ("
            + COMPANIES_FILTER_SQL + where
            + " GROUP BY c.id" + having
            + " ORDER BY c.name ASC"
            + " LIMIT %s"
            + ")"
            + COMPANIES_ENRICH_FROM
            + enrich_where
            + COMPANIES_ENRICH_GROUP
            + " ORDER BY c.name ASC"
        )
        cur.execute(export_query, params + having_params + [limit] + enrich_params)
        rows = cur.fetchall()

        # --- Старый монолитный запрос (закомментирован для сравнения) ---
        # query = (
        #     COMPANIES_LIST_SQL + where +
        #     " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
        #     " ph.phones, em.emails, addr.address, soc.socials"
        #     + having + " ORDER BY c.name LIMIT %s"
        # )
        # cur.execute(query, params + having_params + [limit])
        # rows = cur.fetchall()

        cur.close()

        # Формирование CSV
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Название", "Город", "Домен", "Сайт",
                         "Телефоны", "Email", "Адрес", "Соцсети", "Категории"])

        for row in rows:
            domain = row["domain"] or ""
            if domain:
                domain = decode_punycode_domain(domain)
            website = row["website"] or ""
            if website:
                website = decode_punycode_domain(website)
            # Санитизация CSV (защита от CSV injection в Excel: =, +, -, @)
            writer.writerow([
                _sanitize_csv_value(row["name"]),
                _sanitize_csv_value(row["city"] or ""),
                _sanitize_csv_value(domain),
                _sanitize_csv_value(website),
                _sanitize_csv_value(row["phones"] or ""),
                _sanitize_csv_value(row["emails"] or ""),
                _sanitize_csv_value(row["address"] or ""),
                _sanitize_csv_value(row["socials"] or ""),
                _sanitize_csv_value(row["categories"] or "")
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
        print(f"❌ ОШИБКА в /api/export: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=500, detail="Ошибка при экспорте данных")
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
        where, params, having, having_params = build_filter_clause(
            city, category, has_email, has_phone, has_website
        )

        query = (
            "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " +
            COMPANIES_LIST_SQL + where +
            " GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at,"
            " ph.phones, em.emails, addr.address, soc.socials"
            + having + " ORDER BY c.name LIMIT %s OFFSET %s"
        )
        cur.execute(query, params + having_params + [limit, offset])
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
