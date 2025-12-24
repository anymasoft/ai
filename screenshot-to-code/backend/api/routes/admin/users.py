"""Admin endpoints for managing users."""

from fastapi import APIRouter, HTTPException, status, Depends
from api.admin_auth import get_admin_user
import sqlite3
from pydantic import BaseModel
from pathlib import Path

router = APIRouter()

DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "app.db"


class ChangePlanRequest(BaseModel):
    """Request to change user plan."""

    userId: str
    plan: str  # 'free' | 'basic' | 'professional'


class DisableUserRequest(BaseModel):
    """Request to disable/enable user."""

    userId: str
    disabled: bool


@router.get("/api/admin/users")
async def get_users(admin: dict = Depends(get_admin_user)):
    """
    Get all users.

    Returns:
    {
        "users": [
            {
                "id": "...",
                "email": "...",
                "plan_id": "..." | null,
                "role": "user" | "admin",
                "created_at": "2024-01-01T00:00:00"
            },
            ...
        ]
    }
    """
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, email, plan_id, role, created_at
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
    Change user's plan.

    Request body:
    {
        "userId": "user-id",
        "plan": "free" | "basic" | "professional"
    }

    Returns:
    {
        "success": true
    }

    Note: This is simplified - in production you'd:
    - Validate plan exists in plans table
    - Update credits/limits accordingly
    - Create audit log
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

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        # Check user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (request.userId,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        # Update plan
        cursor.execute(
            "UPDATE users SET plan_id = ? WHERE id = ?",
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
    conn = sqlite3.connect(str(DB_PATH))
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
