import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from api.oauth.config import JWT_SECRET, JWT_ALGORITHM
from db.sqlite import get_conn

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_current_user(request: Request) -> dict:
    """
    Получает текущего пользователя из JWT токена в cookie.

    Используется в качестве Depends() для защиты endpoints.
    Эквивалент: getServerSession() в NextAuth.

    Raises:
        HTTPException: 401 если токен отсутствует, истек или невалиден
    """
    token = request.cookies.get("authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Убираем "Bearer " prefix
    if token.startswith("Bearer "):
        token = token[7:]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/user")
async def get_user(current_user: dict = Depends(get_current_user)):
    """
    GET /api/auth/user

    Возвращает информацию о текущем пользователе.
    ЧИТАЕТ НАПРЯМУЮ ИЗ БД (свежие данные).

    Эквивалент: GET /api/user в YouTubeAnalytics

    Returns:
        {id, email, name, role, plan, disabled, expiresAt}
    """
    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, email, name, role, plan, disabled, expiresAt
            FROM users
            WHERE id = ?
            """,
            (current_user["id"],),
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return JSONResponse(
            {
                "id": user[0],
                "email": user[1],
                "name": user[2],
                "role": user[3],
                "plan": user[4],
                "disabled": bool(user[5]),
                "expiresAt": user[6],
            }
        )
    finally:
        conn.close()


@router.post("/logout")
async def logout():
    """
    POST /api/auth/logout

    Логирует пользователя (удаляет cookie на frontend).

    Эквивалент: signOut() в NextAuth.
    """
    response = JSONResponse({"ok": True})
    response.delete_cookie("authorization", httponly=True, samesite="lax")
    return response
