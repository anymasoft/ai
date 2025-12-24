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
        # Set pragmas for performance and reliability
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                plan_id TEXT,
                role TEXT DEFAULT 'user',
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

        # Create generations table (metadata only - NO html/model/duration stored here)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                input_image_sha256 TEXT,
                error_message TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Create generation_variants table (stores individual variant results with model info)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS generation_variants (
                generation_id TEXT,
                variant_index INTEGER,
                model TEXT NOT NULL,
                status TEXT NOT NULL,
                html TEXT,
                error_message TEXT,
                duration_ms INTEGER,
                created_at TEXT NOT NULL,
                PRIMARY KEY (generation_id, variant_index),
                FOREIGN KEY (generation_id) REFERENCES generations(id)
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

        # Create admin_messages table (for feedback system)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_messages (
                id TEXT PRIMARY KEY,
                email TEXT,
                firstName TEXT,
                lastName TEXT,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                userId TEXT,
                createdAt INTEGER NOT NULL,
                isRead INTEGER DEFAULT 0,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
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

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_generation_variants_generation
            ON generation_variants(generation_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_messages_createdAt
            ON admin_messages(createdAt DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_messages_isRead
            ON admin_messages(isRead, createdAt DESC)
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
    status: str,
    input_image_sha256: Optional[str] = None,
    error_message: Optional[str] = None,
    user_id: Optional[str] = None,
    generation_id: Optional[str] = None,
) -> str:
    """
    Save a generation record to the database (metadata only).
    Returns the generation_id.
    If generation_id is not provided, a new UUID will be generated.

    Note: Individual variant data (html, model, duration) is stored in generation_variants.
    """
    conn = get_conn()
    cursor = conn.cursor()

    if generation_id is None:
        generation_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    try:
        cursor.execute("""
            INSERT INTO generations
            (id, user_id, created_at, status, input_image_sha256, error_message)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            generation_id,
            user_id,
            now,
            status,
            input_image_sha256,
            error_message,
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
    error_message: Optional[str] = None,
) -> None:
    """Update a generation record (metadata only).

    Note: Individual variant html/duration is stored in generation_variants.
    """
    conn = get_conn()
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
                SELECT id, user_id, created_at, status
                FROM generations
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
        else:
            cursor.execute("""
                SELECT id, user_id, created_at, status
                FROM generations
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))

        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    finally:
        conn.close()


def save_generation_variant(
    generation_id: str,
    variant_index: int,
    model: str,
    status: str,
    html: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    """
    Save a generation variant record (individual model output).
    This captures results immediately when variant completes.
    """
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    try:
        # Try INSERT first
        cursor.execute("""
            INSERT INTO generation_variants
            (generation_id, variant_index, model, status, html, error_message, duration_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            generation_id,
            variant_index,
            model,
            status,
            html,
            error_message,
            duration_ms,
            now,
        ))
        conn.commit()
        print(f"[DB] saved variant {variant_index} for generation {generation_id}")

    except sqlite3.IntegrityError:
        # If variant already exists, update it
        try:
            cursor.execute("""
                UPDATE generation_variants
                SET model = ?, status = ?, html = ?, error_message = ?, duration_ms = ?
                WHERE generation_id = ? AND variant_index = ?
            """, (
                model,
                status,
                html,
                error_message,
                duration_ms,
                generation_id,
                variant_index,
            ))
            conn.commit()
            print(f"[DB] updated variant {variant_index} for generation {generation_id}")
        except Exception as e:
            conn.rollback()
            print(f"[DB] error updating variant: {e}")
            raise

    except Exception as e:
        conn.rollback()
        print(f"[DB] error saving variant: {e}")
        raise
    finally:
        conn.close()


def get_generation_variants(generation_id: str) -> list:
    """Get all variants for a generation."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT generation_id, variant_index, model, status, html, error_message, duration_ms, created_at
            FROM generation_variants
            WHERE generation_id = ?
            ORDER BY variant_index
        """, (generation_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    finally:
        conn.close()


def delete_generation(generation_id: str) -> None:
    """Delete a generation and all its variants."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        # Delete all variants for this generation first
        cursor.execute("""
            DELETE FROM generation_variants
            WHERE generation_id = ?
        """, (generation_id,))

        # Delete the generation itself
        cursor.execute("""
            DELETE FROM generations
            WHERE id = ?
        """, (generation_id,))

        conn.commit()
        print(f"[DB] Deleted generation {generation_id}")

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
