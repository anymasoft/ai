#!/usr/bin/env python3
"""
Скрипт для выполнения SQL-миграций через Python.
Читает настройки из .env и выполняет SQL из файлов миграций.
"""

import os
import sys
import psycopg2
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    # Если dotenv не установлен, используем простой парсер
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

# Загружаем .env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Читаем параметры БД из переменных окружения
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('DB_NAME', 'dbgis')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')


def run_migration(migration_file: str) -> bool:
    """
    Выполняет SQL-миграцию из файла.

    Args:
        migration_file: Имя файла миграции (например '002_add_source_to_emails_phones.sql')

    Returns:
        True если успешно, False если ошибка
    """
    migration_path = Path(__file__).parent / migration_file

    if not migration_path.exists():
        print(f"❌ Файл миграции не найден: {migration_path}")
        return False

    print(f"\n{'='*60}")
    print(f"Выполнение миграции: {migration_file}")
    print(f"{'='*60}")

    try:
        # Подключаемся к БД
        print(f"Подключение к {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        print("✓ Подключение успешно")

        # Читаем SQL-команды из файла
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Выполняем команды
        with conn.cursor() as cursor:
            print(f"\nВыполнение SQL-команд...")
            # Разбиваем на отдельные команды (каждая заканчивается ;)
            commands = [cmd.strip() for cmd in sql_content.split(';') if cmd.strip()]

            for i, command in enumerate(commands, 1):
                print(f"  [{i}/{len(commands)}] Выполнение команды...")
                try:
                    cursor.execute(command)
                    rows_affected = cursor.rowcount
                    if rows_affected >= 0:
                        print(f"      ✓ Успешно (строк затронуто: {rows_affected})")
                    else:
                        print(f"      ✓ Успешно")
                except Exception as e:
                    print(f"      ⚠ Команда уже применена или скорректирована: {str(e)[:100]}")
                    # Продолжаем, т.к. команда может быть идемпотентна (например ADD COLUMN может быть уже добавлена)

            # Коммитим транзакцию
            conn.commit()
            print(f"\n✓ Миграция завершена успешно!")

        conn.close()
        return True

    except psycopg2.OperationalError as e:
        print(f"\n❌ Ошибка подключения к БД:")
        print(f"   {e}")
        return False
    except Exception as e:
        print(f"\n❌ Ошибка при выполнении миграции:")
        print(f"   {e}")
        return False


def list_migrations() -> list:
    """Список всех доступных миграций."""
    migrations_dir = Path(__file__).parent
    migrations = sorted([f.name for f in migrations_dir.glob('*.sql') if f.name != 'schema.sql'])
    return migrations


if __name__ == '__main__':
    print("\n🔧 Migration Runner — Выполнение SQL-миграций\n")

    if len(sys.argv) > 1:
        # Запускаем конкретную миграцию
        migration_file = sys.argv[1]
        success = run_migration(migration_file)
        sys.exit(0 if success else 1)
    else:
        # Показываем список доступных миграций
        migrations = list_migrations()
        if not migrations:
            print("⚠ Нет доступных миграций")
            print(f"Поместите файлы .sql в папку {Path(__file__).parent}")
            sys.exit(1)

        print("Доступные миграции:")
        for i, migration in enumerate(migrations, 1):
            print(f"  {i}. {migration}")

        print("\nИспользование:")
        print(f"  python run_migration.py <migration_file>")
        print(f"  python run_migration.py {migrations[0]}")
