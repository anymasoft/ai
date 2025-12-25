"""Credits management."""

from db import get_api_conn, hash_api_key
from fastapi import HTTPException, status


# Format costs
FORMAT_COSTS = {
    "html_tailwind": 1,
    "html_css": 1,
    "react_tailwind": 2,
    "vue_tailwind": 2,
}


def get_format_cost(format: str) -> int:
    """Get credit cost for format."""
    return FORMAT_COSTS.get(format, 1)


def deduct_credits_atomic(api_key_id: str, required: int) -> None:
    """
    Atomically check and deduct credits in a single operation.

    This prevents race conditions where multiple concurrent requests could
    bypass the credit check.

    The UPDATE statement includes both the check and the deduction:
    - WHERE id = ? (find the key)
    - AND (credits_total - credits_used) >= ? (ensure enough available)

    If rowcount == 0, either the key doesn't exist or insufficient credits.
    We then do a second SELECT to provide detailed error message.

    Raises HTTPException if key not found (404) or insufficient credits (402).
    """
    conn = get_api_conn()
    cursor = conn.cursor()

    # ATOMIC operation: UPDATE only if enough credits available
    cursor.execute(
        """
        UPDATE api_keys
        SET credits_used = credits_used + ?
        WHERE id = ? AND (credits_total - credits_used) >= ?
        """,
        (required, api_key_id, required),
    )

    conn.commit()

    # Check if the UPDATE was successful
    if cursor.rowcount == 0:
        # UPDATE failed - either key not found or insufficient credits
        # Do a SELECT to provide detailed error message
        cursor.execute(
            """
            SELECT credits_total, credits_used
            FROM api_keys
            WHERE id = ?
            """,
            (api_key_id,),
        )

        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "API key not found"},
            )

        total, used = row
        available = total - used

        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_credits",
                "message": f"Required: {required}, Available: {available}",
            },
        )

    conn.close()


# Keep old functions for backwards compatibility (deprecated)
def check_credits(api_key_id: str, required: int) -> None:
    """
    DEPRECATED: Use deduct_credits_atomic() instead.
    Check if API key has enough credits.

    Raises HTTPException if insufficient.
    """
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT credits_total, credits_used
        FROM api_keys
        WHERE id = ?
        """,
        (api_key_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "API key not found"},
        )

    total, used = row
    available = total - used

    if available < required:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_credits",
                "message": f"Required: {required}, Available: {available}",
            },
        )


def deduct_credits(api_key_id: str, amount: int) -> None:
    """
    DEPRECATED: Use deduct_credits_atomic() instead.
    Deduct credits from API key.

    This is called immediately when generation starts.
    No refunds if generation fails.
    """
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE api_keys
        SET credits_used = credits_used + ?
        WHERE id = ?
        """,
        (amount, api_key_id),
    )

    conn.commit()
    conn.close()


def get_credits_info(api_key_id: str) -> dict:
    """Get current credits status for API key."""
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT credits_total, credits_used
        FROM api_keys
        WHERE id = ?
        """,
        (api_key_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"available": 0, "total": 0, "used": 0}

    total, used = row
    return {"available": total - used, "total": total, "used": used}
