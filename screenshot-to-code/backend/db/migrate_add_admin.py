"""Migration: Add admin role and admin_messages table."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "app.db"


def migrate():
    """Add admin role column to users and create admin_messages table."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        print("[MIGRATION] Adding admin features...")

        # Add role column to users if it doesn't exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]

        if "role" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
            print("[MIGRATION] Added 'role' column to users table")
        else:
            print("[MIGRATION] 'role' column already exists in users table")

        # Create admin_messages table
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
        print("[MIGRATION] Created admin_messages table")

        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_messages_createdAt
            ON admin_messages(createdAt DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_messages_isRead
            ON admin_messages(isRead, createdAt DESC)
        """)
        print("[MIGRATION] Created indexes for admin_messages")

        conn.commit()
        print("[MIGRATION] Success! Admin features added.")

    except Exception as e:
        conn.rollback()
        print(f"[MIGRATION] Error: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
