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
    user_id: str,
    request: GenerateRequest,
    credits_charged: int,
) -> None:
    """Save generation to database with retry logic for database locks."""
    import time
    import sqlite3

    # TODO: handle input_thumbnail generation for images
    input_thumbnail = None

    max_retries = 3
    retry_delay = 0.1  # 100ms

    for attempt in range(max_retries):
        try:
            conn = get_api_conn()
            cursor = conn.cursor()

            cursor.execute(
                """
                INSERT INTO api_generations (
                    id, user_id, status, format, input_type, input_data,
                    input_thumbnail, instructions, credits_charged, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    generation_id,
                    user_id,
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
            return

        except sqlite3.OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            else:
                conn.rollback()
                conn.close()
                raise
        except Exception as e:
            conn.rollback()
            conn.close()
            raise


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
    import logging
    logger = logging.getLogger("api.generate")

    try:
        # 1. Calculate cost
        cost = get_format_cost(request.format)

        # 2. Generate ID first (before deducting credits)
        generation_id = create_generation_id()

        # 3. Atomically check and deduct credits from user account
        # This prevents race conditions where multiple concurrent requests
        # could bypass the credit check
        user_id = api_key_info["user_id"]
        deduct_credits_atomic(user_id, cost)

        # 4. Save generation record
        save_generation(generation_id, user_id, request, cost)

        # 5. Trigger actual generation in background
        from api.generation_service import trigger_generation
        import asyncio

        # Create task for background generation
        task = asyncio.create_task(trigger_generation(generation_id))

        # Add callback to catch any unhandled exceptions
        def handle_generation_error(task_obj):
            try:
                # If task failed, the exception will be here
                task_obj.result()
            except asyncio.CancelledError:
                # Task was cancelled, ignore
                pass
            except Exception as e:
                # Task raised an exception
                # Note: trigger_generation already catches exceptions and updates DB,
                # but this callback ensures we log any unexpected issues
                logger.error(f"Unexpected error in generation task {generation_id}: {e}", exc_info=True)

        task.add_done_callback(handle_generation_error)

        # 6. Build stream URL dynamically
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

    except HTTPException as e:
        # Re-raise FastAPI HTTPException (e.g., from authentication)
        logger.error(f"HTTP error in /api/generate: {e.detail}")
        raise

    except ValueError as e:
        # Invalid format, insufficient credits, etc.
        logger.error(f"Validation error in /api/generate: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except Exception as e:
        import sqlite3
        # Database is locked - return 503 with JSON
        if isinstance(e, sqlite3.OperationalError) and "database is locked" in str(e):
            logger.warning(f"Database locked in /api/generate: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database busy, try again"
            )

        # Catch all other exceptions (DB errors, generation service errors, etc.)
        logger.error(f"Unexpected error in /api/generate: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Generation request failed. Please try again."
        )
