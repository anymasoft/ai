"""Feedback endpoint - user sends message to admin."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import sqlite3
import uuid
import time
from config import DB_PATH
from db import get_db

router = APIRouter()


class FeedbackRequest(BaseModel):
    """Feedback message from user."""
    email: str
    message: str


@router.post("/api/feedback")
async def send_feedback(feedback: FeedbackRequest):
    """Send feedback message from user to admin."""

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
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = ?", (feedback.email,))
        row = cursor.fetchone()

        if row:
            user_id = row[0]
        else:
            user_id = str(uuid.uuid4())
            created_at = time.strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute(
                "INSERT INTO users (id, email, role, plan_id, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, feedback.email, "user", "free", created_at)
            )

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
                feedback.email,
                "",
                "",
                subject,
                feedback.message.strip(),
                user_id,
                created_at_ts,
            ),
        )

        conn.commit()
        conn.close()

        print(f"[FEEDBACK] Message saved: {message_id} from {feedback.email}")
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
