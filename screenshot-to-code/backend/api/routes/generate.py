"""Generate code endpoint."""

import uuid
import os
from db import get_api_conn, hash_api_key
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from api.models.requests import GenerateRequest
from api.models.responses import GenerateResponse
from api.auth import get_api_key
from api.credits import get_format_cost, deduct_credits_atomic

router = APIRouter()


def create_generation_id() -> str:
    """Generate unique generation ID."""
    return f"gen_{uuid.uuid4().hex[:16]}"


def save_generation(
    generation_id: str,
    api_key_id: str,
    request: GenerateRequest,
    credits_charged: int,
) -> None:
    """Save generation to database."""
    conn = get_api_conn()
    cursor = conn.cursor()

    # TODO: handle input_thumbnail generation for images
    input_thumbnail = None

    cursor.execute(
        """
        INSERT INTO api_generations (
            id, api_key_id, status, format, input_type, input_data,
            input_thumbnail, instructions, credits_charged, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            generation_id,
            api_key_id,
            "processing",
            request.format,
            request.input.type,
            request.input.data,
            input_thumbnail,
            request.instructions,
            credits_charged,
            datetime.utcnow(),
        ),
    )

    conn.commit()
    conn.close()


@router.post(
    "/api/generate",
    response_model=GenerateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Generation"],
)
async def generate_code(
    http_request: Request,
    request: GenerateRequest,
    api_key_info: dict = Depends(get_api_key)
):
    """
    Start code generation from image or URL.

    Credits are deducted immediately on success.
    Generation proceeds asynchronously.
    """

    # 1. Check tier access
    tier = api_key_info["tier"]
    if request.format in ["react_tailwind", "vue_tailwind"] and tier != "pro":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": f"Format '{request.format}' requires 'pro' tier",
            },
        )

    # 2. Calculate cost
    cost = get_format_cost(request.format)

    # 3. Generate ID first (before deducting credits)
    generation_id = create_generation_id()

    # 4. Atomically check and deduct credits in ONE operation
    # This prevents race conditions where multiple concurrent requests
    # could bypass the credit check
    api_key_id = api_key_info["id"]
    deduct_credits_atomic(api_key_id, cost)

    # 5. Save generation record
    save_generation(generation_id, api_key_id, request, cost)

    # 6. Trigger actual generation in background
    from api.generation_service import trigger_generation
    import asyncio
    asyncio.create_task(trigger_generation(generation_id))

    # 7. Build stream URL dynamically
    # Strategy:
    # 1. Use API_PUBLIC_BASE_URL environment variable if set (for production behind reverse proxy)
    # 2. Otherwise, construct from request URL (for local development)
    # 3. Replace http/https with ws/wss accordingly

    api_base_url = os.getenv("API_PUBLIC_BASE_URL")

    if api_base_url:
        # Production: use configured base URL
        # Should be like: https://api.example.com or http://localhost:7001
        stream_url = (
            api_base_url.replace("https://", "wss://")
            .replace("http://", "ws://")
            .rstrip("/")
        )
        stream_url = f"{stream_url}/api/stream/{generation_id}"
    else:
        # Development: construct from request
        # http://localhost:7001 -> ws://localhost:7001
        # https://example.com -> wss://example.com
        scheme = "wss" if http_request.url.scheme == "https" else "ws"
        netloc = http_request.url.netloc  # host:port
        stream_url = f"{scheme}://{netloc}/api/stream/{generation_id}"

    return GenerateResponse(
        generation_id=generation_id,
        status="processing",
        credits_charged=cost,
        stream_url=stream_url,
    )
