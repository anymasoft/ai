"""SQLite database module with idempotent schema initialization."""
import sqlite3
import os
from pathlib import Path
from typing import Optional
import hashlib
import uuid
from datetime import datetime

# Database configuration
DB_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DB_DIR / "app.db"


def get_db_path() -> Path:
    """Get the database path."""
    return DB_PATH


def get_conn() -> sqlite3.Connection:
    """Get a connection to the SQLite database."""
    DB_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize database with idempotent schema creation (IF NOT EXISTS)."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                plan_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (plan_id) REFERENCES plans(id)
            )
        """)

        # Create plans table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                monthly_price_cents INTEGER,
                monthly_generation_limit INTEGER,
                monthly_token_limit INTEGER,
                created_at TEXT NOT NULL
            )
        """)

        # Create api_keys table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                key_hash TEXT UNIQUE NOT NULL,
                key_prefix TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Create generations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TEXT NOT NULL,
                model TEXT NOT NULL,
                status TEXT NOT NULL,
                input_image_sha256 TEXT,
                html TEXT,
                error_message TEXT,
                duration_ms INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Create usage_events table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage_events (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TEXT NOT NULL,
                generation_id TEXT,
                tokens_prompt INTEGER,
                tokens_completion INTEGER,
                total_tokens INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (generation_id) REFERENCES generations(id)
            )
        """)

        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_generations_user_created
            ON generations(user_id, created_at)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_keys_user
            ON api_keys(user_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
            ON usage_events(user_id, created_at)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_generations_created
            ON generations(created_at)
        """)

        conn.commit()
        print(f"[DB] initialized successfully at {DB_PATH}")

    except Exception as e:
        conn.rollback()
        print(f"[DB] error during initialization: {e}")
        raise
    finally:
        conn.close()


def save_generation(
    model: str,
    status: str,
    html: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
    input_image_sha256: Optional[str] = None,
    user_id: Optional[str] = None,
    generation_id: Optional[str] = None,
) -> str:
    """
    Save a generation record to the database.
    Returns the generation_id.
    If generation_id is not provided, a new UUID will be generated.
    """
    conn = get_conn()
    cursor = conn.cursor()

    if generation_id is None:
        generation_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    try:
        cursor.execute("""
            INSERT INTO generations
            (id, user_id, created_at, model, status, html, error_message, duration_ms, input_image_sha256)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            generation_id,
            user_id,
            now,
            model,
            status,
            html,
            error_message,
            duration_ms,
            input_image_sha256,
        ))
        conn.commit()
        print(f"[DB] saved generation id={generation_id} status={status}")
        return generation_id

    except Exception as e:
        conn.rollback()
        print(f"[DB] error saving generation: {e}")
        raise
    finally:
        conn.close()


def update_generation(
    generation_id: str,
    status: Optional[str] = None,
    html: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    """Update a generation record."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        updates = []
        params = []

        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if html is not None:
            updates.append("html = ?")
            params.append(html)
        if error_message is not None:
            updates.append("error_message = ?")
            params.append(error_message)
        if duration_ms is not None:
            updates.append("duration_ms = ?")
            params.append(duration_ms)

        if not updates:
            return

        params.append(generation_id)
        query = f"UPDATE generations SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
        print(f"[DB] updated generation id={generation_id}")

    except Exception as e:
        conn.rollback()
        print(f"[DB] error updating generation: {e}")
        raise
    finally:
        conn.close()


def get_generation(generation_id: str) -> Optional[dict]:
    """Get a generation record by id."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM generations WHERE id = ?", (generation_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    finally:
        conn.close()


def list_generations(limit: int = 20, user_id: Optional[str] = None) -> list:
    """List generations, optionally filtered by user_id."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        if user_id:
            cursor.execute("""
                SELECT id, user_id, created_at, model, status
                FROM generations
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
        else:
            cursor.execute("""
                SELECT id, user_id, created_at, model, status
                FROM generations
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))

        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    finally:
        conn.close()


def record_usage_event(
    generation_id: Optional[str] = None,
    tokens_prompt: Optional[int] = None,
    tokens_completion: Optional[int] = None,
    total_tokens: Optional[int] = None,
    user_id: Optional[str] = None,
) -> str:
    """Record a usage event."""
    conn = get_conn()
    cursor = conn.cursor()

    event_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    try:
        cursor.execute("""
            INSERT INTO usage_events
            (id, user_id, created_at, generation_id, tokens_prompt, tokens_completion, total_tokens)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            event_id,
            user_id,
            now,
            generation_id,
            tokens_prompt,
            tokens_completion,
            total_tokens,
        ))
        conn.commit()
        return event_id

    except Exception as e:
        conn.rollback()
        print(f"[DB] error recording usage event: {e}")
        raise
    finally:
        conn.close()
