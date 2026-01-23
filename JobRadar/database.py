"""
JobRadar v0 - Инициализация и работа с БД
"""
from sqlalchemy import create_engine
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


def init_db():
    """Инициализация таблиц в БД"""
    Base.metadata.create_all(bind=engine)
    print("✅ База данных инициализирована")


def get_db() -> Session:
    """Получить сессию БД"""
    return SessionLocal()
