"""User information endpoints."""

from fastapi import APIRouter, Depends
from ..user_auth import get_current_user

router = APIRouter()


@router.get("/api/auth/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """
    Get current user information.

    Returns:
    {
        "id": "...",
        "email": "...",
        "role": "user" | "admin",
        "plan_id": "free" | "basic" | "professional"
    }
    """
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "role": user.get("role"),
        "plan_id": user.get("plan_id"),
    }
