"""
JobRadar v0 - Polling-мониторинг каналов (на основе LeadScanner)
"""
import asyncio
import json
import re
import logging
from telethon import TelegramClient
from telethon.errors import ChannelPrivateError, ChannelInvalidError
from telethon.tl.types import PeerChannel
from sqlalchemy.orm import Session
from datetime import datetime

from config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE
from config import POLLING_INTERVAL_SECONDS, MAX_MESSAGES_PER_CHECK, TARGET_CHANNEL_ID
from models import Channel, Keyword
from database import get_db

# Логирование
logger = logging.getLogger(__name__)

# Глобальный Telegram клиент
telegram_client = None


def normalize_channel_ref(input_str: str) -> dict:
    """
    Нормализация ввода канала в стандартный формат

    Args:
        input_str: Ввод пользователя (@username или t.me/username)

    Returns:
        dict с полями:
            - kind: "username"
            - value: str (username без @)
            - display: строка для UI

    Raises:
        ValueError: если формат неверный или попытка добавить по ID
    """
    input_str = input_str.strip()

    # Проверка: запрет на ID форматы
    # Попытка добавить по числам или -100xxxxx
    if input_str.isdigit() or (input_str.startswith("-100") and len(input_str) > 4 and input_str[4:].isdigit()):
        raise ValueError(
            "❌ Добавление по ID не поддерживается.\n"
            "Введите @username или ссылку t.me/username"
        )

    # Попытка 1: t.me/ ссылка
    if "t.me/" in input_str:
        match = re.search(r't\.me/([a-zA-Z0-9_]+)', input_str)
        if match:
            username = match.group(1)
            return {
                "kind": "username",
                "value": username,
                "display": f"@{username}"
            }

    # Попытка 2: @username
    if input_str.startswith("@"):
        username = input_str[1:].strip()
        if re.match(r'^[a-zA-Z0-9_]+$', username):
            return {
                "kind": "username",
                "value": username,
                "display": f"@{username}"
            }

    # Если просто username без @ и без особых символов
    if re.match(r'^[a-zA-Z0-9_]+$', input_str):
        return {
            "kind": "username",
            "value": input_str,
            "display": f"@{input_str}"
        }

    raise ValueError(
        "❌ Неверный формат. Введите:\n"
        "• @username\n"
        "• t.me/username"
    )


async def init_telegram_client():
    """Инициализация Telegram User Client (как в LeadScanner)"""
    global telegram_client

    if telegram_client is None:
        session_name = "jobradar_session"
        telegram_client = TelegramClient(session_name, TELEGRAM_API_ID, TELEGRAM_API_HASH)

        try:
            await telegram_client.start(phone=TELEGRAM_PHONE)
            print("✅ Telegram клиент инициализирован")
        except Exception as e:
            print(f"❌ Ошибка инициализации Telegram: {e}")
            raise


async def close_telegram_client():
    """Закрыть Telegram клиент"""
    global telegram_client

    if telegram_client:
        await telegram_client.disconnect()
        print("🔌 Telegram клиент отключен")


async def resolve_channel_entity(channel: Channel):
    """
    Резолвить сущность канала в зависимости от kind (username или id)

    Args:
        channel: Объект Channel из БД

    Returns:
        entity для использования с telegram_client

    Raises:
        Exception: если не удалось получить доступ к каналу
    """
    if channel.kind == "username":
        # Резолвим по username: просто @username или саму строку
        return await telegram_client.get_entity(f"@{channel.value}")

    elif channel.kind == "id":
        # Резолвим по numeric id - нужно попробовать несколько способов
        cid = int(channel.value)

        # Попытка 1: прямой numeric id
        try:
            return await telegram_client.get_entity(cid)
        except:
            pass

        # Попытка 2: PeerChannel с numeric id
        try:
            peer = PeerChannel(cid)
            return await telegram_client.get_entity(peer)
        except:
            pass

        # Попытка 3: get_input_entity с PeerChannel
        try:
            peer = PeerChannel(cid)
            return await telegram_client.get_input_entity(peer)
        except:
            pass

        # Все попытки провалились
        raise Exception(
            f"Не удалось получить доступ к каналу по id {cid}. "
            "Для публичного канала используйте @username или t.me/username. "
            "ID работает только если аккаунт видит этот канал (есть в диалогах/подписках)."
        )

    else:
        raise ValueError(f"Неизвестный kind: {channel.kind}")


async def get_channel_display(channel: Channel) -> str:
    """Получить display-строку для канала (для логов)"""
    if channel.kind == "username":
        return f"@{channel.value}"
    else:
        return f"id:{channel.value}"


async def publish_matched_post(message, channel_display: str):
    """
    Публикует найденный пост в целевой канал JobRadar
    со сбережением форматирования, ссылок и упоминаний

    Args:
        message: Объект сообщения от Telethon
        channel_display: Display-строка источника (для логирования)
    """
    if not telegram_client or not TARGET_CHANNEL_ID:
        return

    if not message.text:
        logger.debug(f"⏩ Сообщение без текста, пропускаю публикацию")
        return

    try:
        # Получаем информацию об entities для логирования
        entities_info = None
        if message.entities:
            entity_types = set()
            for entity in message.entities:
                entity_types.add(type(entity).__name__)
            entities_info = ", ".join(sorted(entity_types))

        # Отправляем сообщение с сохранением форматирования и ссылок
        await telegram_client.send_message(
            TARGET_CHANNEL_ID,
            message.text,
            formatting_entities=message.entities,
            link_preview=bool(message.web_preview) if message.web_preview else False
        )

        # Логируем успешную публикацию с информацией об entities
        if entities_info:
            logger.info(f"📤 Опубликован пост с entities [{entities_info}] | channel={channel_display} message_id={message.id}")
        else:
            logger.info(f"ℹ️ Опубликован пост без entities (обычный текст) | channel={channel_display} message_id={message.id}")

    except Exception as e:
        logger.error(f"❌ Ошибка публикации в JobRadar: {e}")


async def check_channel_for_new_messages(channel: Channel, db: Session):
    """
    Проверить канал на новые сообщения (polling логика из LeadScanner)
    Обрабатывает ТОЛЬКО сообщения, опубликованные после last_message_id

    Args:
        channel: Объект Channel из БД
        db: SQLAlchemy сессия
    """
    if not telegram_client:
        print("⚠️  Telegram клиент не инициализирован")
        return

    try:
        # Получаем сущность канала (с поддержкой username и id)
        entity = await resolve_channel_entity(channel)
        channel_display = await get_channel_display(channel)

        # Получаем ID последнего сообщения в канале
        messages = await telegram_client.get_messages(entity, limit=1)
        if not messages:
            return

        current_last_id = messages[0].id

        # Если last_message_id не инициализирован - устанавливаем стартовую точку
        if channel.last_message_id == 0:
            channel.last_message_id = current_last_id
            db.commit()
            logger.info(f"⏺ Стартовая инициализация {channel_display}: last_message_id={current_last_id}")
            return

        # Если есть новые сообщения
        if current_last_id > channel.last_message_id:
            # Получаем все новые сообщения (strict > для пропуска старых)
            new_messages = await telegram_client.get_messages(
                entity,
                limit=MAX_MESSAGES_PER_CHECK,
                min_id=channel.last_message_id,
                max_id=current_last_id + 1
            )

            # Фильтруем - оставляем ТОЛЬКО сообщения с id > last_message_id
            filtered_messages = [msg for msg in new_messages if msg.id > channel.last_message_id]

            if not filtered_messages:
                logger.debug(f"⏩ Пропускаю старые сообщения канала {channel_display}")
                return

            # Получаем все активные ключевые слова
            keywords = db.query(Keyword).filter(Keyword.enabled == True).all()
            keywords_list = [kw.word.lower() for kw in keywords]

            # Обрабатываем сообщения (в обратном порядке - от старых к новым)
            matched_count = 0
            for msg in reversed(filtered_messages):
                text = (msg.text or "").lower()

                if not text:
                    continue

                # Проверяем совпадение с ключевыми словами
                matched_keywords = [kw for kw in keywords_list if kw in text]

                if matched_keywords:
                    matched_count += 1
                    print(f"\n🎯 СОВПАДЕНИЕ НАЙДЕНО!")
                    print(f"   Канал: {channel_display}")
                    print(f"   Время: {msg.date.strftime('%Y-%m-%d %H:%M:%S') if msg.date else 'N/A'}")
                    print(f"   Автор: {msg.sender.username if msg.sender and hasattr(msg.sender, 'username') else 'Unknown'}")
                    print(f"   Ключевые слова: {', '.join(matched_keywords)}")
                    print(f"   Текст: {text[:200]}...\n")

                    # Публикуем найденный пост в канал JobRadar
                    await publish_matched_post(msg, channel_display)

            # Обновляем last_message_id на максимальный обработанный
            new_last_id = max([msg.id for msg in filtered_messages])
            channel.last_message_id = new_last_id
            db.commit()

            # Логируем результаты только если есть обработанные сообщения
            logger.info(f"🆕 Обработано {len(filtered_messages)} новых сообщений канала {channel_display}, совпадений: {matched_count}")
            logger.debug(f"📌 Обновлён last_message_id={new_last_id} для канала {channel_display}")

    except ChannelPrivateError:
        channel_display = await get_channel_display(channel)
        logger.warning(f"❌ Канал {channel_display} приватный или был удален - отключен")
        channel.enabled = False
        db.commit()
    except ChannelInvalidError:
        channel_display = await get_channel_display(channel)
        logger.warning(f"❌ Канал {channel_display} не найден - отключен")
        channel.enabled = False
        db.commit()
    except Exception as e:
        channel_display = await get_channel_display(channel)

        # Если канал добавлен по ID и недоступен - отключаем его один раз
        if channel.kind == "id":
            logger.warning(f"⚠️ Канал {channel_display} отключён: недоступен по ID (аккаунт не подписан)")
            channel.enabled = False
            db.commit()
        else:
            # Для username каналов логируем каждый раз, так как это может быть временная ошибка
            logger.error(f"⚠️  Ошибка при проверке {channel_display}: {e}")


async def background_monitoring_job():
    """
    Фоновая задача для периодической проверки каналов (как в LeadScanner)
    Вызывается каждые POLLING_INTERVAL_SECONDS секунд

    Проверяет глобальный флаг monitoring_enabled перед выполнением
    Обрабатывает ТОЛЬКО новые сообщения (опубликованные после last_message_id)
    """
    try:
        # Импортируем флаг из main.py
        from __main__ import monitoring_enabled

        # Если мониторинг отключен, пропускаем цикл
        if not monitoring_enabled:
            return

        db = get_db()

        # Получаем все активные каналы
        channels = db.query(Channel).filter(Channel.enabled == True).all()

        if not channels:
            db.close()
            return

        # Проверяем каждый канал на новые сообщения
        for channel in channels:
            await check_channel_for_new_messages(channel, db)

        db.close()

    except Exception as e:
        logger.error(f"❌ Ошибка в фоновой задаче мониторинга: {e}")


def start_polling_monitoring():
    """
    Запустить фоновый polling мониторинг через APScheduler
    (как в LeadScanner main.py)
    """
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    scheduler = AsyncIOScheduler()

    # Добавляем периодическую задачу
    scheduler.add_job(
        background_monitoring_job,
        'interval',
        seconds=POLLING_INTERVAL_SECONDS,
        coalesce=True,
        max_instances=1
    )

    scheduler.start()
    print(f"🚀 Polling-мониторинг запущен (интервал: {POLLING_INTERVAL_SECONDS} сек)")

    return scheduler
