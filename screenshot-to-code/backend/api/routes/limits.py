"""Limits and usage endpoint."""

import sqlite3
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from api.models.responses import (
    LimitsResponse,
    CreditsInfo,
    RateLimitsInfo,
    RateLimitInfo,
)
from api.auth import get_api_key
from api.credits import get_credits_info

router = APIRouter()


def get_concurrent_generations(api_key_id: str, rate_limit: int) -> RateLimitInfo:
    """
    Get concurrent generations count.

    Counts generations with status='processing' for this API key.
    """
    conn = sqlite3.connect("data/api.db")
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT COUNT(*)
            FROM generations
            WHERE api_key_id = ? AND status = 'processing'
        """, (api_key_id,))

        count = cursor.fetchone()[0]
        return RateLimitInfo(limit=rate_limit, current=count)

    finally:
        conn.close()


def get_hourly_generations(api_key_id: str, rate_limit: int) -> RateLimitInfo:
    """
    Get hourly generation count.

    Counts generations created in the last hour for this API key.
    """
    conn = sqlite3.connect("data/api.db")
    cursor = conn.cursor()

    # Calculate time 1 hour ago
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)

    try:
        cursor.execute("""
            SELECT COUNT(*)
            FROM generations
            WHERE api_key_id = ? AND created_at > ?
        """, (api_key_id, one_hour_ago.isoformat()))

        count = cursor.fetchone()[0]

        # Calculate next reset time (start of next hour)
        next_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

        return RateLimitInfo(limit=rate_limit, current=count, reset_at=next_hour)

    finally:
        conn.close()


@router.get("/api/limits", response_model=LimitsResponse, tags=["Usage"])
async def get_limits(api_key_info: dict = Depends(get_api_key)):
    """Get current usage and limits for API key."""

    api_key_id = api_key_info["id"]
    tier = api_key_info["tier"]
    rate_limit_concurrent = api_key_info.get("rate_limit_concurrent", 10)
    rate_limit_hourly = api_key_info.get("rate_limit_hourly", 100)

    credits = get_credits_info(api_key_id)
    concurrent = get_concurrent_generations(api_key_id, rate_limit_concurrent)
    hourly = get_hourly_generations(api_key_id, rate_limit_hourly)

    return LimitsResponse(
        credits=CreditsInfo(**credits),
        rate_limits=RateLimitsInfo(
            concurrent_generations=concurrent, generations_per_hour=hourly
        ),
        tier=tier,
    )
