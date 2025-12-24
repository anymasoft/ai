"""Admin endpoints for managing users."""

from fastapi import APIRouter, HTTPException, status, Depends
from api.admin_auth import get_admin_user
from api.config.plans import get_plan_limit
import sqlite3
from pydantic import BaseModel
from db import get_conn as get_db

router = APIRouter()


class ChangePlanRequest(BaseModel):
    """Request to change user plan."""

    userId: str
    plan: str  # 'free' | 'basic' | 'professional'


class DisableUserRequest(BaseModel):
    """Request to disable/enable user."""

    userId: str
    disabled: bool


class ResetLimitsRequest(BaseModel):
    """Request to reset user limits."""

    userId: str


class SetUsageRequest(BaseModel):
    """Request to set user usage (for testing)."""

    userId: str
    used_generations: int


@router.get("/api/admin/users")
async def get_users(admin: dict = Depends(get_admin_user)):
    """
    Get all users with plan and usage info.

    Returns:
    {
        "users": [
            {
                "id": "...",
                "email": "...",
                "name": "...",
                "plan": "free|basic|professional",
                "used_generations": 5,
                "disabled": false,
                "role": "user" | "admin",
                "created_at": "2024-01-01T00:00:00"
            },
            ...
        ]
    }
    """
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, email, name, plan, used_generations, disabled, role, created_at
            FROM users
            ORDER BY created_at DESC
        """)

        users = [dict(row) for row in cursor.fetchall()]

        return {"users": users}

    finally:
        conn.close()


@router.post("/api/admin/users/change-plan")
async def change_user_plan(
    request: ChangePlanRequest,
    admin: dict = Depends(get_admin_user),
):
    """
    Change user's plan and reset their usage limits.

    Request body:
    {
        "userId": "user-id",
        "plan": "free" | "basic" | "professional"
    }

    Returns:
    {
        "success": true
    }

    Note: When plan changes, used_generations is reset to 0.
    """
    valid_plans = ["free", "basic", "professional"]

    if request.plan not in valid_plans:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_input",
                "message": f"Plan must be one of: {', '.join(valid_plans)}",
            },
        )

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (request.userId,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        # Update plan and reset usage
        cursor.execute(
            "UPDATE users SET plan = ?, used_generations = 0 WHERE id = ?",
            (request.plan, request.userId),
        )

        conn.commit()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error changing plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to change plan"},
        )

    finally:
        conn.close()


@router.patch("/api/admin/users/disable")
async def disable_user(
    request: DisableUserRequest,
    admin: dict = Depends(get_admin_user),
):
    """
    Disable or enable a user.

    Request body:
    {
        "userId": "user-id",
        "disabled": true | false
    }

    Returns:
    {
        "success": true
    }

    Note: This adds a 'disabled' column to users table.
    Run migration first if needed.
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check if disabled column exists, add if not
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]

        if "disabled" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0")

        # Check user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (request.userId,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        # Update disabled status
        disabled_value = 1 if request.disabled else 0
        cursor.execute(
            "UPDATE users SET disabled = ? WHERE id = ?",
            (disabled_value, request.userId),
        )

        conn.commit()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error updating user status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to update user"},
        )

    finally:
        conn.close()


@router.post("/api/admin/users/{user_id}/reset-limits")
async def reset_user_limits(
    user_id: str,
    admin: dict = Depends(get_admin_user),
):
    """
    Reset user's generation limits (set used_generations to 0).

    Returns:
    {
        "success": true
    }
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check user exists
        cursor.execute("SELECT plan FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        # Reset used_generations to 0
        cursor.execute(
            "UPDATE users SET used_generations = 0 WHERE id = ?",
            (user_id,),
        )

        conn.commit()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error resetting limits: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to reset limits"},
        )

    finally:
        conn.close()


@router.post("/api/admin/users/{user_id}/set-usage")
async def set_user_usage(
    user_id: str,
    request: SetUsageRequest,
    admin: dict = Depends(get_admin_user),
):
    """
    Set user's used_generations count (for testing).

    Request body:
    {
        "userId": "user-id",
        "used_generations": 10
    }

    Returns:
    {
        "success": true
    }
    """
    if request.used_generations < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_input",
                "message": "used_generations must be >= 0",
            },
        )

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check user exists
        cursor.execute("SELECT plan FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        # Set used_generations
        cursor.execute(
            "UPDATE users SET used_generations = ? WHERE id = ?",
            (request.used_generations, user_id),
        )

        conn.commit()

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error setting usage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to set usage"},
        )

    finally:
        conn.close()
