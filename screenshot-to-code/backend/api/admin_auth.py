"""Admin authentication and authorization."""

import sqlite3
from fastapi import Header, HTTPException, status, Depends
from typing import Annotated, Optional


def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email from database."""
    conn = sqlite3.connect("data/app.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, email, role, plan_id, created_at FROM users WHERE email = ?",
        (email,),
    )

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def verify_admin(email: str) -> dict:
    """
    Verify that user is an admin.

    Raises HTTPException if not admin.
    Returns user dict if admin.
    """
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Missing email"},
        )

    user = get_user_by_email(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "forbidden", "message": "User not found"},
        )

    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "forbidden", "message": "Admin access required"},
        )

    return user


async def get_admin_user(
    x_admin_email: Annotated[str | None, Header()] = None
) -> dict:
    """
    FastAPI dependency for admin-only endpoints.

    Usage:
        @router.get("/api/admin/users")
        async def get_users(admin: dict = Depends(get_admin_user)):
            # admin contains user dict with role='admin'
            pass

    For now, we use X-Admin-Email header for simplicity.
    TODO: Replace with proper session/JWT auth when auth system is implemented.
    """
    if not x_admin_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "unauthorized",
                "message": "Missing X-Admin-Email header",
            },
        )

    return verify_admin(x_admin_email)
