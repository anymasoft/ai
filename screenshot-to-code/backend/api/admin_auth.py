"""Admin authentication and authorization."""

import os
from fastapi import HTTPException, status, Depends
from .user_auth import get_current_user


async def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency for admin-only endpoints.

    Checks that user has role='admin'.
    Uses get_current_user to get user from X-User-Email header.

    Usage:
        @router.get("/api/admin/users")
        async def get_users(admin: dict = Depends(get_admin_user)):
            # admin contains user dict with role='admin'
            pass
    """
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "app.db"))
    email = user.get("email")
    role = user.get("role")

    print(f"[ADMIN_AUTH] Checking admin access - db_path={db_path}, email={email}, role={role}")

    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Admin access required"},
        )

    return user
