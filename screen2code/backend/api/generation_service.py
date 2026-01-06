"""Background generation service for API."""

import asyncio
from db import get_api_conn, get_db_path
import sqlite3
from datetime import datetime
from typing import Dict, Any, Optional


class DatabaseWebSocket:
    """
    Mock WebSocket that stores chunks in database instead of streaming.

    This allows API generations to reuse the existing WebSocket-based pipeline
    by writing results to the database instead of streaming to a client.

    Chunks are stored with indices to prevent duplicates on reconnect.
    """

    def __init__(self, generation_id: str):
        self.generation_id = generation_id
        self.db_path = str(get_db_path())  # Use correct database path
        self.chunk_index = 0  # Track chunk number for streaming
        self.is_closed = False

    async def accept(self) -> None:
        """Mock accept - does nothing."""
        pass

    async def send_json(self, data: Dict[str, Any]) -> None:
        """Store chunks in database with index, update status on completion."""
        if self.is_closed:
            return

        msg_type = data.get("type")
        value = data.get("value", "")

        # Store chunks with index
        if msg_type == "chunk":
            self._store_chunk(value)

        # On completion, save to database
        elif msg_type in ["variantComplete", "generation_complete"]:
            self._update_generation(
                status="completed",
                completed_at=datetime.utcnow()
            )

        # On error, save error message
        elif msg_type in ["error", "variantError"]:
            self._update_generation(
                status="failed",
                error_message=value
            )

    async def close(self, code: int = 1000) -> None:
        """Mark as closed."""
        self.is_closed = True

    async def receive_json(self) -> Dict[str, str]:
        """Mock receive - not used in API mode."""
        # This should never be called in API mode
        raise NotImplementedError("receive_json not supported for API generations")

    def _store_chunk(self, chunk_data: str) -> None:
        """Store chunk with index in database."""
        conn = get_api_conn()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                INSERT INTO api_generation_chunks (generation_id, chunk_index, chunk_data)
                VALUES (?, ?, ?)
            """, (self.generation_id, self.chunk_index, chunk_data))

            conn.commit()
            print(f"[API_GEN] Stored chunk {self.chunk_index} for generation {self.generation_id}")
            self.chunk_index += 1

        except Exception as e:
            conn.rollback()
            print(f"[API_GEN] Error storing chunk: {e}")
            raise
        finally:
            conn.close()

    def _update_generation(
        self,
        status: Optional[str] = None,
        error_message: Optional[str] = None,
        completed_at: Optional[datetime] = None,
        model_used: Optional[str] = None,
    ) -> None:
        """Update generation in API database."""
        conn = get_api_conn()
        cursor = conn.cursor()

        try:
            updates = []
            params = []

            if status is not None:
                updates.append("status = ?")
                params.append(status)

            if error_message is not None:
                updates.append("error_message = ?")
                params.append(error_message)

            if completed_at is not None:
                updates.append("completed_at = ?")
                params.append(completed_at.isoformat())

            if model_used is not None:
                updates.append("model_used = ?")
                params.append(model_used)

            if not updates:
                return

            params.append(self.generation_id)
            query = f"UPDATE api_generations SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()
            print(f"[API_GEN] Updated generation {self.generation_id}: {status}")

        except Exception as e:
            conn.rollback()
            print(f"[API_GEN] Error updating generation: {e}")
            raise
        finally:
            conn.close()


async def trigger_generation(generation_id: str) -> None:
    """
    Trigger a background generation task using the existing queue system.

    This is the main entry point for starting a generation from the API.
    It reads the generation params from database and enqueues a job.

    IMPORTANT: All exceptions are caught and logged to the database.
    The generation record is updated to "failed" if anything goes wrong.
    """
    from gen_queue.generation_queue import enqueue_generation, GenerationJob
    import logging
    import traceback

    logger = logging.getLogger("api.generation")

    try:
        # 1. Read generation params from database
        conn = get_api_conn()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT format, input_type, input_data, instructions
                FROM api_generations
                WHERE id = ?
            """, (generation_id,))

            row = cursor.fetchone()
            if not row:
                error_msg = f"Generation record {generation_id} not found in database"
                logger.error(f"[API_GEN] {error_msg}")
                # Can't update generation if it doesn't exist
                return

            format_type, input_type, input_data, instructions = row

        finally:
            conn.close()

        logger.info(f"[API_GEN] Triggering generation {generation_id}: format={format_type}, input_type={input_type}")

        # 2. Convert API params to pipeline format
        params = {
            "generatedCodeConfig": format_type,
            "inputMode": input_type,  # "image" or "url"
            "openAiApiKey": None,  # API uses system keys
            "anthropicApiKey": None,
            "generationType": "create",
        }

        # Add input data based on type
        if input_type == "image":
            params["image"] = input_data  # base64 or URL
        elif input_type == "url":
            params["url"] = input_data

        # Add instructions if provided
        if instructions:
            params["description"] = instructions

        # 3. Create mock WebSocket that writes to database
        mock_websocket = DatabaseWebSocket(generation_id)

        # 4. Enqueue generation job (reuse existing queue system)
        job = GenerationJob(
            generation_id=generation_id,
            websocket=mock_websocket,
            params=params,
            websocket_already_accepted=True  # Mock websocket doesn't need accept
        )

        await enqueue_generation(job)
        logger.info(f"[API_GEN] Enqueued generation job {generation_id}")

    except Exception as e:
        # If ANYTHING fails, mark generation as failed
        logger.error(f"[API_GEN] Error triggering generation {generation_id}: {e}", exc_info=True)

        # Update generation record to "failed"
        try:
            conn = get_api_conn()
            cursor = conn.cursor()

            error_message = f"Generation failed: {str(e)}"
            cursor.execute("""
                UPDATE api_generations
                SET status = 'failed', error_message = ?, completed_at = ?
                WHERE id = ?
            """, (error_message, datetime.utcnow().isoformat(), generation_id))

            conn.commit()
            conn.close()
            logger.info(f"[API_GEN] Updated generation {generation_id} to failed status")

        except Exception as db_error:
            # Even updating DB failed, just log it
            logger.error(f"[API_GEN] Failed to update generation {generation_id} status to failed: {db_error}", exc_info=True)
