"""Feedback endpoint - user sends message to admin."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import sqlite3
import uuid
import time
from pathlib import Path

router = APIRouter()

DB_PATH = Path(__file__).parent.parent.parent / "data" / "app.db"


class FeedbackRequest(BaseModel):
    """Feedback message from user."""

    message: str
    email: str
    firstName: str | None = None
    lastName: str | None = None


@router.post("/feedback")
async def send_feedback(feedback: FeedbackRequest):
    """
    Send feedback message from user to admin.

    Request body:
    {
        "message": "Text of feedback",
        "email": "user@example.com"
    }

    Returns:
    {
        "success": true
    }
    """
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

    if not feedback.email or not feedback.email.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_input", "message": "Email обязателен"},
        )

    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        subject = (
            feedback.message.strip()[:50] + "..."
            if len(feedback.message.strip()) > 50
            else feedback.message.strip()
        )

        cursor.execute("SELECT id FROM users WHERE email = ?", (feedback.email,))
        row = cursor.fetchone()
        user_id = row[0] if row else None

        message_id = str(uuid.uuid4())
        created_at = int(time.time())

        cursor.execute(
            """
            INSERT INTO admin_messages
            (id, email, firstName, lastName, subject, message, userId, createdAt, isRead)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            (
                message_id,
                feedback.email,
                feedback.firstName or "",
                feedback.lastName or "",
                subject,
                feedback.message.strip(),
                user_id,
                created_at,
            ),
        )

        conn.commit()
        conn.close()

        print(f"[FEEDBACK] Message saved: {message_id} from {feedback.email}")
        return {"success": True}

    except sqlite3.OperationalError as e:
        print(f"[FEEDBACK] Database error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "database_error", "message": "Ошибка базы данных. Возможно, таблица admin_messages не создана."},
        )
    except Exception as e:
        print(f"[FEEDBACK] Error saving message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Не удалось сохранить сообщение"},
        )
