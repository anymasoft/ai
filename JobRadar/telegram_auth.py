"""
JobRadar - Вспомогательные функции для работы с Telegram
"""
from telethon import TelegramClient
from telethon.sessions import StringSession
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH
from database import SessionLocal
from models import TelegramSession


async def get_telegram_client(phone: str):
    """
    Восстановить TelegramClient из сохранённой сессии.

    Args:
        phone: Номер телефона (нормализованный)

    Returns:
        TelegramClient или None если сессия не найдена
    """
    db = SessionLocal()
    session = db.query(TelegramSession).filter(TelegramSession.phone == phone).first()
    db.close()

    if not session:
        print(f"❌ Сессия для {phone} не найдена в БД")
        return None

    try:
        # Восстановить клиента из сохранённой сессии
        session_string = session.session_string
        print(f"✅ Сессия для {phone} загружена из БД (длина: {len(session_string)})")

        client = TelegramClient(StringSession(session_string), TELEGRAM_API_ID, TELEGRAM_API_HASH)
        await client.connect()
        return client
    except Exception as e:
        print(f"❌ Ошибка восстановления сессии: {e}")
        return None


async def save_session_to_db(phone: str, session_string: str):
    """
    Сохранить session строку в SQLite БД.

    Args:
        phone: Номер телефона
        session_string: Строка сессии из StringSession.save()
    """
    db = SessionLocal()

    try:
        # Проверить, есть ли уже сессия для этого номера
        existing = db.query(TelegramSession).filter(TelegramSession.phone == phone).first()
        if existing:
            print(f"🔄 Обновляю существующую сессию для {phone}")
            existing.session_string = session_string
        else:
            print(f"✨ Создаю новую сессию для {phone}")
            new_session = TelegramSession(
                phone=phone,
                session_string=session_string
            )
            db.add(new_session)

        db.commit()
        print(f"✅ Сессия сохранена в БД для {phone}")
        return True
    except Exception as e:
        print(f"❌ Ошибка сохранения сессии в БД: {e}")
        return False
    finally:
        db.close()
