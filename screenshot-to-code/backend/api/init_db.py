"""Initialize API database schema."""

import sqlite3
import hashlib


def hash_api_key(key: str) -> str:
    """Hash API key."""
    return hashlib.sha256(key.encode()).hexdigest()


def init_api_tables():
    """Create API tables if they don't exist."""
    # Use separate database for API to avoid schema conflicts with UI database
    conn = sqlite3.connect("data/api.db")
    cursor = conn.cursor()

    # Check if api_keys table exists
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='api_keys'
    """)

    table_exists = cursor.fetchone() is not None

    if table_exists:
        # Table exists - check if it needs migration
        cursor.execute("PRAGMA table_info(api_keys)")
        columns = {row[1] for row in cursor.fetchall()}

        # Add missing columns if needed
        if "is_active" not in columns:
            print("[DB] Adding is_active column to api_keys")
            cursor.execute("ALTER TABLE api_keys ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")

        if "rate_limit_concurrent" not in columns:
            print("[DB] Adding rate_limit_concurrent column to api_keys")
            cursor.execute("ALTER TABLE api_keys ADD COLUMN rate_limit_concurrent INTEGER NOT NULL DEFAULT 10")

        if "rate_limit_hourly" not in columns:
            print("[DB] Adding rate_limit_hourly column to api_keys")
            cursor.execute("ALTER TABLE api_keys ADD COLUMN rate_limit_hourly INTEGER NOT NULL DEFAULT 100")

        if "tier" not in columns:
            print("[DB] Adding tier column to api_keys")
            cursor.execute("ALTER TABLE api_keys ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'")

        if "credits_total" not in columns:
            print("[DB] Adding credits_total column to api_keys")
            cursor.execute("ALTER TABLE api_keys ADD COLUMN credits_total INTEGER NOT NULL DEFAULT 0")

        if "credits_used" not in columns:
            print("[DB] Adding credits_used column to api_keys")
            cursor.execute("ALTER TABLE api_keys ADD COLUMN credits_used INTEGER NOT NULL DEFAULT 0")

    else:
        # Create new table
        cursor.execute(
            """
            CREATE TABLE api_keys (
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
            """
        )

    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)"
    )

    # Create generations table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS generations (
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
        """
    )

    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_generations_api_key ON generations(api_key_id, created_at DESC)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at)"
    )

    # Insert default development API key if not exists
    dev_key = "sk_test_development_key_12345678"
    dev_key_hash = hash_api_key(dev_key)

    cursor.execute(
        """
        INSERT OR IGNORE INTO api_keys (
            id, key_hash, name, tier, credits_total, credits_used
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        ("key_dev_default", dev_key_hash, "Development Key", "pro", 10000, 0),
    )

    conn.commit()
    conn.close()

    print("[OK] API tables initialized")
    print(f"[OK] Development API key: {dev_key}")


if __name__ == "__main__":
    init_api_tables()
