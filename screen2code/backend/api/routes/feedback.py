"""Feedback endpoint - user sends message to admin."""

from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel
import sqlite3
import uuid
import time
from db import get_conn as get_db
from api.routes.auth import get_current_user

router = APIRouter()


class FeedbackRequest(BaseModel):
    """Feedback message from user."""
    message: str


@router.post("/api/feedback")
async def send_feedback(
    feedback: FeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    """Send feedback message from authenticated user to admin."""

    user_data = current_user.get("user")
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )

    user_email = user_data.get("email")
    user_name = user_data.get("name", "")
    user_id = user_data.get("id")

    if not feedback.message or not feedback.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_input", "message": "Сообщение обязательно"},
        )

    if len(feedback.message.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_input", "message": "Сообщение должно содержать минимум 10 символов"},
        )

    try:
        conn = get_db()
        cursor = conn.cursor()

        # Parse firstName and lastName from user_name
        name_parts = user_name.split(" ", 1) if user_name else ["", ""]
        first_name = name_parts[0] if len(name_parts) > 0 else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        subject = (
            feedback.message.strip()[:50] + "..."
            if len(feedback.message.strip()) > 50
            else feedback.message.strip()
        )

        message_id = str(uuid.uuid4())
        created_at_ts = int(time.time())

        cursor.execute(
            """
            INSERT INTO admin_messages
            (id, email, firstName, lastName, subject, message, userId, createdAt, isRead)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            (
                message_id,
                user_email,
                first_name,
                last_name,
                subject,
                feedback.message.strip(),
                user_id,
                created_at_ts,
            ),
        )

        conn.commit()
        conn.close()

        print(f"[FEEDBACK] Message saved: {message_id} from {user_email}")
        return {"ok": True}

    except sqlite3.OperationalError as e:
        print(f"[FEEDBACK] Database error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "database_error", "message": "Ошибка базы данных"},
        )
    except Exception as e:
        print(f"[FEEDBACK] Error saving message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Не удалось сохранить сообщение"},
        )
