import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "depeche.db")


def init_db():
    """Инициализация базы данных с таблицей articles"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def create_article(title: str, content: str) -> dict:
    """Создать новую статью в БД"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO articles (title, content, created_at) VALUES (?, ?, ?)",
        (title, content, datetime.now().isoformat())
    )

    conn.commit()
    article_id = cursor.lastrowid
    conn.close()

    return {
        "id": article_id,
        "title": title,
        "content": content
    }


def get_all_articles() -> list:
    """Получить все статьи для sidebar"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id, title FROM articles ORDER BY created_at DESC")
    articles = cursor.fetchall()
    conn.close()

    return [{"id": row[0], "title": row[1]} for row in articles]


def get_article(article_id: int) -> dict:
    """Получить конкретную статью"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id, title, content FROM articles WHERE id = ?", (article_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "title": row[1],
        "content": row[2]
    }


def delete_article(article_id: int) -> bool:
    """Удалить статью"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM articles WHERE id = ?", (article_id,))
    conn.commit()

    deleted = cursor.rowcount > 0
    conn.close()

    return deleted
