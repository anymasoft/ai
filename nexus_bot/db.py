"""
SQLite БД для persistence
Архитектура идентична сайту: users / payments / generations / queue
"""

import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db.sqlite3")


def get_db():
    """Получить соединение с БД"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Возвращает строки как словари
    return conn


def init_db():
    """Инициализировать БД со схемой"""
    conn = get_db()
    c = conn.cursor()

    # users
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            telegram_id INTEGER UNIQUE NOT NULL,
            video_balance INTEGER NOT NULL DEFAULT 0,
            free_remaining INTEGER NOT NULL DEFAULT 3,
            free_used INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # payments
    c.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY,
            payment_id TEXT UNIQUE NOT NULL,
            telegram_id INTEGER NOT NULL,
            pack_id TEXT NOT NULL,
            videos_count INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
        )
    """)

    # Миграция: добавить поля для anti-spam polling (если их нет)
    try:
        c.execute("ALTER TABLE payments ADD COLUMN poll_attempts INTEGER NOT NULL DEFAULT 0")
    except:
        pass  # Колонка уже существует

    try:
        c.execute("ALTER TABLE payments ADD COLUMN last_poll_at DATETIME")
    except:
        pass

    try:
        c.execute("ALTER TABLE payments ADD COLUMN last_status TEXT")
    except:
        pass

    # generations
    c.execute("""
        CREATE TABLE IF NOT EXISTS generations (
            id INTEGER PRIMARY KEY,
            telegram_id INTEGER NOT NULL,
            image_path TEXT NOT NULL,
            prompt TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            video_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
        )
    """)

    # queue
    c.execute("""
        CREATE TABLE IF NOT EXISTS queue (
            id INTEGER PRIMARY KEY,
            generation_id INTEGER UNIQUE NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (generation_id) REFERENCES generations(id)
        )
    """)

    conn.commit()
    conn.close()


# ============ USERS ============

def get_or_create_user(telegram_id: int) -> Dict[str, Any]:
    """Получить или создать пользователя"""
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    row = c.fetchone()

    if row:
        conn.close()
        return dict(row)

    # Создать нового
    c.execute(
        "INSERT INTO users (telegram_id) VALUES (?)",
        (telegram_id,)
    )
    conn.commit()

    c.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = dict(c.fetchone())
    conn.close()
    return user


def get_user(telegram_id: int) -> Optional[Dict[str, Any]]:
    """Получить пользователя"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def get_total_videos(telegram_id: int) -> int:
    """Получить общее количество видео (свободных + оплаченных)"""
    user = get_user(telegram_id)
    if not user:
        return 0
    return user["free_remaining"] + user["video_balance"]


def deduct_video(telegram_id: int) -> bool:
    """
    Вычесть одно видео.
    Сначала вычитаем из свободных, потом из оплаченных.
    Возвращает True если успешно, False если нет видео.
    """
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute("BEGIN IMMEDIATE")  # Транзакция

        user = get_user(telegram_id)
        if not user:
            conn.close()
            return False

        # Вычитаем из свободных первыми
        if user["free_remaining"] > 0:
            c.execute(
                "UPDATE users SET free_remaining = free_remaining - 1, free_used = free_used + 1 WHERE telegram_id = ?",
                (telegram_id,)
            )
        # Потом из оплаченных
        elif user["video_balance"] > 0:
            c.execute(
                "UPDATE users SET video_balance = video_balance - 1 WHERE telegram_id = ?",
                (telegram_id,)
            )
        else:
            conn.close()
            return False

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[DB] Error deducting video: {e}")
        return False


def add_video_pack(telegram_id: int, pack_id: str, videos_count: int) -> bool:
    """Добавить видео от пакета"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute("BEGIN IMMEDIATE")

        # Проверим что пакет существует
        if pack_id not in ["starter", "seller", "pro"]:
            conn.close()
            return False

        c.execute(
            "UPDATE users SET video_balance = video_balance + ? WHERE telegram_id = ?",
            (videos_count, telegram_id)
        )

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[DB] Error adding video pack: {e}")
        return False


def refund_video(telegram_id: int) -> bool:
    """
    Вернуть 1 видео при ошибке генерации.
    Возвращает в video_balance (платный баланс).
    """
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute("BEGIN IMMEDIATE")

        c.execute(
            "UPDATE users SET video_balance = video_balance + 1 WHERE telegram_id = ?",
            (telegram_id,)
        )

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[DB] Error refunding video: {e}")
        return False


# ============ PAYMENTS ============

def create_payment(
    payment_id: str,
    telegram_id: int,
    pack_id: str,
    videos_count: int,
    amount: int
) -> bool:
    """Создать запись платежа (status=pending)"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute(
            """INSERT INTO payments
               (payment_id, telegram_id, pack_id, videos_count, amount, status)
               VALUES (?, ?, ?, ?, ?, 'pending')""",
            (payment_id, telegram_id, pack_id, videos_count, amount)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        conn.close()
        print(f"[DB] Error creating payment: {e}")
        return False


def get_payment(payment_id: str) -> Optional[Dict[str, Any]]:
    """Получить платёж"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM payments WHERE payment_id = ?", (payment_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def get_pending_payments() -> List[Dict[str, Any]]:
    """Получить ВСЕ платежи со статусом pending (для polling независимо от state в памяти)"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM payments WHERE status = 'pending' ORDER BY created_at ASC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def confirm_payment(payment_id: str) -> bool:
    """Подтвердить платёж (status=succeeded) и зачислить видео"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute("BEGIN IMMEDIATE")

        # Проверяем что платёж в pending
        payment = get_payment(payment_id)
        if not payment or payment["status"] == "succeeded":
            conn.close()
            return False

        telegram_id = payment["telegram_id"]
        videos_count = payment["videos_count"]

        # Обновляем статус платежа
        c.execute(
            "UPDATE payments SET status = 'succeeded' WHERE payment_id = ?",
            (payment_id,)
        )

        # Зачисляем видео пользователю
        c.execute(
            "UPDATE users SET video_balance = video_balance + ? WHERE telegram_id = ?",
            (videos_count, telegram_id)
        )

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[DB] Error confirming payment: {e}")
        return False


def update_payment_status(payment_id: str, new_status: str) -> bool:
    """Обновить статус платежа (для failed/canceled/expired платежей)"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute(
            "UPDATE payments SET status = ? WHERE payment_id = ?",
            (new_status, payment_id)
        )
        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.close()
        print(f"[DB] Error updating payment status: {e}")
        return False


def update_payment_poll_info(payment_id: str, attempts: int, last_status: str) -> bool:
    """Обновить информацию о polling (для anti-spam)"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute(
            "UPDATE payments SET poll_attempts = ?, last_poll_at = CURRENT_TIMESTAMP, last_status = ? WHERE payment_id = ?",
            (attempts, last_status, payment_id)
        )
        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.close()
        print(f"[DB] Error updating payment poll info: {e}")
        return False


# ============ GENERATIONS ============

def create_generation(
    telegram_id: int,
    image_path: str,
    prompt: str
) -> int:
    """Создать запись о генерации, вернуть generation_id"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute(
            """INSERT INTO generations
               (telegram_id, image_path, prompt, status)
               VALUES (?, ?, ?, 'queued')""",
            (telegram_id, image_path, prompt)
        )
        generation_id = c.lastrowid
        conn.commit()
        conn.close()
        return generation_id

    except Exception as e:
        conn.close()
        print(f"[DB] Error creating generation: {e}")
        return 0


def get_generation(generation_id: int) -> Optional[Dict[str, Any]]:
    """Получить генерацию"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM generations WHERE id = ?", (generation_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def update_generation_status(generation_id: int, status: str, video_path: str = None) -> bool:
    """Обновить статус генерации"""
    conn = get_db()
    c = conn.cursor()

    try:
        if video_path:
            c.execute(
                "UPDATE generations SET status = ?, video_path = ? WHERE id = ?",
                (status, video_path, generation_id)
            )
        else:
            c.execute(
                "UPDATE generations SET status = ? WHERE id = ?",
                (status, generation_id)
            )
        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.close()
        print(f"[DB] Error updating generation: {e}")
        return False


# ============ QUEUE ============

def enqueue_generation(generation_id: int) -> bool:
    """Добавить генерацию в очередь"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute(
            "INSERT INTO queue (generation_id, status) VALUES (?, 'queued')",
            (generation_id,)
        )
        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.close()
        print(f"[DB] Error enqueuing generation: {e}")
        return False


def get_next_queued_generation() -> Optional[Dict[str, Any]]:
    """Получить следующую генерацию из очереди (статус=queued)"""
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        SELECT g.* FROM generations g
        JOIN queue q ON g.id = q.generation_id
        WHERE q.status = 'queued'
        ORDER BY g.id ASC
        LIMIT 1
    """)

    row = c.fetchone()
    conn.close()
    return dict(row) if row else None


def mark_generation_processing(generation_id: int) -> bool:
    """Пометить генерацию как processing"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute(
            "UPDATE queue SET status = 'processing' WHERE generation_id = ?",
            (generation_id,)
        )
        c.execute(
            "UPDATE generations SET status = 'processing' WHERE id = ?",
            (generation_id,)
        )
        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.close()
        print(f"[DB] Error marking generation processing: {e}")
        return False


def complete_generation(generation_id: int, video_path: str) -> bool:
    """Завершить генерацию (done + удалить из очереди)"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute("BEGIN IMMEDIATE")

        c.execute(
            "UPDATE generations SET status = 'done', video_path = ? WHERE id = ?",
            (video_path, generation_id)
        )
        c.execute(
            "DELETE FROM queue WHERE generation_id = ?",
            (generation_id,)
        )

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[DB] Error completing generation: {e}")
        return False


def fail_generation(generation_id: int) -> bool:
    """Пометить генерацию как failed и удалить из очереди"""
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute("BEGIN IMMEDIATE")

        c.execute(
            "UPDATE generations SET status = 'failed' WHERE id = ?",
            (generation_id,)
        )
        c.execute(
            "DELETE FROM queue WHERE generation_id = ?",
            (generation_id,)
        )

        conn.commit()
        conn.close()
        return True

    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[DB] Error failing generation: {e}")
        return False
