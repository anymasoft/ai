"""Feedback endpoint - user sends message to admin."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import sqlite3
import uuid
import time

router = APIRouter()


class FeedbackRequest(BaseModel):
    """Feedback message from user."""

    message: str
    email: str  # User's email (from frontend/session)
    firstName: str | None = None
    lastName: str | None = None


@router.post("/feedback")
async def send_feedback(feedback: FeedbackRequest):
    """
    Send feedback message from user to admin.

    Request body:
    {
        "message": "Text of feedback",
        "email": "user@example.com",
        "firstName": "John",  // optional
        "lastName": "Doe"     // optional
    }

    Returns:
    {
        "success": true
    }
    """
    if not feedback.message or not feedback.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_input", "message": "Message is required"},
        )

    if not feedback.email or not feedback.email.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_input", "message": "Email is required"},
        )

    conn = sqlite3.connect("data/app.db")
    cursor = conn.cursor()

    try:
        # Generate subject from first 50 chars of message
        subject = (
            feedback.message[:50] + "..."
            if len(feedback.message) > 50
            else feedback.message
        )

        # Get userId if user exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (feedback.email,))
        row = cursor.fetchone()
        user_id = row[0] if row else None

        # Save message
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
                feedback.message,
                user_id,
                created_at,
            ),
        )

        conn.commit()

        return {"success": True}

    except Exception as e:
        conn.rollback()
        print(f"[FEEDBACK] Error saving message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to save message"},
        )

    finally:
        conn.close()
