"""Initialize app.db schema and migrations."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "app.db"


def init_db():
    """Initialize app database with correct schema."""

    # Ensure data directory exists
    DB_PATH.parent.mkdir(exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Create users table if not exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            plan_id TEXT DEFAULT 'free',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create admin_messages table if not exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_messages (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            firstName TEXT,
            lastName TEXT,
            subject TEXT,
            message TEXT NOT NULL,
            userId TEXT,
            createdAt INTEGER NOT NULL,
            isRead INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (userId) REFERENCES users(id)
        )
    """)

    # Check if users table needs migration
    cursor.execute("PRAGMA table_info(users)")
    columns = {col[1]: col for col in cursor.fetchall()}

    needs_migration = False

    # Check role column
    if "role" not in columns:
        print("[DB] Adding 'role' column to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        needs_migration = True

    # Check plan_id column
    if "plan_id" not in columns:
        print("[DB] Adding 'plan_id' column to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN plan_id TEXT DEFAULT 'free'")
        needs_migration = True

    if needs_migration:
        print("[DB] Schema migration completed")

    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_messages_user ON admin_messages(userId)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_messages_read ON admin_messages(isRead)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON admin_messages(createdAt)")

    conn.commit()
    conn.close()

    print(f"[DB] initialized successfully at {DB_PATH}")


if __name__ == "__main__":
    init_db()
