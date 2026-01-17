"""
Скрипт миграции данных из db.sqlite3 в sqlite.db
БЕЗОПАСНО: не удаляет старую БД, только копирует данные
"""

import sqlite3
import os

OLD_DB = os.path.join(os.path.dirname(__file__), "db.sqlite3")
NEW_DB = os.path.join(os.path.dirname(__file__), "sqlite.db")

print(f"[MIGRATION] Миграция данных")
print(f"[MIGRATION] Из: {OLD_DB}")
print(f"[MIGRATION] В:  {NEW_DB}")

# Проверяем что старая БД существует
if not os.path.exists(OLD_DB):
    print(f"[MIGRATION] ❌ Старая БД не найдена: {OLD_DB}")
    exit(1)

# Инициализируем новую БД
print(f"[MIGRATION] Инициализация новой БД...")
from db import init_db
init_db()
print(f"[MIGRATION] ✅ Новая БД инициализирована")

# Подключаемся к обеим БД
old_conn = sqlite3.connect(OLD_DB)
old_conn.row_factory = sqlite3.Row
new_conn = sqlite3.connect(NEW_DB)

old_c = old_conn.cursor()
new_c = new_conn.cursor()

# Статистика
stats = {
    "users": 0,
    "payments": 0,
    "generations": 0,
    "queue": 0
}

try:
    # ============ МИГРАЦИЯ USERS ============
    print(f"\n[MIGRATION] Миграция users...")
    old_c.execute("SELECT * FROM users")
    users = old_c.fetchall()

    for user in users:
        user_dict = dict(user)

        # Проверяем есть ли уже такой пользователь
        new_c.execute("SELECT id FROM users WHERE telegram_id = ?", (user_dict['telegram_id'],))
        existing = new_c.fetchone()

        if existing:
            # Обновляем существующего
            new_c.execute("""
                UPDATE users SET
                    video_balance = ?,
                    free_remaining = ?,
                    free_used = ?,
                    username = ?,
                    full_name = ?,
                    created_at = ?
                WHERE telegram_id = ?
            """, (
                user_dict.get('video_balance', 0),
                user_dict.get('free_remaining', 0),
                user_dict.get('free_used', 0),
                user_dict.get('username'),
                user_dict.get('full_name'),
                user_dict.get('created_at'),
                user_dict['telegram_id']
            ))
        else:
            # Вставляем нового
            new_c.execute("""
                INSERT INTO users (telegram_id, video_balance, free_remaining, free_used, username, full_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                user_dict['telegram_id'],
                user_dict.get('video_balance', 0),
                user_dict.get('free_remaining', 0),
                user_dict.get('free_used', 0),
                user_dict.get('username'),
                user_dict.get('full_name'),
                user_dict.get('created_at')
            ))

        stats['users'] += 1

    print(f"[MIGRATION] ✅ Users перенесено: {stats['users']}")

    # ============ МИГРАЦИЯ PAYMENTS ============
    print(f"\n[MIGRATION] Миграция payments...")
    old_c.execute("SELECT * FROM payments")
    payments = old_c.fetchall()

    for payment in payments:
        payment_dict = dict(payment)

        # Проверяем есть ли уже такой платёж
        new_c.execute("SELECT id FROM payments WHERE payment_id = ?", (payment_dict['payment_id'],))
        existing = new_c.fetchone()

        if existing:
            # Обновляем существующий
            new_c.execute("""
                UPDATE payments SET
                    telegram_id = ?,
                    pack_id = ?,
                    videos_count = ?,
                    amount = ?,
                    status = ?,
                    poll_attempts = ?,
                    last_poll_at = ?,
                    last_status = ?,
                    created_at = ?
                WHERE payment_id = ?
            """, (
                payment_dict['telegram_id'],
                payment_dict['pack_id'],
                payment_dict['videos_count'],
                payment_dict['amount'],
                payment_dict['status'],
                payment_dict.get('poll_attempts', 0),
                payment_dict.get('last_poll_at'),
                payment_dict.get('last_status'),
                payment_dict.get('created_at'),
                payment_dict['payment_id']
            ))
        else:
            # Вставляем новый
            new_c.execute("""
                INSERT INTO payments (payment_id, telegram_id, pack_id, videos_count, amount, status, poll_attempts, last_poll_at, last_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                payment_dict['payment_id'],
                payment_dict['telegram_id'],
                payment_dict['pack_id'],
                payment_dict['videos_count'],
                payment_dict['amount'],
                payment_dict['status'],
                payment_dict.get('poll_attempts', 0),
                payment_dict.get('last_poll_at'),
                payment_dict.get('last_status'),
                payment_dict.get('created_at')
            ))

        stats['payments'] += 1

    print(f"[MIGRATION] ✅ Payments перенесено: {stats['payments']}")

    # ============ МИГРАЦИЯ GENERATIONS ============
    print(f"\n[MIGRATION] Миграция generations...")
    old_c.execute("SELECT * FROM generations")
    generations = old_c.fetchall()

    for gen in generations:
        gen_dict = dict(gen)

        # Проверяем есть ли уже такая генерация
        new_c.execute("SELECT id FROM generations WHERE id = ?", (gen_dict['id'],))
        existing = new_c.fetchone()

        if not existing:
            # Вставляем новую
            new_c.execute("""
                INSERT INTO generations (id, telegram_id, image_path, prompt, status, video_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                gen_dict['id'],
                gen_dict['telegram_id'],
                gen_dict['image_path'],
                gen_dict['prompt'],
                gen_dict['status'],
                gen_dict.get('video_path'),
                gen_dict.get('created_at')
            ))
            stats['generations'] += 1

    print(f"[MIGRATION] ✅ Generations перенесено: {stats['generations']}")

    # ============ МИГРАЦИЯ QUEUE ============
    print(f"\n[MIGRATION] Миграция queue...")
    old_c.execute("SELECT * FROM queue")
    queue_items = old_c.fetchall()

    for item in queue_items:
        item_dict = dict(item)

        # Проверяем есть ли уже
        new_c.execute("SELECT id FROM queue WHERE generation_id = ?", (item_dict['generation_id'],))
        existing = new_c.fetchone()

        if not existing:
            new_c.execute("""
                INSERT INTO queue (generation_id, status, created_at)
                VALUES (?, ?, ?)
            """, (
                item_dict['generation_id'],
                item_dict['status'],
                item_dict.get('created_at')
            ))
            stats['queue'] += 1

    print(f"[MIGRATION] ✅ Queue перенесено: {stats['queue']}")

    # Коммитим все изменения
    new_conn.commit()

    print(f"\n[MIGRATION] ============================================")
    print(f"[MIGRATION] ✅ МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО")
    print(f"[MIGRATION] ============================================")
    print(f"[MIGRATION] Перенесено:")
    print(f"[MIGRATION]   👤 Users:       {stats['users']}")
    print(f"[MIGRATION]   💳 Payments:    {stats['payments']}")
    print(f"[MIGRATION]   🎬 Generations: {stats['generations']}")
    print(f"[MIGRATION]   📋 Queue:       {stats['queue']}")
    print(f"[MIGRATION] ============================================")
    print(f"[MIGRATION] Старая БД сохранена: {OLD_DB}")
    print(f"[MIGRATION] Новая БД готова:     {NEW_DB}")

except Exception as e:
    print(f"\n[MIGRATION] ❌ ОШИБКА: {e}")
    import traceback
    traceback.print_exc()
    new_conn.rollback()
    exit(1)

finally:
    old_conn.close()
    new_conn.close()
