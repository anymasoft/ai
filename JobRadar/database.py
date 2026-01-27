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

    # Проверить, есть ли уже задачи
    from models import Task
    db = SessionLocal()
    if db.query(Task).count() == 0:
        # Добавить тестовые данные
        demo_tasks = [
            Task(
                name="Python Remote Jobs",
                status="running",
                sources="telegram.me/dev_jobs, telegram.me/python_jobs",
                include_keywords="python, remote, developer",
                exclude_keywords="junior, internship",
                alerts_telegram=True,
                alerts_email=False,
                alerts_webhook=False
            ),
            Task(
                name="Freelance Gigs",
                status="running",
                sources="telegram.me/freelance",
                include_keywords="freelance, contract",
                exclude_keywords="",
                alerts_telegram=True,
                alerts_email=True,
                alerts_webhook=False
            ),
        ]
        db.add_all(demo_tasks)
        db.commit()
        print("✅ Добавлены демо-задачи для примера")
    db.close()


def get_db() -> Session:
    """Получить сессию БД"""
    return SessionLocal()
