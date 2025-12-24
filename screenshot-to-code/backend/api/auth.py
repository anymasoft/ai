"""API Key authentication."""

import hashlib
from db import get_api_conn, hash_api_key
from fastapi import Header, HTTPException, status
from typing import Annotated


def hash_api_key(api_key: str) -> str:
    """Hash API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(api_key: str) -> dict:
    """
    Verify API key and return key info.

    Returns dict with: id, tier, credits_total, credits_used, rate_limit_*

    Raises HTTPException if invalid.
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Missing API key"},
        )

    key_hash = hash_api_key(api_key)

    # Query database
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, tier, credits_total, credits_used,
               rate_limit_concurrent, rate_limit_hourly, is_active
        FROM api_keys
        WHERE key_hash = ? AND is_active = 1
        """,
        (key_hash,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Invalid API key"},
        )

    return dict(row)


async def get_api_key(x_api_key: Annotated[str | None, Header()] = None) -> dict:
    """
    Dependency for getting authenticated API key info.

    Usage:
        @app.get("/api/something")
        async def something(api_key_info: dict = Depends(get_api_key)):
            # api_key_info contains key details
            pass
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "unauthorized", "message": "Missing X-API-Key header"},
        )

    return verify_api_key(x_api_key)
