"""WebSocket streaming endpoint."""

import asyncio
import logging
from db import get_api_conn, hash_api_key
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from api.auth import verify_api_key

router = APIRouter()
logger = logging.getLogger("api.stream")


@router.websocket("/api/stream/{generation_id}")
async def stream_generation(
    websocket: WebSocket, generation_id: str, api_key: str | None = Query(None)
):
    """
    WebSocket endpoint for streaming generation progress.

    SECURITY NOTICE:
    - API key is passed in query parameter (visible in logs/history)
    - In production, this endpoint MUST be accessed via WSS (WebSocket Secure with HTTPS)
    - Never use ws:// (unencrypted) with API keys on untrusted networks
    - Prefer setting API_PUBLIC_BASE_URL to HTTPS to get wss:// URLs

    Authentication:
    - Requires X-API-Key query parameter
    - Returns 401 Unauthorized if missing or invalid
    """

    # 1. Validate API key is provided
    if not api_key:
        logger.warning(f"[API_STREAM] Stream connection attempt without API key for {generation_id}")
        await websocket.close(code=1008, reason="API key required")
        return

    # 2. Verify API key validity
    try:
        api_key_info = verify_api_key(api_key)
    except Exception as e:
        logger.warning(f"[API_STREAM] Invalid API key for {generation_id}: {e}")
        await websocket.close(code=1008, reason="Invalid API key")
        return

    # 3. Check generation exists and belongs to this API key
    conn = get_api_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, status FROM api_generations
        WHERE id = ? AND api_key_id = ?
        """,
        (generation_id, api_key_info["id"]),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        logger.warning(f"[API_STREAM] Generation {generation_id} not found for API key {api_key_info.get('id')}")
        await websocket.close(code=1008, reason="Generation not found")
        return

    # 4. Accept connection and start streaming
    logger.info(f"[API_STREAM] Accepted stream connection for {generation_id}")
    await websocket.accept()

    generation_status = row[1]  # status from query above

    try:
        # Send initial status
        await websocket.send_json({
            "type": "status",
            "message": f"Generation {generation_status}",
            "variant_index": 0
        })

        # If already completed or failed, send result immediately
        if generation_status in ("completed", "failed"):
            conn = get_api_conn()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT error_message, status
                FROM api_generations
                WHERE id = ?
            """, (generation_id,))

            row = cursor.fetchone()

            if row:
                error_message, status = row

                if status == "completed":
                    # Send all stored chunks in order
                    cursor.execute("""
                        SELECT chunk_index, chunk_data
                        FROM api_generation_chunks
                        WHERE generation_id = ?
                        ORDER BY chunk_index ASC
                    """, (generation_id,))

                    chunks = cursor.fetchall()

                    for chunk_index, chunk_data in chunks:
                        await websocket.send_json({
                            "type": "chunk",
                            "data": chunk_data,
                            "variant_index": 0
                        })

                    # Send completion message
                    await websocket.send_json({
                        "type": "variant_complete",
                        "variant_index": 0
                    })

                elif status == "failed":
                    await websocket.send_json({
                        "type": "error",
                        "error": "generation_failed",
                        "message": error_message or "Generation failed",
                        "variant_index": 0
                    })

            conn.close()
            await websocket.close(code=1000)
            return

        # Otherwise, poll database for updates with chunk index tracking
        last_chunk_index = -1  # Track last sent chunk index (start from -1 so first chunk 0 is sent)
        poll_count = 0
        max_polls = 1200  # 10 minutes at 0.5s intervals (was 5 minutes, now extended)

        while poll_count < max_polls:
            poll_count += 1

            # Check database for updates
            conn = get_api_conn()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT error_message, status
                FROM api_generations
                WHERE id = ?
            """, (generation_id,))

            row = cursor.fetchone()

            if not row:
                conn.close()
                await websocket.send_json({
                    "type": "error",
                    "error": "generation_not_found",
                    "message": "Generation not found",
                    "variant_index": 0
                })
                await websocket.close(code=1011)
                return

            error_message, status = row

            # Send new chunks (only chunks after last_chunk_index)
            cursor.execute("""
                SELECT chunk_index, chunk_data
                FROM api_generation_chunks
                WHERE generation_id = ? AND chunk_index > ?
                ORDER BY chunk_index ASC
            """, (generation_id, last_chunk_index))

            chunks = cursor.fetchall()
            conn.close()

            # Send each new chunk
            for chunk_index, chunk_data in chunks:
                await websocket.send_json({
                    "type": "chunk",
                    "data": chunk_data,
                    "variant_index": 0
                })
                last_chunk_index = chunk_index

            # Check if completed
            if status == "completed":
                await websocket.send_json({
                    "type": "variant_complete",
                    "variant_index": 0
                })
                await websocket.close(code=1000)
                return

            # Check if failed
            if status == "failed":
                await websocket.send_json({
                    "type": "error",
                    "error": "generation_failed",
                    "message": error_message or "Generation failed",
                    "variant_index": 0
                })
                await websocket.close(code=1011)
                return

            # Wait before next poll
            await asyncio.sleep(0.5)

        # Timeout
        await websocket.send_json({
            "type": "error",
            "error": "generation_timeout",
            "message": "Generation took too long (10 minute timeout)",
            "variant_index": 0
        })
        await websocket.close(code=1011)

    except WebSocketDisconnect:
        # Client disconnected gracefully
        pass
    except Exception as e:
        # Unexpected error occurred
        print(f"[API_STREAM] Error streaming generation {generation_id}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "error": "internal_error",
                "message": "Internal server error",
                "variant_index": 0
            })
            await websocket.close(code=1011)
        except:
            # Even sending error failed, give up gracefully
            pass
