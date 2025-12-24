"""Create admin user in database."""

import sqlite3
import uuid
import time
from db_config import DB_PATH
from db import get_db

admin_email = "admin@test.com"

conn = get_db()
cursor = conn.cursor()

# Check if admin exists
cursor.execute("SELECT id, role FROM users WHERE email = ?", (admin_email,))
row = cursor.fetchone()

if row:
    user_id, role = row
    if role == "admin":
        print(f"[OK] Admin user already exists: {admin_email}")
    else:
        # Update to admin
        cursor.execute("UPDATE users SET role = 'admin' WHERE email = ?", (admin_email,))
        conn.commit()
        print(f"[OK] Updated user to admin: {admin_email}")
else:
    # Create new admin user
    user_id = str(uuid.uuid4())
    created_at = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO users (id, email, role, plan_id, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, admin_email, "admin", "free", created_at)
    )
    conn.commit()
    print(f"[OK] Created admin user: {admin_email}")

conn.close()
