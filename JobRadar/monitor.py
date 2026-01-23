"""
JobRadar v0 - Polling-мониторинг каналов (на основе LeadScanner)
"""
import asyncio
import json
from telethon import TelegramClient
from telethon.errors import ChannelPrivateError, ChannelInvalidError
from sqlalchemy.orm import Session
from datetime import datetime

from config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE
from config import POLLING_INTERVAL_SECONDS, MAX_MESSAGES_PER_CHECK
from models import Channel, Keyword
from database import get_db

# Глобальный Telegram клиент
telegram_client = None


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


async def check_channel_for_new_messages(channel: Channel, db: Session):
    """
    Проверить канал на новые сообщения (polling логика из LeadScanner)

    Args:
        channel: Объект Channel из БД
        db: SQLAlchemy сессия
    """
    if not telegram_client:
        print("⚠️  Telegram клиент не инициализирован")
        return

    try:
        # Получаем сущность канала по username
        entity = await telegram_client.get_entity(channel.username)

        # Получаем ID последнего сообщения в канале
        messages = await telegram_client.get_messages(entity, limit=1)
        if not messages:
            return

        current_last_id = messages[0].id

        # Если есть новые сообщения
        if current_last_id > channel.last_message_id:
            print(f"\n📡 Проверяю канал @{channel.username}...")

            # Получаем все новые сообщения
            new_messages = await telegram_client.get_messages(
                entity,
                limit=MAX_MESSAGES_PER_CHECK,
                min_id=channel.last_message_id,
                max_id=current_last_id + 1
            )

            # Получаем все активные ключевые слова
            keywords = db.query(Keyword).filter(Keyword.enabled == True).all()
            keywords_list = [kw.word.lower() for kw in keywords]

            # Обрабатываем сообщения (в обратном порядке - от старых к новым)
            matched_count = 0
            for msg in reversed(new_messages):
                text = (msg.text or "").lower()

                if not text:
                    continue

                # Проверяем совпадение с ключевыми словами
                matched_keywords = [kw for kw in keywords_list if kw in text]

                if matched_keywords:
                    matched_count += 1
                    print(f"  🎯 СОВПАДЕНИЕ НАЙДЕНО!")
                    print(f"     Канал: @{channel.username}")
                    print(f"     Время: {msg.date.strftime('%Y-%m-%d %H:%M:%S') if msg.date else 'N/A'}")
                    print(f"     Автор: {msg.sender.username if msg.sender and hasattr(msg.sender, 'username') else 'Unknown'}")
                    print(f"     Ключевые слова: {', '.join(matched_keywords)}")
                    print(f"     Текст: {text[:200]}...")
                    print()

            if matched_count == 0:
                print(f"  ✅ Проверено {len(new_messages)} сообщений, совпадений не найдено")
            else:
                print(f"  🎯 Найдено совпадений: {matched_count}")

            # Обновляем last_message_id в БД
            channel.last_message_id = current_last_id
            db.commit()

    except ChannelPrivateError:
        print(f"❌ Канал @{channel.username} приватный или был удален")
        channel.enabled = False
        db.commit()
    except ChannelInvalidError:
        print(f"❌ Канал @{channel.username} не найден")
        channel.enabled = False
        db.commit()
    except Exception as e:
        print(f"⚠️  Ошибка при проверке @{channel.username}: {e}")


async def background_monitoring_job():
    """
    Фоновая задача для периодической проверки каналов (как в LeadScanner)
    Вызывается каждые POLLING_INTERVAL_SECONDS секунд
    """
    try:
        db = get_db()

        # Получаем все активные каналы
        channels = db.query(Channel).filter(Channel.enabled == True).all()

        if not channels:
            # print(f"⏰ [{datetime.now().strftime('%H:%M:%S')}] Нет активных каналов")
            db.close()
            return

        print(f"\n⏱️  [{datetime.now().strftime('%H:%M:%S')}] Начинаю проверку {len(channels)} каналов...")

        # Проверяем каждый канал
        for channel in channels:
            await check_channel_for_new_messages(channel, db)

        db.close()

    except Exception as e:
        print(f"❌ Ошибка в фоновой задаче мониторинга: {e}")


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
