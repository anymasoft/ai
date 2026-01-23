import sqlite3
import os

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "../data/leadsensei.db")

def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cur = conn.cursor()
    # Создаём таблицы (см. выше)
    with open(os.path.join(os.path.dirname(__file__), "schema.sql"), "r") as f:
        cur.executescript(f.read())
    conn.commit()
    conn.close()

def get_user_by_email(email):
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email=?", (email,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(full_name, email, password_hash):
    conn = sqlite3.connect(DATABASE_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (full_name, email, password_hash)
        VALUES (?, ?, ?)
    """, (full_name, email, password_hash))
    conn.commit()
    conn.close()