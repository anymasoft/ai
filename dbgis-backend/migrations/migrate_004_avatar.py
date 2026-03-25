#!/usr/bin/env python3
"""
Миграция 004: Добавление avatar_url в auth.users.

Запуск:
    python migrations/migrate_004_avatar.py
"""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(path=None):
        env_file = Path(path) if path else Path('.env')
        if env_file.exists():
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()

import psycopg2

# Загружаем .env из папки dbgis-backend
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('DB_NAME', 'dbgis')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')


def main():
    print("Миграция 004: Добавление avatar_url в auth.users")
    print(f"Подключение к {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}...")

    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT,
            database=DB_NAME, user=DB_USER, password=DB_PASSWORD,
        )
        print("Подключение успешно")

        with conn.cursor() as cur:
            cur.execute(
                "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS avatar_url TEXT"
            )
            conn.commit()
            print("Готово: колонка avatar_url добавлена в auth.users")

        conn.close()

    except Exception as e:
        print(f"Ошибка: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
