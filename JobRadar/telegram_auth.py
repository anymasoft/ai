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


# async def save_session_to_db(phone: str, session_string: str):
#     """
#     Сохранить session строку в SQLite БД.
#
#     Args:
#         phone: Номер телефона
#         session_string: Строка сессии из StringSession.save()
#     """
#     try:
#         # Страховка: убедиться, что таблица существует
#         from database import ensure_tables
#         print(f"🔐 Проверяю наличие таблицы telegram_sessions...")
#         ensure_tables()
#
#         db = SessionLocal()
#         print(f"💾 Подключена БД для сохранения сессии")
#
#         try:
#             # Проверить, есть ли уже сессия для этого номера
#             existing = db.query(TelegramSession).filter(TelegramSession.phone == phone).first()
#             if existing:
#                 print(f"🔄 Обновляю существующую сессию для {phone}")
#                 existing.session_string = session_string
#             else:
#                 print(f"✨ Создаю новую сессию для {phone}")
#                 new_session = TelegramSession(
#                     phone=phone,
#                     session_string=session_string
#                 )
#                 db.add(new_session)
#
#             db.commit()
#             print(f"✅ Сессия сохранена в БД для {phone} (длина: {len(session_string)})")
#             return True
#         except Exception as db_error:
#             db.rollback()
#             print(f"❌ Ошибка при работе с БД: {type(db_error).__name__}: {db_error}")
#             import traceback
#             traceback.print_exc()
#             return False
#         finally:
#             db.close()
#
#     except Exception as e:
#         print(f"❌ Критическая ошибка сохранения сессии в БД: {type(e).__name__}: {e}")
#         import traceback
#         traceback.print_exc()
#         return False


async def save_session_to_db(phone: str, session_string: str):
    db = SessionLocal()
    try:
        print("🧪 Проверяю наличие таблицы telegram_sessions")

        # принудительное создание таблицы если нет
        TelegramSession.__table__.create(
            bind=db.get_bind(),
            checkfirst=True
        )

        existing = db.query(TelegramSession)\
            .filter(TelegramSession.phone == phone)\
            .first()

        if existing:
            print(f"🔄 Обновляю существующую сессию для {phone}")
            existing.session_string = session_string
        else:
            print(f"✨ Создаю новую сессию для {phone}")
            db.add(
                TelegramSession(
                    phone=phone,
                    session_string=session_string
                )
            )

        db.commit()
        print(f"✅ Сессия сохранена в БД для {phone}")
        return True

    except Exception as e:
        print("❌ Реальная ошибка сохранения TelegramSession:")
        print(repr(e))
        return False

    finally:
        db.close()
