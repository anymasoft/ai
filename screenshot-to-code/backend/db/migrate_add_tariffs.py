"""Migration: Add tariffs table for managing pricing."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "app.db"


def migrate():
    """Create tariffs table with pricing and credits management."""
    # Ensure data directory exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        print("[MIGRATION] Creating tariffs table...")

        # Create tariffs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tariffs (
                key TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price_rub REAL NOT NULL,
                credits INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("[MIGRATION] Created tariffs table")

        # Insert default tariffs if they don't exist
        cursor.execute("SELECT COUNT(*) FROM tariffs")
        count = cursor.fetchone()[0]

        if count == 0:
            print("[MIGRATION] Inserting default tariffs...")
            default_tariffs = [
                ("free", "Free", 0.0, 0),
                ("basic", "Basic", 3000.0, 100),
                ("professional", "Professional", 14000.0, 500),
            ]

            for key, name, price, credits in default_tariffs:
                cursor.execute("""
                    INSERT INTO tariffs (key, name, price_rub, credits)
                    VALUES (?, ?, ?, ?)
                """, (key, name, price, credits))
            print("[MIGRATION] Inserted default tariffs")
        else:
            print("[MIGRATION] Tariffs already exist, skipping insertion")

        conn.commit()
        print("[MIGRATION] Success! Tariffs table created.")

    except Exception as e:
        conn.rollback()
        print(f"[MIGRATION] Error: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
