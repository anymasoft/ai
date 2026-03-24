#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Модуль авторизации: Yandex OAuth + API keys.

Все данные хранятся в схеме `auth` (PostgreSQL), изолированно от бизнес-данных.
Shadow mode: если X-API-Key не передан — запрос пропускается без авторизации.

ЗАПРЕТ: никаких FK между auth.* и public.* — иначе CASCADE из clean_postgres.py
может зацепить auth-данные. Схемы полностью изолированы.

Использование:
    from auth import auth_router, AuthMiddleware, get_current_user

    app.add_middleware(AuthMiddleware)
    app.include_router(auth_router)

Env vars (.env):
    YANDEX_CLIENT_ID      — ID приложения Yandex OAuth
    YANDEX_CLIENT_SECRET   — Секрет приложения Yandex OAuth
    AUTH_CALLBACK_URL      — URL для callback (default: http://localhost:8000/auth/yandex/callback)
"""

import hashlib
import logging
import os
import secrets
import time
from collections import defaultdict
from typing import Optional

import httpx
import psycopg2
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger(__name__)

# ============================================================
# КОНФИГУРАЦИЯ
# ============================================================

YANDEX_CLIENT_ID = os.getenv("YANDEX_CLIENT_ID", "")
YANDEX_CLIENT_SECRET = os.getenv("YANDEX_CLIENT_SECRET", "")
AUTH_CALLBACK_URL = os.getenv(
    "AUTH_CALLBACK_URL", "http://localhost:8000/auth/yandex/callback"
)

YANDEX_AUTH_URL = "https://oauth.yandex.ru/authorize"
YANDEX_TOKEN_URL = "https://oauth.yandex.ru/token"
YANDEX_USERINFO_URL = "https://login.yandex.ru/info"

# Длина raw API key (32 байта = 64 hex символа)
API_KEY_BYTES = 32

# Rate limiting per API key (в дополнение к IP-based rate limit из main.py)
AUTH_RATE_LIMIT_WINDOW = 60   # секунд
AUTH_RATE_LIMIT_MAX = 60      # запросов в минуту на ключ

auth_router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory хранилище OAuth state (CSRF protection)
# state → timestamp. Очищается при проверке.
_oauth_states: dict[str, float] = {}
OAUTH_STATE_TTL = 300  # 5 минут на завершение OAuth flow

# In-memory rate limit per API key (user_id → [timestamps])
_auth_rate_limit_store: dict[str, list[float]] = defaultdict(list)


# ============================================================
# УТИЛИТЫ
# ============================================================

def _hash_api_key(raw_key: str) -> str:
    """SHA-256 хэш API ключа. Raw key НИКОГДА не хранится."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _generate_raw_api_key() -> str:
    """Генерирует криптографически стойкий API ключ."""
    return secrets.token_hex(API_KEY_BYTES)


def _get_auth_connection():
    """Получает соединение с БД для auth-операций.

    Использует те же параметры подключения, что и main.py (из .env).
    Отдельное соединение — auth не зависит от пула main.py.
    """
    from dotenv import load_dotenv
    load_dotenv()

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "dbgis"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
    )


def _check_auth_rate_limit(user_id: str) -> bool:
    """Проверяет rate limit для конкретного API ключа (user_id).

    Returns:
        True если лимит превышен, False если OK.
    """
    now = time.time()
    window_start = now - AUTH_RATE_LIMIT_WINDOW
    _auth_rate_limit_store[user_id] = [
        t for t in _auth_rate_limit_store[user_id] if t > window_start
    ]
    if len(_auth_rate_limit_store[user_id]) >= AUTH_RATE_LIMIT_MAX:
        return True
    _auth_rate_limit_store[user_id].append(now)
    return False


def _generate_oauth_state() -> str:
    """Генерирует и сохраняет OAuth state для CSRF protection."""
    # Очищаем старые state (старше TTL)
    now = time.time()
    expired = [s for s, t in _oauth_states.items() if now - t > OAUTH_STATE_TTL]
    for s in expired:
        del _oauth_states[s]

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = now
    return state


def _verify_oauth_state(state: str) -> bool:
    """Проверяет и потребляет OAuth state (одноразовый)."""
    if state not in _oauth_states:
        return False
    created_at = _oauth_states.pop(state)
    return (time.time() - created_at) < OAUTH_STATE_TTL


def _check_auth_schema(conn) -> bool:
    """Проверяет наличие схемы auth и таблиц. Без CREATE — только проверка.

    Схема и таблицы создаются ТОЛЬКО через миграцию (003_auth_schema.sql).
    Runtime-код не должен менять структуру БД.
    """
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = 'auth' AND table_name IN ('users', 'api_keys')"
        )
        count = cur.fetchone()[0]
        return count == 2
    except Exception:
        return False
    finally:
        cur.close()


# ============================================================
# CRUD: ПОЛЬЗОВАТЕЛИ И API КЛЮЧИ
# ============================================================

def _find_or_create_user(conn, yandex_id: str, email: Optional[str] = None) -> dict:
    """Находит или создаёт пользователя по yandex_id.

    Returns:
        dict с полями: id, external_id, email, plan, credits, created_at, is_new
    """
    cur = conn.cursor()
    try:
        # Ищем существующего
        cur.execute(
            "SELECT id, external_id, email, plan, credits, created_at "
            "FROM auth.users WHERE external_id = %s",
            (yandex_id,)
        )
        row = cur.fetchone()
        if row:
            return {
                "id": str(row[0]),
                "external_id": row[1],
                "email": row[2],
                "plan": row[3],
                "credits": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "is_new": False,
            }

        # Создаём нового
        cur.execute(
            "INSERT INTO auth.users (external_id, email) VALUES (%s, %s) "
            "RETURNING id, external_id, email, plan, credits, created_at",
            (yandex_id, email)
        )
        row = cur.fetchone()
        conn.commit()
        return {
            "id": str(row[0]),
            "external_id": row[1],
            "email": row[2],
            "plan": row[3],
            "credits": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
            "is_new": True,
        }
    finally:
        cur.close()


def _create_api_key(conn, user_id: str, name: str = "default") -> str:
    """Создаёт API ключ для пользователя.

    Returns:
        raw API key (возвращается ОДИН раз, потом недоступен)
    """
    raw_key = _generate_raw_api_key()
    key_hash = _hash_api_key(raw_key)

    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO auth.api_keys (user_id, key_hash, name) VALUES (%s, %s, %s)",
            (user_id, key_hash, name)
        )
        conn.commit()
        return raw_key
    finally:
        cur.close()


def _find_user_by_api_key(conn, raw_key: str) -> Optional[dict]:
    """Ищет пользователя по raw API ключу (хэшируем и ищем).

    Returns:
        dict с полями пользователя или None
    """
    key_hash = _hash_api_key(raw_key)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT u.id, u.external_id, u.email, u.plan, u.credits "
            "FROM auth.api_keys ak "
            "JOIN auth.users u ON u.id = ak.user_id "
            "WHERE ak.key_hash = %s AND ak.is_active = TRUE",
            (key_hash,)
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": str(row[0]),
            "external_id": row[1],
            "email": row[2],
            "plan": row[3],
            "credits": row[4],
        }
    finally:
        cur.close()


# ============================================================
# MIDDLEWARE: Shadow Mode
# ============================================================

class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware для авторизации через X-API-Key.

    Shadow mode:
    - Нет X-API-Key → пропускаем (request.state.user = None)
    - Невалидный ключ → пропускаем + логируем (shadow mode, не ломаем UI)
    - Валидный ключ → request.state.user = dict с данными пользователя
    - Ошибка БД → пропускаем (не блокируем сервис)

    В shadow mode НЕТ 401 на невалидный ключ — иначе UI начнёт падать
    при случайном мусорном заголовке. 401 только на защищённых эндпоинтах
    (/auth/me, /auth/api-key/regenerate) через явную проверку get_current_user().
    """

    async def dispatch(self, request: Request, call_next):
        # По умолчанию — анонимный пользователь
        request.state.user = None

        api_key = request.headers.get("X-API-Key")
        if api_key:
            conn = None
            try:
                conn = _get_auth_connection()
                user = _find_user_by_api_key(conn, api_key)
                if user is None:
                    # Shadow mode: логируем, но НЕ блокируем запрос
                    log.warning("[AUTH] Невалидный API ключ (shadow mode — пропускаем)")
                else:
                    # Проверяем rate limit per API key
                    if _check_auth_rate_limit(user["id"]):
                        return JSONResponse(
                            status_code=429,
                            content={"detail": "Превышен лимит запросов для API ключа"}
                        )
                    request.state.user = user
            except Exception as e:
                log.error(f"[AUTH] Ошибка проверки API ключа: {e}")
                # При ошибке БД — пропускаем (shadow mode, не блокируем сервис)
            finally:
                if conn:
                    conn.close()

        response = await call_next(request)
        return response


# ============================================================
# HELPER: get_current_user
# ============================================================

def get_current_user(request: Request) -> Optional[dict]:
    """Извлекает текущего пользователя из request.state.

    Возвращает dict с полями пользователя или None (shadow mode).

    Пример использования в endpoint:
        @app.get("/api/some-endpoint")
        async def some_endpoint(request: Request):
            user = get_current_user(request)
            if user:
                # Авторизованный запрос
                log.info(f"Запрос от пользователя {user['id']}")
            # Логика работает в любом случае (shadow mode)
    """
    return getattr(request.state, "user", None)


# ============================================================
# ENDPOINTS: Yandex OAuth
# ============================================================

@auth_router.get("/yandex/login")
async def yandex_login():
    """Редирект на страницу авторизации Yandex OAuth.

    Генерирует state параметр для CSRF protection.
    """
    if not YANDEX_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Yandex OAuth не настроен. Укажите YANDEX_CLIENT_ID в .env"
        )

    state = _generate_oauth_state()
    params = {
        "response_type": "code",
        "client_id": YANDEX_CLIENT_ID,
        "redirect_uri": AUTH_CALLBACK_URL,
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{YANDEX_AUTH_URL}?{query}")


@auth_router.get("/yandex/callback")
async def yandex_callback(
    code: str = Query(..., description="Код авторизации от Yandex"),
    state: str = Query(..., description="CSRF state параметр"),
):
    """Callback после авторизации через Yandex.

    1. Проверяет state (CSRF protection)
    2. Обменивает code на access_token
    3. Получает профиль пользователя (yandex_id, email)
    4. Создаёт/находит пользователя в auth.users
    5. Для нового пользователя — генерирует API ключ (возвращается ОДИН раз)
    """
    # Шаг 0: CSRF проверка
    if not _verify_oauth_state(state):
        raise HTTPException(
            status_code=400,
            detail="Невалидный или истёкший state параметр (возможна CSRF-атака)"
        )

    if not YANDEX_CLIENT_ID or not YANDEX_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Yandex OAuth не настроен. Укажите YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET в .env"
        )

    # Шаг 1: Обмен code → access_token
    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(
            YANDEX_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": YANDEX_CLIENT_ID,
                "client_secret": YANDEX_CLIENT_SECRET,
            },
        )
        if token_resp.status_code != 200:
            log.error(f"[AUTH] Yandex token error: {token_resp.status_code} {token_resp.text}")
            raise HTTPException(
                status_code=400,
                detail="Ошибка получения токена от Yandex"
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Yandex не вернул access_token"
            )

        # Шаг 2: Получение профиля
        userinfo_resp = await client.get(
            YANDEX_USERINFO_URL,
            headers={"Authorization": f"OAuth {access_token}"},
            params={"format": "json"},
        )
        if userinfo_resp.status_code != 200:
            log.error(f"[AUTH] Yandex userinfo error: {userinfo_resp.status_code}")
            raise HTTPException(
                status_code=400,
                detail="Ошибка получения профиля от Yandex"
            )

        profile = userinfo_resp.json()

    yandex_id = profile.get("id")
    email = profile.get("default_email")

    if not yandex_id:
        raise HTTPException(status_code=400, detail="Yandex не вернул id пользователя")

    # Шаг 3: Создание/поиск пользователя + генерация API ключа
    conn = None
    try:
        conn = _get_auth_connection()

        user = _find_or_create_user(conn, yandex_id=str(yandex_id), email=email)

        result = {
            "user": {
                "id": user["id"],
                "email": user["email"],
                "plan": user["plan"],
                "credits": user["credits"],
            },
        }

        # Для нового пользователя — генерируем API ключ
        if user["is_new"]:
            raw_key = _create_api_key(conn, user["id"])
            result["api_key"] = raw_key
            result["warning"] = "Сохраните API ключ — он показывается ОДИН раз!"
        else:
            result["message"] = "С возвращением! Если вы потеряли API ключ, создайте новый через /auth/api-key/regenerate"

        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"[AUTH] Ошибка в callback: {e}")
        raise HTTPException(status_code=500, detail="Внутренняя ошибка авторизации")
    finally:
        if conn:
            conn.close()


# ============================================================
# ENDPOINTS: API Key Management
# ============================================================

@auth_router.post("/api-key/regenerate")
async def regenerate_api_key(request: Request):
    """Генерирует новый API ключ (деактивирует все предыдущие).

    Атомарная операция: деактивация старых + создание нового в одной транзакции.
    Требует авторизацию через текущий X-API-Key.
    """
    user = get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация через X-API-Key"
        )

    conn = None
    try:
        conn = _get_auth_connection()
        cur = conn.cursor()

        # Атомарно: деактивируем все текущие + создаём новый в одной транзакции
        cur.execute(
            "UPDATE auth.api_keys SET is_active = FALSE WHERE user_id = %s AND is_active = TRUE",
            (user["id"],)
        )

        raw_key = _generate_raw_api_key()
        key_hash = _hash_api_key(raw_key)
        cur.execute(
            "INSERT INTO auth.api_keys (user_id, key_hash, name) VALUES (%s, %s, %s)",
            (user["id"], key_hash, "default")
        )

        conn.commit()
        cur.close()

        return JSONResponse(content={
            "api_key": raw_key,
            "warning": "Сохраните API ключ — он показывается ОДИН раз!",
        })
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        log.error(f"[AUTH] Ошибка регенерации ключа: {e}")
        raise HTTPException(status_code=500, detail="Ошибка генерации ключа")
    finally:
        if conn:
            conn.close()


@auth_router.get("/me")
async def auth_me(request: Request):
    """Возвращает информацию о текущем пользователе.

    Требует X-API-Key.
    """
    user = get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация через X-API-Key"
        )

    return JSONResponse(content={"user": user})


# ============================================================
# ИНИЦИАЛИЗАЦИЯ: вызывать при старте приложения
# ============================================================

def init_auth_schema():
    """Проверяет наличие схемы auth при старте приложения.

    НЕ создаёт таблицы — только проверка. Структура БД управляется
    ТОЛЬКО через миграции (migrations/003_auth_schema.sql).

    Если схема не найдена — auth-эндпоинты вернут 503, но основной
    сервис продолжит работать.
    """
    conn = None
    try:
        conn = _get_auth_connection()
        if _check_auth_schema(conn):
            log.info("[AUTH] Схема auth найдена, модуль авторизации активен")
        else:
            log.warning(
                "[AUTH] Схема auth не найдена. Выполните миграцию: "
                "python migrations/run_migration.py 003_auth_schema.sql"
            )
    except Exception as e:
        log.warning(f"[AUTH] Не удалось проверить схему auth: {e}")
        log.warning("[AUTH] Авторизация будет недоступна до создания схемы")
    finally:
        if conn:
            conn.close()
