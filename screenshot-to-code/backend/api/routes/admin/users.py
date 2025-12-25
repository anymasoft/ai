"""Admin endpoints for managing users."""

from fastapi import APIRouter, HTTPException, status, Depends
from api.admin_auth import get_admin_user
from api.billing.yookassa import PACKAGES
import sqlite3
from pydantic import BaseModel
from db import get_conn as get_db

router = APIRouter(prefix="/api/admin/users", tags=["admin"])


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


class AddCreditsRequest(BaseModel):
    """Request to add credits to user."""

    userId: str
    amount: int


class SetCreditsRequest(BaseModel):
    """Request to set user credits balance."""

    userId: str
    credits: int


@router.get("")
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
                "credits": 100,
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
            SELECT id, email, name, plan, credits, used_generations, disabled, role, created_at
            FROM users
            ORDER BY created_at DESC
        """)

        users = [dict(row) for row in cursor.fetchall()]

        return {"users": users}

    finally:
        conn.close()


@router.post("/change-plan")
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


@router.patch("/disable")
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


@router.post("/{user_id}/reset-limits")
async def reset_user_limits(
    user_id: str,
    admin: dict = Depends(get_admin_user),
):
    """
    Reset user's usage counter (set used_generations to 0).

    IMPORTANT: This ONLY resets the usage counter, NOT the credits balance.
    If user had 100 credits and used 50, after reset they still have 100 credits
    with used_generations = 0.

    Returns:
    {
        "success": true
    }
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check user exists
        cursor.execute("SELECT used_generations, credits FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        used_before = row[0] if row[0] else 0
        credits = row[1] if row[1] else 0

        print(f"[ADMIN] Resetting usage for user {user_id}: used_generations {used_before} → 0 (credits remains {credits})")

        # Reset ONLY used_generations to 0. Credits balance is NOT touched.
        cursor.execute(
            "UPDATE users SET used_generations = 0, updated_at = datetime('now') WHERE id = ?",
            (user_id,),
        )

        conn.commit()

        print(f"[ADMIN] Successfully reset usage for user {user_id}")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error resetting usage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to reset usage"},
        )

    finally:
        conn.close()


@router.post("/{user_id}/set-usage")
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


@router.post("/add-credits")
async def add_credits_to_user(
    request: AddCreditsRequest,
    admin: dict = Depends(get_admin_user),
):
    """
    Add credits to user's balance.

    Request body:
    {
        "userId": "user-id",
        "amount": 10
    }

    Returns:
    {
        "success": true,
        "credits_added": 10,
        "new_balance": 110
    }
    """
    if request.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_input",
                "message": "Amount must be > 0",
            },
        )

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check user exists and get current credits
        cursor.execute("SELECT credits FROM users WHERE id = ?", (request.userId,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        current_credits = row[0] if row[0] else 0
        new_balance = current_credits + request.amount

        print(f"[ADMIN] Adding {request.amount} credits to user {request.userId}: {current_credits} → {new_balance}")

        # Update credits
        cursor.execute(
            "UPDATE users SET credits = ?, updated_at = datetime('now') WHERE id = ?",
            (new_balance, request.userId),
        )

        conn.commit()

        print(f"[ADMIN] Successfully added {request.amount} credits to user {request.userId}")

        return {
            "success": True,
            "credits_added": request.amount,
            "new_balance": new_balance,
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error adding credits: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to add credits"},
        )

    finally:
        conn.close()


@router.post("/set-credits")
async def set_credits_for_user(
    request: SetCreditsRequest,
    admin: dict = Depends(get_admin_user),
):
    """
    Set user's credits balance to exact value.

    Request body:
    {
        "userId": "user-id",
        "credits": 100
    }

    Returns:
    {
        "success": true,
        "new_balance": 100
    }
    """
    if request.credits < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_input",
                "message": "Credits must be >= 0",
            },
        )

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check user exists and get current credits
        cursor.execute("SELECT credits FROM users WHERE id = ?", (request.userId,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        current_credits = row[0] if row[0] else 0

        print(f"[ADMIN] Setting credits for user {request.userId}: {current_credits} → {request.credits}")

        # Update credits
        cursor.execute(
            "UPDATE users SET credits = ?, updated_at = datetime('now') WHERE id = ?",
            (request.credits, request.userId),
        )

        conn.commit()

        print(f"[ADMIN] Successfully set credits for user {request.userId} to {request.credits}")

        return {
            "success": True,
            "new_balance": request.credits,
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error setting credits: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to set credits"},
        )

    finally:
        conn.close()
