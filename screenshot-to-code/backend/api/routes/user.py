"""User role endpoint."""

from fastapi import APIRouter, Depends
from api.user_auth import get_current_user

router = APIRouter()


@router.get("/api/user/role")
async def get_user_role(user: dict = Depends(get_current_user)):
    """
    Get current user's role from database.

    Returns:
    {
        "role": "user" | "admin"
    }
    """
    return {"role": user.get("role")}
