"""Admin authentication and authorization."""

from fastapi import HTTPException, status, Depends, Request
from api.routes.auth import get_current_user


async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency for admin-only endpoints.

    Checks that user has role='admin' and is NOT disabled.
    Uses get_current_user to get user from session cookie.

    Usage:
        @router.get("/api/admin/users")
        async def get_users(admin: dict = Depends(get_admin_user)):
            # admin contains user dict with role='admin'
            pass
    """
    user = current_user.get("user")
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in session",
        )

    # Check if user is disabled
    if user.get("disabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled",
        )

    # Check admin role
    role = user.get("role")

    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return user
