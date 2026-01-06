"""User-related endpoints."""

import uuid
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from api.routes.auth import get_current_user
from db import get_api_conn

router = APIRouter()


def generate_api_key() -> str:
    """Generate a new API key."""
    return f"sk_live_{uuid.uuid4().hex[:32]}"


def hash_api_key(api_key: str) -> str:
    """Hash API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


@router.get("/api/user/api-key")
async def get_user_api_key(user: dict = Depends(get_current_user)):
    """
    Get current user's API key.

    If user doesn't have an API key, create one.

    Returns:
        {
            "api_key": "sk_live_...",
            "message": "Your API key"
        }
    """
    # Extract user from session
    user_data = user.get("user")
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found in session")

    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Не авторизирован")

    conn = get_api_conn()
    cursor = conn.cursor()

    # Check if user already has an API key
    cursor.execute("""
        SELECT key_plain FROM api_keys
        WHERE user_id = ? AND is_active = 1
        LIMIT 1
    """, (user_id,))

    existing_key_row = cursor.fetchone()

    if existing_key_row:
        # User already has a key, return it
        api_key = existing_key_row[0]
        conn.close()

        return {
            "api_key": api_key,
            "message": "Your API key",
            "is_new": False
        }
    else:
        # Create new API key for user
        api_key = generate_api_key()
        api_key_hash = hash_api_key(api_key)
        api_key_id = f"key_{uuid.uuid4().hex[:16]}"

        # Insert new API key (with both plain and hash)
        cursor.execute("""
            INSERT INTO api_keys (id, user_id, key_plain, key_hash, is_active)
            VALUES (?, ?, ?, ?, 1)
        """, (api_key_id, user_id, api_key, api_key_hash))

        conn.commit()
        conn.close()

        return {
            "api_key": api_key,
            "message": "New API key created",
            "is_new": True
        }
