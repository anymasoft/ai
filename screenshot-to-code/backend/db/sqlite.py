"""SQLite database module with idempotent schema initialization - SINGLE DATABASE."""
import sqlite3
import os
from pathlib import Path
from typing import Optional
import hashlib
import uuid
from datetime import datetime

# Database configuration - SINGLE SOURCE OF TRUTH
DB_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DB_DIR / "app.db"


def get_db_path() -> Path:
    """Get the database path."""
    return DB_PATH


def get_conn() -> sqlite3.Connection:
    """Get a connection to the SQLite database (for UI generations)."""
    DB_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def get_api_conn() -> sqlite3.Connection:
    """Get a connection to the SQLite database (for API generations).

    SAME DATABASE as get_conn(), just a semantic alias for API code.
    """
    DB_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def hash_api_key(key: str) -> str:
    """Hash API key for storage."""
    return hashlib.sha256(key.encode()).hexdigest()


def init_db() -> None:
    """Initialize database with idempotent schema creation (IF NOT EXISTS)."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        # Set pragmas for performance and reliability
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")

        # ====================
        # USER/AUTH TABLES
        # ====================

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                name TEXT,
                plan_id TEXT,
                plan TEXT DEFAULT 'free',
                role TEXT DEFAULT 'user',
                disabled INTEGER DEFAULT 0,
                expiresAt INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (plan_id) REFERENCES plans(id)
            )
        """)

        # Add missing columns if they don't exist (for migration from old schema)
        try:
            cursor.execute("PRAGMA table_info(users)")
            columns = [row[1] for row in cursor.fetchall()]

            if 'name' not in columns:
                cursor.execute("ALTER TABLE users ADD COLUMN name TEXT")
            if 'plan' not in columns:
                cursor.execute("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'")
            if 'disabled' not in columns:
                cursor.execute("ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0")
            if 'expiresAt' not in columns:
                cursor.execute("ALTER TABLE users ADD COLUMN expiresAt INTEGER")
            if 'updated_at' not in columns:
                cursor.execute("ALTER TABLE users ADD COLUMN updated_at TEXT")
        except Exception as e:
            print(f"[DB] Migration warning (non-critical): {e}")

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

        # ====================
        # API SYSTEM TABLES (REST API)
        # ====================

        # Create api_keys table (for REST API authentication)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                key_hash TEXT NOT NULL UNIQUE,
                name TEXT,
                tier TEXT NOT NULL DEFAULT 'free',
                credits_total INTEGER NOT NULL DEFAULT 0,
                credits_used INTEGER NOT NULL DEFAULT 0,
                rate_limit_concurrent INTEGER NOT NULL DEFAULT 10,
                rate_limit_hourly INTEGER NOT NULL DEFAULT 100,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP,
                is_active BOOLEAN NOT NULL DEFAULT 1
            )
        """)

        # Create API generations table (for REST API)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_generations (
                id TEXT PRIMARY KEY,
                api_key_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'processing',
                format TEXT NOT NULL,
                input_type TEXT NOT NULL,
                input_data TEXT NOT NULL,
                input_thumbnail TEXT,
                instructions TEXT,
                result_code TEXT,
                error_message TEXT,
                credits_charged INTEGER NOT NULL,
                model_used TEXT,
                duration_ms INTEGER,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
            )
        """)

        # ====================
        # UI SYSTEM TABLES (Web Interface)
        # ====================

        # Create UI generations table (for web interface)
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

        # ====================
        # ADMIN/FEEDBACK TABLES
        # ====================

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

        # ====================
        # INDEXES
        # ====================

        # API indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_keys_hash
            ON api_keys(key_hash)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_keys_active
            ON api_keys(is_active)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_generations_api_key
            ON api_generations(api_key_id, created_at DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_generations_status
            ON api_generations(status)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_api_generations_created
            ON api_generations(created_at)
        """)

        # UI indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_generations_user_created
            ON generations(user_id, created_at)
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

        # Admin indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_messages_createdAt
            ON admin_messages(createdAt DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_messages_isRead
            ON admin_messages(isRead, createdAt DESC)
        """)

        # ====================
        # DEFAULT DATA
        # ====================

        # Insert default development API key if not exists
        dev_key = "sk_test_development_key_12345678"
        dev_key_hash = hash_api_key(dev_key)

        cursor.execute("""
            INSERT OR IGNORE INTO api_keys (
                id, key_hash, name, tier, credits_total, credits_used
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, ("key_dev_default", dev_key_hash, "Development Key", "pro", 10000, 0))

        conn.commit()
        print(f"[DB] Initialized successfully at {DB_PATH}")
        print(f"[DB] Development API key: {dev_key}")

    except Exception as e:
        conn.rollback()
        print(f"[DB] Error during initialization: {e}")
        raise
    finally:
        conn.close()


# ====================
# UI GENERATION FUNCTIONS
# ====================

def save_generation(
    status: str,
    input_image_sha256: Optional[str] = None,
    error_message: Optional[str] = None,
    user_id: Optional[str] = None,
    generation_id: Optional[str] = None,
) -> str:
    """
    Save a UI generation record to the database (metadata only).
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
        print(f"[DB] Saved UI generation id={generation_id} status={status}")
        return generation_id

    except Exception as e:
        conn.rollback()
        print(f"[DB] Error saving UI generation: {e}")
        raise
    finally:
        conn.close()


def update_generation(
    generation_id: str,
    status: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """Update a UI generation record (metadata only).

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
        print(f"[DB] Updated UI generation id={generation_id}")

    except Exception as e:
        conn.rollback()
        print(f"[DB] Error updating UI generation: {e}")
        raise
    finally:
        conn.close()


def get_generation(generation_id: str) -> Optional[dict]:
    """Get a UI generation record by id."""
    conn = get_conn()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM generations WHERE id = ?", (generation_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    finally:
        conn.close()


def list_generations(limit: int = 20, user_id: Optional[str] = None) -> list:
    """List UI generations, optionally filtered by user_id."""
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
        print(f"[DB] Saved variant {variant_index} for generation {generation_id}")

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
            print(f"[DB] Updated variant {variant_index} for generation {generation_id}")
        except Exception as e:
            conn.rollback()
            print(f"[DB] Error updating variant: {e}")
            raise

    except Exception as e:
        conn.rollback()
        print(f"[DB] Error saving variant: {e}")
        raise
    finally:
        conn.close()


def get_generation_variants(generation_id: str) -> list:
    """Get all variants for a UI generation."""
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
    """Delete a UI generation and all its variants."""
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
        print(f"[DB] Deleted UI generation {generation_id}")

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
        print(f"[DB] Error recording usage event: {e}")
        raise
    finally:
        conn.close()
