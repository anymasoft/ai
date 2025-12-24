from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from db.sqlite import get_session, delete_session

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
