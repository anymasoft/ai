"""WebSocket streaming endpoint."""

import asyncio
from db import get_api_conn, hash_api_key
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from api.auth import verify_api_key

router = APIRouter()


@router.websocket("/api/stream/{generation_id}")
async def stream_generation(
    websocket: WebSocket, generation_id: str, api_key: str = Query(...)
):
    """
    WebSocket endpoint for streaming generation progress.

    TODO: Integrate with existing WebSocket generation from routes/generate_code.py

    Current implementation:
    - Verifies API key
    - Checks generation ownership
    - Sends mock messages
    - Actual generation integration pending
    """

    # 1. Verify API key
    try:
        api_key_info = verify_api_key(api_key)
    except Exception:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    # 2. Check generation exists and belongs to this API key
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
        await websocket.close(code=1008, reason="Generation not found")
        return

    # 3. Accept connection
    await websocket.accept()

    generation_status = row[1]  # status from query above

    try:
        # Send initial status
        await websocket.send_json({
            "type": "status",
            "value": f"Generation {generation_status}",
            "variantIndex": 0
        })

        # If already completed or failed, send result immediately
        if generation_status in ("completed", "failed"):
            conn = get_api_conn()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT result_code, error_message, status
                FROM api_generations
                WHERE id = ?
            """, (generation_id,))

            row = cursor.fetchone()
            conn.close()

            if row:
                result_code, error_message, status = row

                if status == "completed" and result_code:
                    # Stream the result code as chunks (simulate streaming)
                    chunk_size = 1000
                    for i in range(0, len(result_code), chunk_size):
                        chunk = result_code[i:i+chunk_size]
                        await websocket.send_json({
                            "type": "chunk",
                            "value": chunk,
                            "variantIndex": 0
                        })

                    # Send completion message
                    await websocket.send_json({
                        "type": "variantComplete",
                        "value": "Generation complete",
                        "variantIndex": 0
                    })

                elif status == "failed":
                    await websocket.send_json({
                        "type": "variantError",
                        "value": error_message or "Generation failed",
                        "variantIndex": 0
                    })

            await websocket.close(code=1000)
            return

        # Otherwise, poll database for updates
        last_result_length = 0
        poll_count = 0
        max_polls = 600  # 5 minutes at 0.5s intervals

        while poll_count < max_polls:
            poll_count += 1

            # Check database for updates
            conn = get_api_conn()
            cursor = conn.cursor()

            cursor.execute("""
                SELECT result_code, error_message, status
                FROM api_generations
                WHERE id = ?
            """, (generation_id,))

            row = cursor.fetchone()
            conn.close()

            if not row:
                await websocket.send_json({
                    "type": "error",
                    "value": "Generation not found",
                    "variantIndex": 0
                })
                await websocket.close(code=1011)
                return

            result_code, error_message, status = row

            # Send new chunks if available
            if result_code and len(result_code) > last_result_length:
                new_chunk = result_code[last_result_length:]
                await websocket.send_json({
                    "type": "chunk",
                    "value": new_chunk,
                    "variantIndex": 0
                })
                last_result_length = len(result_code)

            # Check if completed
            if status == "completed":
                await websocket.send_json({
                    "type": "variantComplete",
                    "value": "Generation complete",
                    "variantIndex": 0
                })
                await websocket.close(code=1000)
                return

            # Check if failed
            if status == "failed":
                await websocket.send_json({
                    "type": "variantError",
                    "value": error_message or "Generation failed",
                    "variantIndex": 0
                })
                await websocket.close(code=1011)
                return

            # Wait before next poll
            await asyncio.sleep(0.5)

        # Timeout
        await websocket.send_json({
            "type": "error",
            "value": "Generation timeout",
            "variantIndex": 0
        })
        await websocket.close(code=1011)

    except WebSocketDisconnect:
        # Client disconnected
        pass
    except Exception as e:
        # Error occurred
        print(f"[API_STREAM] Error streaming generation {generation_id}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "value": str(e),
                "variantIndex": 0
            })
            await websocket.close(code=1011)
        except:
            pass
