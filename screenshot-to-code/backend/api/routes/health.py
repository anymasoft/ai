"""Health check endpoint."""

from fastapi import APIRouter
from api.models.responses import HealthResponse

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint - no authentication required."""
    return HealthResponse(status="ok", version="1.0")
