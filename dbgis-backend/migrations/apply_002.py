#!/usr/bin/env python3
"""
Быстрый скрипт для применения миграции 002.
Добавляет колонку 'source' в таблицы emails и phones.

Использование:
    python apply_002.py
"""

import sys
from pathlib import Path

# Добавляем родительскую папку в путь
sys.path.insert(0, str(Path(__file__).parent))

from run_migration import run_migration

if __name__ == '__main__':
    print("\n🔄 Применение миграции: 002_add_source_to_emails_phones.sql\n")
    success = run_migration('002_add_source_to_emails_phones.sql')

    if success:
        print("\n✅ Миграция 002 успешно применена!")
        print("\nТеперь можно запустить основное приложение:")
        print("  python main.py")
    else:
        print("\n❌ Ошибка при применении миграции 002")
        sys.exit(1)
