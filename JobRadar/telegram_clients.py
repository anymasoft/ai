"""
JobRadar - Управление per-user Telegram клиентами

Каждый пользователь имеет собственный TelegramClient, восстановленный из его session_string.
Клиенты кешируются в памяти для оптимизации.
"""
import logging
from typing import Optional
from telethon import TelegramClient
from telethon.sessions import StringSession
from sqlalchemy.orm import Session

from config import TELEGRAM_API_ID, TELEGRAM_API_HASH
from models import TelegramSession

logger = logging.getLogger(__name__)

# Кеш клиентов: {user_id: TelegramClient}
telegram_clients_cache = {}


async def get_user_client(user_id: int, db: Session) -> Optional[TelegramClient]:
    """
    Получить TelegramClient для конкретного пользователя.

    Логика:
    1. Если клиент есть в кеше → вернуть его
    2. Иначе:
       - Получить TelegramSession по user_id из БД
       - Восстановить StringSession из session_string
       - Создать новый TelegramClient
       - Подключиться (await connect)
       - Сохранить в кеш
       - Вернуть

    Args:
        user_id: ID пользователя
        db: SQLAlchemy сессия

    Returns:
        TelegramClient или None если сессия не найдена
    """
    # Проверить кеш
    if user_id in telegram_clients_cache:
        cached_client = telegram_clients_cache[user_id]
        # Проверить что клиент ещё подключен
        if cached_client.is_connected():
            logger.debug(f"[CLIENT_CACHE] user_id={user_id} - используется кешированный клиент")
            return cached_client
        else:
            # Клиент был отключен, удалить из кеша
            del telegram_clients_cache[user_id]
            logger.debug(f"[CLIENT_CACHE] user_id={user_id} - кешированный клиент отключен, удален из кеша")

    try:
        # Получить TelegramSession из БД
        telegram_session = (
            db.query(TelegramSession)
            .filter(TelegramSession.user_id == user_id)
            .first()
        )

        if not telegram_session:
            logger.warning(f"[CLIENT_CREATE] user_id={user_id} - TelegramSession не найдена в БД")
            return None

        if not telegram_session.session_string:
            logger.warning(f"[CLIENT_CREATE] user_id={user_id} - session_string пуста")
            return None

        # Восстановить StringSession из сохраненной строки
        session_string = StringSession(telegram_session.session_string)

        # Создать новый TelegramClient
        client = TelegramClient(session_string, TELEGRAM_API_ID, TELEGRAM_API_HASH)

        # Подключиться
        await client.connect()
        logger.info(f"[CLIENT_CREATE] user_id={user_id} - создан и подключен новый клиент")

        # Сохранить в кеш
        telegram_clients_cache[user_id] = client

        return client

    except Exception as e:
        logger.error(f"[CLIENT_CREATE] user_id={user_id} - ошибка создания клиента: {e}")
        return None


async def disconnect_user_client(user_id: int):
    """
    Отключить и удалить клиент пользователя из кеша.

    Args:
        user_id: ID пользователя
    """
    if user_id in telegram_clients_cache:
        try:
            client = telegram_clients_cache[user_id]
            await client.disconnect()
            del telegram_clients_cache[user_id]
            logger.info(f"[CLIENT_DISCONNECT] user_id={user_id} - клиент отключен и удален из кеша")
            print(f"TG CLIENT DISCONNECTED user_id={user_id}")
        except Exception as e:
            logger.error(f"[CLIENT_DISCONNECT] user_id={user_id} - ошибка отключения: {e}")


async def disconnect_all_clients():
    """
    Отключить все клиенты из кеша (при завершении приложения).
    """
    for user_id in list(telegram_clients_cache.keys()):
        await disconnect_user_client(user_id)
    logger.info("[CLIENT_DISCONNECT] Все клиенты отключены")
