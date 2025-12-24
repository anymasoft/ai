import json
from urllib.parse import urlencode
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse, RedirectResponse

from db.sqlite import get_session, delete_session, create_session
from api.oauth.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_TOKEN_URL,
    GOOGLE_OAUTH_USERINFO_URL,
    SESSION_EXPIRATION_DAYS,
    FRONTEND_URL,
)
from api.oauth.callbacks import handle_oauth_signin
from api.routes.oauth import oauth_states

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_current_user(request: Request) -> dict:
    """
    Получает текущего пользователя из session cookie.

    Используется в качестве Depends() для защиты endpoints.
    Эквивалент: getServerSession() в NextAuth.

    Raises:
        HTTPException: 401 если session отсутствует, истек или невалиден
    """
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return session_data


@router.get("/user")
async def get_user(current_user: dict = Depends(get_current_user)):
    """
    GET /api/auth/user

    Возвращает информацию о текущем пользователе.
    Данные берутся из сессии (уже валидированы и прочитаны из БД).

    Эквивалент: GET /api/user в YouTubeAnalytics

    Returns:
        {id, email, name, role, plan, disabled}
    """
    user = current_user.get("user")
    if not user:
        raise HTTPException(status_code=404, detail="User data not found in session")

    return JSONResponse(user)


@router.post("/logout")
async def logout(request: Request):
    """
    POST /api/auth/logout

    Логирует пользователя (удаляет session из БД и cookie).

    Эквивалент: signOut() в NextAuth.
    """
    session_id = request.cookies.get("session_id")
    if session_id:
        try:
            delete_session(session_id)
        except Exception as e:
            print(f"[Auth] Error deleting session: {e}")

    response = JSONResponse({"ok": True})
    response.delete_cookie("session_id", httponly=True, samesite="lax")
    return response


@router.get("/callback/google")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
):
    """
    GET /api/auth/callback/google

    Обрабатывает callback от Google OAuth.

    Flow:
    1. Проверяет state (CSRF protection)
    2. Обменивает code на access token
    3. Получает информацию о пользователе из Google
    4. Создаёт/обновляет пользователя в БД (через handle_oauth_signin)
    5. Создаёт server-side session
    6. Возвращает redirect с HttpOnly cookie
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

    # PART 5: Создаём server-side session
    try:
        session_id = create_session(
            user_id=user_data["id"],
            expiration_days=SESSION_EXPIRATION_DAYS,
        )
    except Exception as e:
        print(f"[Auth] Error creating session: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth-callback?error=session_creation_failed",
            status_code=302,
        )

    # PART 6: Возвращаем redirect с HttpOnly session cookie
    response = RedirectResponse(
        url=f"{FRONTEND_URL}/auth-callback?success=true&redirect_to={redirect_to}",
        status_code=302,
    )

    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=False,  # True в production с HTTPS
        samesite="lax",
        max_age=SESSION_EXPIRATION_DAYS * 24 * 60 * 60,
    )

    return response
