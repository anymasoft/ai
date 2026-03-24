#!/usr/bin/env python3
"""
Применение миграции 003: схема авторизации (auth.users + auth.api_keys).

Создаёт отдельную PostgreSQL-схему `auth`, изолированную от бизнес-данных.
Безопасно запускать повторно — все операции идемпотентны (IF NOT EXISTS).

Использование:
    cd dbgis-backend
    python migrations/apply_003.py

Или через универсальный раннер:
    python migrations/run_migration.py 003_auth_schema.sql
"""

import sys
from pathlib import Path

# Добавляем папку migrations в путь для импорта run_migration
sys.path.insert(0, str(Path(__file__).parent))

from run_migration import run_migration

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  Миграция 003: Схема авторизации (Yandex OAuth + API keys)")
    print("=" * 60)
    print()
    print("  Создаёт:")
    print("    - CREATE SCHEMA auth")
    print("    - CREATE TABLE auth.users")
    print("    - CREATE TABLE auth.api_keys")
    print("    - Индексы для key_hash, user_id, external_id")
    print()
    print("  Изоляция:")
    print("    - Все таблицы в схеме `auth` (НЕ в public)")
    print("    - clean_postgres.py и sync_sqlite_to_postgres.py НЕ затрагивают auth")
    print("    - Нет FK между auth.* и public.*")
    print()

    success = run_migration('003_auth_schema.sql')

    if success:
        print("\n" + "=" * 60)
        print("  Миграция 003 успешно применена!")
        print("=" * 60)
        print()
        print("  Следующие шаги:")
        print("    1. Добавьте в .env (опционально):")
        print("       YANDEX_CLIENT_ID=ваш_id")
        print("       YANDEX_CLIENT_SECRET=ваш_секрет")
        print()
        print("    2. Перезапустите сервер:")
        print("       python main.py")
        print()
        print("  Проверка:")
        print('    psql -d dbgis -c "SELECT table_name FROM information_schema.tables WHERE table_schema = \'auth\'"')
        print()
    else:
        print("\n  Ошибка при применении миграции 003")
        sys.exit(1)
