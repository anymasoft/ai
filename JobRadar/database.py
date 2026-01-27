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


def ensure_tables():
    """Гарантировать наличие всех таблиц в БД"""
    try:
        # Создать все таблицы из моделей
        Base.metadata.create_all(bind=engine)

        # Проверить какие таблицы есть в БД
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        db_path = get_db_path()
        print(f"\n📍 Путь к БД: {db_path}")
        print(f"📊 Таблицы в БД: {existing_tables}")

        # Проверить наличие критической таблицы
        if 'telegram_sessions' not in existing_tables:
            print(f"⚠️ Таблица 'telegram_sessions' не найдена, создаю...")
            from models import TelegramSession
            TelegramSession.__table__.create(bind=engine, checkfirst=True)
            print(f"✅ Таблица 'telegram_sessions' создана")
        else:
            print(f"✅ Таблица 'telegram_sessions' существует")

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

    print("✅ База данных инициализирована")
    print("="*60 + "\n")


def get_db() -> Session:
    """Получить сессию БД"""
    return SessionLocal()
