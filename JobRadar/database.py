"""
JobRadar v0 - Инициализация и работа с БД
"""
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from config import DATABASE_URL
from models import Base

# Создание движка
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Для SQLite async
)

# Создание фабрики сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_path() -> str:
    """Получить абсолютный путь к файлу БД"""
    # Извлечь путь из DATABASE_URL
    # Формат: sqlite:////absolute/path/to/db.db
    db_url = DATABASE_URL
    if db_url.startswith("sqlite:///"):
        path = db_url[10:]  # Убрать "sqlite:///"
        # На Windows пути могут быть вида C:/path, на Unix /path
        return path
    return "unknown"


def migrate_schema():
    """Мягкая миграция схемы БД - добавление новых колонок без потери данных"""
    try:
        connection = engine.connect()
        try:
            # ==================== ТАБЛИЦА LEADS ====================

            # Получить информацию о колонках таблицы leads
            result = connection.execute(text("PRAGMA table_info(leads)"))
            columns = {row[1] for row in result}  # row[1] = column name

            print("\n📋 Миграция схемы БД:")
            print(f"   Колонки в таблице leads: {columns}")

            # Добавить колонку status если её нет
            if 'status' not in columns:
                print("   ➕ Добавляю колонку status...")
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN status TEXT DEFAULT 'new'"
                ))
                print("   ✅ Колонка status добавлена")
            else:
                print("   ✓ Колонка status уже существует")

            # Добавить колонку delivered_at если её нет
            if 'delivered_at' not in columns:
                print("   ➕ Добавляю колонку delivered_at...")
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN delivered_at DATETIME DEFAULT NULL"
                ))
                print("   ✅ Колонка delivered_at добавлена")
            else:
                print("   ✓ Колонка delivered_at уже существует")

            # Добавить колонку is_read если её нет
            if 'is_read' not in columns:
                print("   ➕ Добавляю колонку is_read...")
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN is_read BOOLEAN DEFAULT 0"
                ))
                print("   ✅ Колонка is_read добавлена")
            else:
                print("   ✓ Колонка is_read уже существует")

            connection.commit()
            print("   ✅ Миграция схемы завершена\n")

        except Exception as e:
            connection.rollback()
            print(f"   ⚠️  Ошибка при миграции: {e}")
            # Не прерываем выполнение - это может быть ошибка "column already exists"
        finally:
            connection.close()

    except Exception as e:
        print(f"❌ Критическая ошибка при миграции схемы: {e}")
        import traceback
        traceback.print_exc()
        # Продолжаем - это может быть временная ошибка


def ensure_tables():
    """Гарантировать наличие всех таблиц в БД (идемпотентно для SQLite)"""
    try:
        # Создать все таблицы из моделей (checkfirst=True не создает дубликаты)
        Base.metadata.create_all(bind=engine)

        # Проверить какие таблицы есть в БД
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        db_path = get_db_path()
        print(f"\n📍 Путь к БД: {db_path}")
        print(f"📊 Таблицы в БД: {existing_tables}")

        # Безопасно создаём индексы через IF NOT EXISTS (SQLite-safe)
        # Это гарантирует, что индексы создаются только если их нет
        connection = engine.connect()
        try:
            # Индекс для Task.user_id
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_task_user_id ON tasks (user_id)"
            ))
            print("✅ Индекс idx_task_user_id OK")

            # Индекс для TelegramSession.user_id
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_telegram_session_user_id ON telegram_sessions (user_id)"
            ))
            print("✅ Индекс idx_telegram_session_user_id OK")

            # Индексы для Lead
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_lead_task_id ON leads (task_id)"
            ))
            print("✅ Индекс idx_lead_task_id OK")

            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_lead_found_at ON leads (found_at)"
            ))
            print("✅ Индекс idx_lead_found_at OK")

            # Индексы для TaskSourceState
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_task_source_state ON task_source_states (task_id, source)"
            ))
            print("✅ Индекс idx_task_source_state OK")

            # Индексы для SourceMessage
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_source_chat_message ON source_messages (source_chat_id, source_message_id)"
            ))
            print("✅ Индекс idx_source_chat_message OK")

            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_published ON source_messages (published)"
            ))
            print("✅ Индекс idx_published OK")

            connection.commit()
        finally:
            connection.close()

        # Финальная проверка
        inspector = inspect(engine)
        final_tables = inspector.get_table_names()
        print(f"📊 Финальный список таблиц: {final_tables}\n")

    except Exception as e:
        print(f"❌ Ошибка при ensure_tables(): {e}")
        import traceback
        traceback.print_exc()
        raise


def init_db():
    """Инициализация таблиц в БД"""
    print("\n" + "="*60)
    print("🚀 Инициализация базы данных...")
    print("="*60)

    # Гарантировать наличие таблиц
    ensure_tables()

    # Выполнить мягкую миграцию схемы (добавить новые колонки если их нет)
    migrate_schema()

    print("✅ База данных инициализирована")
    print("="*60 + "\n")


def get_db() -> Session:
    """Получить сессию БД"""
    return SessionLocal()
