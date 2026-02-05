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

            # Добавить колонку status если её нет
            if 'status' not in columns:
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN status TEXT DEFAULT 'new'"
                ))

            # Добавить колонку delivered_at если её нет
            if 'delivered_at' not in columns:
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN delivered_at DATETIME DEFAULT NULL"
                ))

            # Добавить колонку is_read если её нет
            if 'is_read' not in columns:
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN is_read BOOLEAN DEFAULT 0"
                ))

            # Исправить NULL значения is_read на 0 (False)
            result = connection.execute(text(
                "UPDATE leads SET is_read = 0 WHERE is_read IS NULL"
            ))

            # Добавить колонку source_url если её нет
            if 'source_url' not in columns:
                connection.execute(text(
                    "ALTER TABLE leads ADD COLUMN source_url VARCHAR(255) DEFAULT NULL"
                ))

            # ==================== ТАБЛИЦА USERS ====================

            # Получить информацию о колонках таблицы users
            result = connection.execute(text("PRAGMA table_info(users)"))
            columns_users = {row[1] for row in result}  # row[1] = column name

            # Добавить колонку disabled если её нет
            if 'disabled' not in columns_users:
                connection.execute(text(
                    "ALTER TABLE users ADD COLUMN disabled BOOLEAN DEFAULT 0"
                ))

            # Добавить колонку plan если её нет
            if 'plan' not in columns_users:
                connection.execute(text(
                    "ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT 'trial'"
                ))

            # Добавить колонку auth_token если её нет
            if 'auth_token' not in columns_users:
                connection.execute(text(
                    "ALTER TABLE users ADD COLUMN auth_token VARCHAR(128) DEFAULT NULL UNIQUE"
                ))

            # ==================== ТАБЛИЦА TELEGRAM_SESSIONS ====================

            # Получить информацию о колонках таблицы telegram_sessions
            result = connection.execute(text("PRAGMA table_info(telegram_sessions)"))
            columns_sessions = {row[1] for row in result}  # row[1] = column name

            # Добавить колонку telegram_username если её нет
            if 'telegram_username' not in columns_sessions:
                connection.execute(text(
                    "ALTER TABLE telegram_sessions ADD COLUMN telegram_username VARCHAR(255) DEFAULT NULL"
                ))

            # ==================== ТАБЛИЦА USER_SESSIONS ====================
            # Примечание: таблица создается через Base.metadata.create_all() в ensure_tables(),
            # но мы проверяем здесь чтобы убедиться что индексы созданы

            # Получить информацию о таблице user_sessions
            try:
                result = connection.execute(text("PRAGMA table_info(user_sessions)"))
                columns_user_sessions = {row[1] for row in result}
                print(f"   Колонки в таблице user_sessions: {columns_user_sessions}")

                # user_sessions должна быть создана автоматически через Base.metadata.create_all()
                # Здесь мы просто логируем что она существует
                if columns_user_sessions:
                    print("   ✓ Таблица user_sessions уже существует")
                else:
                    print("   ⚠️  Таблица user_sessions пуста или не найдена - будет создана в ensure_tables()")
            except Exception as e:
                print(f"   ℹ️ Таблица user_sessions еще не создана (это нормально, создается в ensure_tables()): {e}")

            connection.commit()

        except Exception as e:
            connection.rollback()
            # Не прерываем выполнение - это может быть ошибка "column already exists"
        finally:
            connection.close()

    except Exception as e:
        # Продолжаем - это может быть временная ошибка
        pass


def ensure_tables():
    """Гарантировать наличие всех таблиц в БД (идемпотентно для SQLite)"""
    try:
        # Создать все таблицы из моделей (checkfirst=True не создает дубликаты)
        Base.metadata.create_all(bind=engine)

        # Проверить какие таблицы есть в БД
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

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

            # Индексы для UserSession (новая таблица для поддержки нескольких сессий)
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_user_session_user_id ON user_sessions (user_id)"
            ))
            print("✅ Индекс idx_user_session_user_id OK")

            connection.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_session_auth_token ON user_sessions (auth_token)"
            ))
            print("✅ Уникальный индекс idx_user_session_auth_token OK")

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
