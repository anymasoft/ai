import json
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from api.oauth.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_AUTH_URL,
    GOOGLE_OAUTH_TOKEN_URL,
    GOOGLE_OAUTH_USERINFO_URL,
    GOOGLE_OAUTH_SCOPES,
    JWT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRATION_DAYS,
    FRONTEND_URL,
)
from api.oauth.callbacks import handle_oauth_signin

router = APIRouter(prefix="/api/oauth", tags=["oauth"])

# Временное хранилище state (в production нужен Redis)
oauth_states = {}


@router.get("/google")
async def initiate_google_oauth(redirect_to: str = Query(default="/playground")):
    """
    GET /api/oauth/google

    Инициирует Google OAuth flow.
    Генерирует authorization URL и редиректит пользователя на Google.

    Query params:
        redirect_to: URL для редиректа после успешной аутентификации (default: /playground)

    Эквивалент: NextAuth signIn("google") в YouTubeAnalytics
    """
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "redirect_to": redirect_to,
        "created_at": datetime.now(),
    }

    auth_url = (
        f"{GOOGLE_OAUTH_AUTH_URL}?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_OAUTH_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope={'+'.join(GOOGLE_OAUTH_SCOPES)}&"
        f"access_type=offline&"
        f"state={state}"
    )

    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
):
    """
    GET /api/oauth/google/callback

    Обрабатывает callback от Google OAuth.

    Flow:
    1. Проверяет state (CSRF protection)
    2. Обменивает code на access token
    3. Получает информацию о пользователе из Google
    4. Создаёт/обновляет пользователя в БД (через handle_oauth_signin)
    5. Создаёт JWT token с id, email, role
    6. Возвращает redirect с HttpOnly cookie

    Эквивалент: NextAuth callback handlers в YouTubeAnalytics
    """
    import httplib2

    # Проверяем, не была ли ошибка от Google
    if error:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth-callback?error={error}",
            status_code=302,
        )

    # PART 1: Проверяем state (CSRF protection)
    if state not in oauth_states:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth-callback?error=invalid_state",
            status_code=302,
        )

    oauth_state = oauth_states.pop(state)
    redirect_to = oauth_state.get("redirect_to", "/playground")

    # PART 2: Обмениваем code на access token
    try:
        http = httplib2.Http()
        body = urlencode(
            {
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            }
        )

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        resp, content = http.request(
            GOOGLE_OAUTH_TOKEN_URL, "POST", body=body, headers=headers
        )

        if resp.status != 200:
            raise Exception(f"Token exchange failed with status {resp.status}")

        token_data = json.loads(content)
        access_token = token_data.get("access_token")

        if not access_token:
            raise Exception("No access token in response")

    except Exception as e:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth-callback?error=token_exchange_failed",
            status_code=302,
        )

    # PART 3: Получаем информацию о пользователе из Google
    try:
        http = httplib2.Http()
        resp, content = http.request(
            f"{GOOGLE_OAUTH_USERINFO_URL}?access_token={access_token}",
            "GET",
        )

        if resp.status != 200:
            raise Exception(f"Userinfo request failed with status {resp.status}")

        user_info = json.loads(content)

    except Exception as e:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth-callback?error=get_userinfo_failed",
            status_code=302,
        )

    # PART 4: Создаём/проверяем пользователя в БД
    try:
        user_data = await handle_oauth_signin(
            user_id=user_info.get("id"),
            email=user_info.get("email"),
            name=user_info.get("name"),
        )
    except Exception as e:
        # Пользователь отключен или другая ошибка
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth-callback?error=access_denied",
            status_code=302,
        )

    # PART 5: Создаём JWT token (ЛОГИКА ИЗ JWT CALLBACK)
    payload = {
        "sub": user_data["id"],
        "id": user_data["id"],
        "email": user_data["email"],
        "name": user_data["name"],
        "role": user_data["role"],
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
    }

    access_token_jwt = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # PART 6: Возвращаем redirect с HttpOnly cookie
    response = RedirectResponse(
        url=f"{FRONTEND_URL}/auth-callback?success=true&redirect_to={redirect_to}",
        status_code=302,
    )

    response.set_cookie(
        key="authorization",
        value=f"Bearer {access_token_jwt}",
        httponly=True,
        secure=False,  # True в production с HTTPS
        samesite="lax",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
    )

    return response
