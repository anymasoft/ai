"""
JobRadar - Вспомогательные функции для работы с Telegram
"""
import logging
from datetime import datetime, timedelta
from telethon import TelegramClient
from telethon.sessions import StringSession
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH
from database import SessionLocal
from models import TelegramSession, User

logger = logging.getLogger(__name__)


async def save_session_to_db(phone: str, session_string: str, telegram_user_id: int = None, telegram_username: str = None):
    """
    Сохранить session строку в SQLite БД.

    Args:
        phone: Номер телефона (нормализованный)
        session_string: Строка сессии из StringSession.save()
        telegram_user_id: Telegram ID пользователя (опционально)
        telegram_username: Telegram @username пользователя без @ (опционально)

    Returns:
        int: user_id при успехе, или None при ошибке
    """
    try:
        # Страховка: убедиться, что таблица существует
        from database import ensure_tables
        ensure_tables()

        db = SessionLocal()

        try:
            # Получить или создать User по phone
            user = db.query(User).filter(User.phone == phone).first()
            if not user:
                logger.info(f"✨ Создаю нового пользователя: {phone} с Trial на 3 дня")
                # Новый пользователь получает Trial автоматически
                user = User(
                    phone=phone,
                    plan="trial",
                    trial_given=True,
                    trial_expires_at=datetime.utcnow() + timedelta(days=3)
                )
                db.add(user)
                db.flush()  # Чтобы получить user.id
                logger.info(f"[TRIAL_GIVEN] user_id={user.id} trial_expires_at={user.trial_expires_at}")

            user_id = user.id

            # Проверить, есть ли уже сессия для этого номера
            existing = db.query(TelegramSession).filter(TelegramSession.phone == phone).first()
            if existing:
                logger.info(f"🔄 Обновляю сессию: phone={phone}")
                existing.user_id = user_id
                existing.session_string = session_string
                if telegram_user_id:
                    existing.telegram_user_id = telegram_user_id
                if telegram_username:
                    existing.telegram_username = telegram_username
            else:
                logger.info(f"✨ Сохраняю новую сессию: phone={phone}")
                new_session = TelegramSession(
                    user_id=user_id,
                    phone=phone,
                    session_string=session_string,
                    telegram_user_id=telegram_user_id,
                    telegram_username=telegram_username
                )
                db.add(new_session)

            db.commit()
            logger.info(f"✅ Сессия сохранена | phone={phone} | user_id={user_id} | telegram_id={telegram_user_id}")
            return user_id
        except Exception as db_error:
            db.rollback()
            logger.error(f"❌ Ошибка при сохранении сессии: {type(db_error).__name__}: {db_error}")
            return None
        finally:
            db.close()

    except Exception as e:
        logger.error(f"❌ Критическая ошибка сохранения сессии: {type(e).__name__}: {e}")
        return None
