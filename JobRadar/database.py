"""
JobRadar v0 - Инициализация и работа с БД
"""
import os
from sqlalchemy import create_engine, inspect, text, event
from sqlalchemy.orm import sessionmaker, Session
from config import DATABASE_URL
from models import Base

# Создание движка
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Для SQLite async
)

# Включить PRAGMA foreign_keys для SQLite (для каскадного удаления)
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Включить PRAGMA foreign_keys при подключении к SQLite"""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

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

            # Исправить NULL значения is_read на 0 (False)
            result = connection.execute(text(
                "UPDATE leads SET is_read = 0 WHERE is_read IS NULL"
            ))
            if result.rowcount > 0:
                print(f"   🔧 Исправлено {result.rowcount} лидов с NULL is_read")

            # Добавить колонку source_url если её нет
            if 'source_url' not in columns:
                print("   ➕ Добавляю колонку source_url...")
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN source_url VARCHAR(255) DEFAULT NULL"
                ))
                print("   ✅ Колонка source_url добавлена")
            else:
                print("   ✓ Колонка source_url уже существует")

            # ==================== ТАБЛИЦА USERS ====================

            # Получить информацию о колонках таблицы users
            result = connection.execute(text("PRAGMA table_info(users)"))
            columns_users = {row[1] for row in result}  # row[1] = column name

            print(f"   Колонки в таблице users: {columns_users}")

            # Добавить колонку disabled если её нет
            if 'disabled' not in columns_users:
                print("   ➕ Добавляю колонку disabled...")
                connection.execute(text(
                    "ALTER TABLE users ADD COLUMN disabled BOOLEAN DEFAULT 0"
                ))
                print("   ✅ Колонка disabled добавлена")
            else:
                print("   ✓ Колонка disabled уже существует")

            # Добавить колонку plan если её нет
            if 'plan' not in columns_users:
                print("   ➕ Добавляю колонку plan...")
                connection.execute(text(
                    "ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT 'trial'"
                ))
                print("   ✅ Колонка plan добавлена")
            else:
                print("   ✓ Колонка plan уже существует")

            # Добавить колонку auth_token если её нет
            if 'auth_token' not in columns_users:
                print("   ➕ Добавляю колонку auth_token...")
                connection.execute(text(
                    "ALTER TABLE users ADD COLUMN auth_token VARCHAR(128) DEFAULT NULL UNIQUE"
                ))
                print("   ✅ Колонка auth_token добавлена")
            else:
                print("   ✓ Колонка auth_token уже существует")

            # ==================== ТАБЛИЦА TELEGRAM_SESSIONS ====================

            # Получить информацию о колонках таблицы telegram_sessions
            result = connection.execute(text("PRAGMA table_info(telegram_sessions)"))
            columns_sessions = {row[1] for row in result}  # row[1] = column name

            print(f"   Колонки в таблице telegram_sessions: {columns_sessions}")

            # Добавить колонку telegram_username если её нет
            if 'telegram_username' not in columns_sessions:
                print("   ➕ Добавляю колонку telegram_username...")
                connection.execute(text(
                    "ALTER TABLE telegram_sessions ADD COLUMN telegram_username VARCHAR(255) DEFAULT NULL"
                ))
                print("   ✅ Колонка telegram_username добавлена")
            else:
                print("   ✓ Колонка telegram_username уже существует")

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

            # Индекс для TelegramSession.user_id
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_telegram_session_user_id ON telegram_sessions (user_id)"
            ))

            # UNIQUE индекс для TelegramSession.user_id (один User = одна сессия)
            connection.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS telegram_sessions_user_id_uq ON telegram_sessions (user_id)"
            ))

            # Индексы для Lead
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_lead_task_id ON leads (task_id)"
            ))

            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_lead_found_at ON leads (found_at)"
            ))

            # Индексы для TaskSourceState
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_task_source_state ON task_source_states (task_id, source)"
            ))

            # Индексы для SourceMessage
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_source_chat_message ON source_messages (source_chat_id, source_message_id)"
            ))

            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_published ON source_messages (published)"
            ))

            connection.commit()
        finally:
            connection.close()

        # Финальная проверка (молча)

    except Exception as e:
        print(f"❌ Ошибка при ensure_tables(): {e}")
        import traceback
        traceback.print_exc()
        raise


def init_db():
    """Инициализация таблиц в БД"""
    # Гарантировать наличие таблиц
    ensure_tables()

    # Выполнить мягкую миграцию схемы (добавить новые колонки если их нет)
    migrate_schema()


def get_db() -> Session:
    """Получить сессию БД"""
    return SessionLocal()
