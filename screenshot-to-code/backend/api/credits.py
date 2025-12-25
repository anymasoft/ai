"""Credits management."""

from db import get_api_conn
from fastapi import HTTPException, status


# Format costs - ALL formats cost 1 credit (unified with WEB)
FORMAT_COSTS = {
    "html_tailwind": 1,
    "html_css": 1,
    "react_tailwind": 1,  # Changed from 2 to 1 (unified with WEB)
    "vue_tailwind": 1,    # Changed from 2 to 1 (unified with WEB)
}


def get_format_cost(format: str) -> int:
    """Get credit cost for format."""
    return FORMAT_COSTS.get(format, 1)


def deduct_credits_atomic(user_id: str, required: int) -> None:
    """
    Atomically check and deduct credits from users table.

    This prevents race conditions where multiple concurrent requests could
    bypass the credit check.

    The UPDATE statement includes both the check and the deduction:
    - WHERE id = ? (find the user)
    - AND credits >= ? (ensure enough available)

    If rowcount == 0, either the user doesn't exist or insufficient credits.
    We then do a second SELECT to provide detailed error message.

    Raises HTTPException if user not found (404) or insufficient credits (402).
    """
    conn = get_api_conn()
    cursor = conn.cursor()

    # ATOMIC operation: UPDATE only if enough credits available
    cursor.execute(
        """
        UPDATE users
        SET credits = credits - ?
        WHERE id = ? AND credits >= ?
        """,
        (required, user_id, required),
    )

    conn.commit()

    # Check if the UPDATE was successful
    if cursor.rowcount == 0:
        # UPDATE failed - either user not found or insufficient credits
        # Do a SELECT to provide detailed error message
        cursor.execute(
            """
            SELECT credits
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        )

        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "User not found"},
            )

        available = row[0]

        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_credits",
                "message": f"Required: {required}, Available: {available}",
            },
        )

    conn.close()


# Keep old functions for backwards compatibility (deprecated)
def check_credits(user_id: str, required: int) -> None:
    """
    DEPRECATED: Use deduct_credits_atomic() instead.
    Check if user has enough credits.

    Raises HTTPException if insufficient.
    """
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT credits
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "User not found"},
        )

    available = row[0]

    if available < required:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "insufficient_credits",
                "message": f"Required: {required}, Available: {available}",
            },
        )


def deduct_credits(user_id: str, amount: int) -> None:
    """
    DEPRECATED: Use deduct_credits_atomic() instead.
    Deduct credits from user.

    This is called immediately when generation starts.
    No refunds if generation fails.
    """
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE users
        SET credits = credits - ?
        WHERE id = ?
        """,
        (amount, user_id),
    )

    conn.commit()
    conn.close()


def get_credits_info(user_id: str) -> dict:
    """Get current credits status for user."""
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT credits
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"available": 0}

    credits = row[0]
    return {"available": credits}
