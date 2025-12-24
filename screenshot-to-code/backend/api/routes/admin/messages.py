"""Admin endpoints for managing feedback messages."""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from api.admin_auth import get_admin_user
import sqlite3
from typing import Optional
from db import get_conn as get_db

router = APIRouter()


@router.get("/api/admin/messages")
async def get_messages(
    admin: dict = Depends(get_admin_user),
    page: int = Query(1, ge=1),
    email: Optional[str] = Query(None),
    readStatus: Optional[str] = Query("all"),  # all | unread | read
):
    """
    Get paginated list of feedback messages.

    Query params:
    - page: page number (default: 1)
    - email: filter by email (optional)
    - readStatus: 'all' | 'unread' | 'read' (default: 'all')

    Returns:
    {
        "messages": [...],
        "pagination": {
            "page": 1,
            "limit": 10,
            "total": 25,
            "totalPages": 3,
            "hasMore": true
        }
    }
    """
    limit = 10
    offset = (page - 1) * limit

    # Build WHERE clause
    conditions = []
    params = []

    if email:
        conditions.append("email LIKE ?")
        params.append(f"%{email}%")

    if readStatus == "unread":
        conditions.append("isRead = 0")
    elif readStatus == "read":
        conditions.append("isRead = 1")

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    conn = get_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Get total count
        cursor.execute(
            f"SELECT COUNT(*) as total FROM admin_messages {where_clause}",
            params,
        )
        total = cursor.fetchone()["total"]

        # Get messages
        cursor.execute(
            f"""
            SELECT id, email, firstName, lastName, subject, message, createdAt, isRead
            FROM admin_messages
            {where_clause}
            ORDER BY createdAt DESC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        )

        messages = [dict(row) for row in cursor.fetchall()]

        total_pages = (total + limit - 1) // limit  # ceil division

        return {
            "messages": messages,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": total_pages,
                "hasMore": page < total_pages,
            },
        }

    finally:
        conn.close()


@router.get("/api/admin/messages/unread-count")
async def get_unread_count(admin: dict = Depends(get_admin_user)):
    """
    Get count of unread messages.

    Returns:
    {
        "count": 5
    }
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT COUNT(*) FROM admin_messages WHERE isRead = 0")
        count = cursor.fetchone()[0]
        return {"count": count}

    finally:
        conn.close()


@router.get("/api/admin/messages/{message_id}")
async def get_message(message_id: str, admin: dict = Depends(get_admin_user)):
    """
    Get single message by ID.

    Returns:
    {
        "id": "...",
        "email": "...",
        "firstName": "...",
        "lastName": "...",
        "subject": "...",
        "message": "...",
        "userId": "..." | null,
        "createdAt": 1234567890,
        "isRead": 0 | 1
    }
    """
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT id, email, firstName, lastName, subject, message,
                   userId, createdAt, isRead
            FROM admin_messages
            WHERE id = ?
            """,
            (message_id,),
        )

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "Message not found"},
            )

        return dict(row)

    finally:
        conn.close()


@router.patch("/api/admin/messages/{message_id}/read")
async def mark_as_read(message_id: str, admin: dict = Depends(get_admin_user)):
    """
    Mark message as read.

    Returns:
    {
        "success": true
    }
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "UPDATE admin_messages SET isRead = 1 WHERE id = ?",
            (message_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "Message not found"},
            )

        conn.commit()
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error marking message as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to update message"},
        )

    finally:
        conn.close()


@router.delete("/api/admin/messages/{message_id}")
async def delete_message(message_id: str, admin: dict = Depends(get_admin_user)):
    """
    Delete message by ID.

    Returns:
    {
        "success": true
    }
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM admin_messages WHERE id = ?", (message_id,))

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "not_found", "message": "Message not found"},
            )

        conn.commit()
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        print(f"[ADMIN] Error deleting message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "internal_error", "message": "Failed to delete message"},
        )

    finally:
        conn.close()
