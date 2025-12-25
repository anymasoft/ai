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
    Get all payments.

    Query params:
    - email: filter by user email (optional)

    Returns:
    {
        "payments": [
            {
                "id": "...",
                "user_id": "...",
                "email": "...",
                "package": "basic",
                "credits_amount": 100,
                "amount_rubles": 2490.0,
                "status": "succeeded",
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
        # Check if payments table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='payments'"
        )

        if not cursor.fetchone():
            # Table doesn't exist yet - return empty
            return {"payments": []}

        # Build query - return correct field names for frontend
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

        # Transform amount_cents to amount_rubles (divide by 100)
        payments = []
        for row in rows:
            payment_dict = dict(row)
            # Convert amount_cents to amount_rubles
            amount_cents = payment_dict.get("amount_cents", 0) or 0
            payment_dict["amount_rubles"] = amount_cents / 100 if amount_cents > 0 else 0
            # Remove amount_cents from response
            payment_dict.pop("amount_cents", None)
            payments.append(payment_dict)

        return {"payments": payments}

    except Exception as e:
        print(f"[ADMIN] Error fetching payments: {e}")
        # Return empty if any error
        return {"payments": []}

    finally:
        conn.close()
