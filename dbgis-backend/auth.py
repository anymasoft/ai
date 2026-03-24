#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Модуль авторизации: Yandex OAuth + API keys.

Все данные хранятся в схеме `auth` (PostgreSQL), изолированно от бизнес-данных.
Shadow mode: если X-API-Key не передан — запрос пропускается без авторизации.

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

auth_router = APIRouter(prefix="/auth", tags=["auth"])


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


def _ensure_auth_schema(conn):
    """Создаёт схему auth и таблицы, если они не существуют.

    Идемпотентно — безопасно вызывать при каждом старте.
    """
    cur = conn.cursor()
    try:
        cur.execute("CREATE SCHEMA IF NOT EXISTS auth")
        cur.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS auth.users (
                id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                external_id VARCHAR(255) NOT NULL UNIQUE,
                email       VARCHAR(255),
                plan        VARCHAR(50)  NOT NULL DEFAULT 'free',
                credits     INTEGER      NOT NULL DEFAULT 100,
                created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS auth.api_keys (
                id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                key_hash   VARCHAR(64)  NOT NULL UNIQUE,
                name       VARCHAR(255) NOT NULL DEFAULT 'default',
                created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
                is_active  BOOLEAN      NOT NULL DEFAULT TRUE
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_auth_api_keys_hash
                ON auth.api_keys (key_hash) WHERE is_active = TRUE
        """)
        conn.commit()
        log.info("[AUTH] Схема auth проверена/создана")
    except Exception as e:
        conn.rollback()
        log.error(f"[AUTH] Ошибка создания схемы auth: {e}")
        raise
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


def _deactivate_api_key(conn, user_id: str, key_hash: str) -> bool:
    """Деактивирует API ключ."""
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE auth.api_keys SET is_active = FALSE "
            "WHERE user_id = %s AND key_hash = %s AND is_active = TRUE",
            (user_id, key_hash)
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        cur.close()


# ============================================================
# MIDDLEWARE: Shadow Mode
# ============================================================

class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware для авторизации через X-API-Key.

    Shadow mode: если заголовок X-API-Key отсутствует — запрос пропускается
    без авторизации (request.state.user = None). Существующие эндпоинты
    продолжают работать как раньше.

    Если X-API-Key передан, но невалиден — возвращаем 401.
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
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Невалидный API ключ"}
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
    """Редирект на страницу авторизации Yandex OAuth."""
    if not YANDEX_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Yandex OAuth не настроен. Укажите YANDEX_CLIENT_ID в .env"
        )

    params = {
        "response_type": "code",
        "client_id": YANDEX_CLIENT_ID,
        "redirect_uri": AUTH_CALLBACK_URL,
    }
    # Формируем URL вручную (без лишних зависимостей)
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{YANDEX_AUTH_URL}?{query}")


@auth_router.get("/yandex/callback")
async def yandex_callback(
    code: str = Query(..., description="Код авторизации от Yandex"),
):
    """Callback после авторизации через Yandex.

    1. Обменивает code на access_token
    2. Получает профиль пользователя (yandex_id, email)
    3. Создаёт/находит пользователя в auth.users
    4. Для нового пользователя — генерирует API ключ (возвращается ОДИН раз)
    """
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
        _ensure_auth_schema(conn)

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

        # Деактивируем все текущие ключи
        cur.execute(
            "UPDATE auth.api_keys SET is_active = FALSE WHERE user_id = %s",
            (user["id"],)
        )
        cur.close()
        conn.commit()

        # Создаём новый
        raw_key = _create_api_key(conn, user["id"])

        return JSONResponse(content={
            "api_key": raw_key,
            "warning": "Сохраните API ключ — он показывается ОДИН раз!",
        })
    except HTTPException:
        raise
    except Exception as e:
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
    """Проверяет/создаёт схему auth при старте приложения.

    Вызывается из main.py. Идемпотентно, безопасно при каждом рестарте.
    """
    conn = None
    try:
        conn = _get_auth_connection()
        _ensure_auth_schema(conn)
        log.info("[AUTH] Модуль авторизации инициализирован")
    except Exception as e:
        log.warning(f"[AUTH] Не удалось инициализировать схему auth: {e}")
        log.warning("[AUTH] Авторизация будет недоступна до создания схемы")
    finally:
        if conn:
            conn.close()
