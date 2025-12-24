"""Response models."""

from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    version: str = "1.0"


class FormatInfo(BaseModel):
    """Format information."""

    id: str
    name: str
    tier: Literal["free", "pro"]
    cost: int
    beta: bool = False


class FormatsResponse(BaseModel):
    """List of available formats."""

    formats: list[FormatInfo]


class GenerateResponse(BaseModel):
    """Response after starting generation."""

    generation_id: str
    status: Literal["processing"]
    credits_charged: int
    stream_url: str


class InputInfo(BaseModel):
    """Input information for generation."""

    type: Literal["image", "url"]
    preview: str | None = None


class ResultInfo(BaseModel):
    """Generation result."""

    code: str | None = None
    preview_url: str | None = None


class GenerationDetail(BaseModel):
    """Detailed generation information."""

    id: str
    status: Literal["processing", "completed", "failed"]
    format: str
    created_at: datetime
    completed_at: datetime | None = None
    input: InputInfo
    result: ResultInfo
    error: str | None = None
    credits_charged: int


class CreditsInfo(BaseModel):
    """Credits information."""

    available: int
    total: int
    used: int


class RateLimitInfo(BaseModel):
    """Rate limit information."""

    limit: int
    current: int
    reset_at: datetime | None = None


class RateLimitsInfo(BaseModel):
    """All rate limits."""

    concurrent_generations: RateLimitInfo
    generations_per_hour: RateLimitInfo


class LimitsResponse(BaseModel):
    """Usage and limits response."""

    credits: CreditsInfo
    rate_limits: RateLimitsInfo
    tier: Literal["free", "pro"]


class ErrorResponse(BaseModel):
    """Error response."""

    error: str
    message: str
