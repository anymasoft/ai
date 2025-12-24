"""Billing endpoints - view usage and subscription info."""

from fastapi import APIRouter, HTTPException, status, Depends
from api.routes.auth import get_current_user
from api.config.plans import get_plan_limit

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/usage")
async def get_billing_usage(current_user: dict = Depends(get_current_user)):
    """
    Get current user's billing and usage information.

    Returns:
    {
        "plan": "free",
        "used": 7,
        "limit": 30,
        "remaining": 23
    }
    """
    user_data = current_user.get("user")
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )

    plan = user_data.get("plan", "free")
    used_generations = user_data.get("used_generations", 0)

    # Get plan limit from config
    limit = get_plan_limit(plan)
    remaining = max(0, limit - used_generations)

    return {
        "plan": plan,
        "used": used_generations,
        "limit": limit,
        "remaining": remaining,
    }
