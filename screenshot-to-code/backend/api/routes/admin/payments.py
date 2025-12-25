"""Admin endpoints for viewing payments."""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from api.admin_auth import get_admin_user
import sqlite3
from typing import Optional
from db import get_conn as get_db

router = APIRouter(prefix="/api/admin/payments", tags=["admin"])


@router.get("")
async def get_payments(
    admin: dict = Depends(get_admin_user),
    email: Optional[str] = Query(None),
):
    """
    Get all payments (from YuKassa or other providers).

    Query params:
    - email: filter by user email (optional)

    Returns:
    {
        "payments": [
            {
                "id": "...",
                "user_id": "...",
                "email": "...",
                "plan": "...",
                "amount": 2490,
                "currency": "RUB",
                "provider": "yookassa",
                "created_at": "2024-01-01T00:00:00"
            },
            ...
        ],
        "totalSum": 12345
    }

    Note: This is a placeholder - actual payments table doesn't exist yet.
    When YuKassa integration is implemented, this will show real payments.
    """
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Check if payments table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='payments'"
        )

        if not cursor.fetchone():
            # Table doesn't exist yet - return empty
            return {
                "payments": [],
                "totalSum": 0,
                "message": "Payments table not created yet. Will be available after YuKassa integration.",
            }

        # Build query
        where_clause = ""
        params = []

        if email:
            # Join with users to filter by email
            query = """
                SELECT p.id, p.user_id, u.email, p.package, p.credits_amount,
                       p.amount_cents, p.status, p.created_at
                FROM payments p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE u.email LIKE ?
                ORDER BY p.created_at DESC
            """
            params = [f"%{email}%"]
        else:
            query = """
                SELECT p.id, p.user_id, u.email, p.package, p.credits_amount,
                       p.amount_cents, p.status, p.created_at
                FROM payments p
                LEFT JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
            """

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Transform response to match frontend expectations
        payments = []
        for row in rows:
            p = dict(row)
            amount_cents = p.get("amount_cents", 0) or 0
            p["amount_rubles"] = amount_cents / 100 if amount_cents > 0 else 0
            p.pop("amount_cents", None)
            payments.append(p)

        # Calculate total sum in rubles
        total_sum = sum(p.get("amount_rubles", 0) for p in payments)

        return {"payments": payments, "totalSum": total_sum}

    except Exception as e:
        print(f"[ADMIN] Error fetching payments: {e}")
        # Return empty if any error
        return {
            "payments": [],
            "totalSum": 0,
            "error": "Error fetching payments. Table may not exist yet.",
        }

    finally:
        conn.close()
