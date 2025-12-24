"""User authentication based on X-User-Email header."""

import sqlite3
import os
import uuid
from fastapi import Header, HTTPException, status, Depends
from typing import Annotated, Optional
from db import get_conn as get_db


def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email from database."""
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id, email, role, plan_id, created_at FROM users WHERE email = ?",
            (email,),
        )

        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        print(f"[USER_AUTH] Error getting user by email: {e}")
        return None
    finally:
        conn.close()


def create_user_if_not_exists(email: str) -> dict:
    """
    Create user with role='user' if doesn't exist.
    Returns user dict.
    """
    user = get_user_by_email(email)
    if user:
        return user

    conn = get_db()
    cursor = conn.cursor()

    try:
        user_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO users (id, email, role, plan_id, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            """,
            (user_id, email, "user", "free"),
        )
        conn.commit()

        print(f"[USER_AUTH] Created new user: {email} (id={user_id})")

        return {
            "id": user_id,
            "email": email,
            "role": "user",
            "plan_id": "free",
            "created_at": None,
        }
    except Exception as e:
        print(f"[USER_AUTH] Error creating user: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


async def get_current_user(
    x_user_email: Annotated[str | None, Header()] = None,
) -> dict:
    """
    FastAPI dependency for user authentication.

    Reads X-User-Email header.
    If user doesn't exist in DB, creates with role='user'.
    Returns user dict.

    Usage:
        @router.get("/api/something")
        async def something(user: dict = Depends(get_current_user)):
            # user contains user dict with email, role, etc
            pass
    """
    if not x_user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "unauthorized",
                "message": "Missing X-User-Email header",
            },
        )

    return create_user_if_not_exists(x_user_email)
