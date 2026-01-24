"""
JobRadar - Функционал backfill (загрузка истории постов)
"""
import asyncio
import logging
import random
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models import SourceMessage, Channel, Keyword
from monitor import (
    telegram_client,
    format_jobradar_post,
    build_message_link,
    build_source_link,
    get_channel_display,
)
from config import TARGET_CHANNEL_ID
from database import get_db
from telethon.tl.types import MessageEntityTextUrl

logger = logging.getLogger(__name__)

MAX_BACKFILL_ATTEMPTS = 50
BACKFILL_SLEEP_MIN = 0.7
BACKFILL_SLEEP_MAX = 1.5


async def backfill_one_post(source_username: str, db: Session) -> dict:
    """
    Загрузить один релевантный пост из истории источника.

    Алгоритм:
    1. Resolve источника
    2. Найти последний message_id
    3. Идти назад по message_id и искать первый необработанный
    4. Проверить на ключевые слова
    5. Если подходит — опубликовать и обновить БД
    6. Если не подходит — пометить и идти дальше

    Args:
        source_username: username источника (без @)
        db: SQLAlchemy сессия

    Returns:
        dict с результатом: {
            "status": "published" | "not_found" | "error",
            "source_message_id": int | None,
            "checked": int,
            "message": str,
            ...
        }
    """
    if not telegram_client:
        return {
            "status": "error",
            "message": "❌ Telegram клиент не инициализирован"
        }

    try:
        # Шаг A: Resolve источника
        logger.info(f"[BACKFILL] Resolve источника @{source_username}")
        entity = await telegram_client.get_entity(f"@{source_username}")
        source_chat_id = entity.id
        source_display = f"@{source_username}"

        logger.info(f"[BACKFILL] Источник resolved: {source_display}, chat_id={source_chat_id}")

        # Шаг C: Найти последний message_id
        messages = await telegram_client.get_messages(entity, limit=1)
        if not messages:
            return {
                "status": "error",
                "message": f"❌ Канал пуст или недоступен: {source_display}"
            }

        last_id = messages[0].id
        logger.info(f"[BACKFILL] Последний message_id в {source_display}: {last_id}")

        # Получить активные ключевые слова
        keywords = db.query(Keyword).filter(Keyword.enabled == True).all()
        keywords_list = [kw.word.lower() for kw in keywords]

        # Шаг D: Цикл по необработанным сообщениям
        checked_count = 0

        for offset in range(1, MAX_BACKFILL_ATTEMPTS + 1):
            current_id = last_id - offset

            if current_id <= 0:
                logger.info(f"[BACKFILL] Достигнут начало истории (message_id={current_id})")
                break

            # Sleep между запросами (анти-бан)
            await asyncio.sleep(random.uniform(BACKFILL_SLEEP_MIN, BACKFILL_SLEEP_MAX))

            try:
                # Получить одно сообщение
                msg_list = await telegram_client.get_messages(entity, ids=current_id)
                if not msg_list or msg_list[0] is None:
                    logger.debug(f"[BACKFILL] Сообщение {current_id} не существует (пропуск)")
                    checked_count += 1
                    continue

                message = msg_list[0]

                # Проверить, уже ли обработано
                existing = db.query(SourceMessage).filter(
                    SourceMessage.source_chat_id == source_chat_id,
                    SourceMessage.source_message_id == message.id
                ).first()

                if existing:
                    logger.debug(f"[BACKFILL] Сообщение {message.id} уже обработано (пропуск)")
                    checked_count += 1
                    continue

                # Извлечь текст
                text = message.raw_text or ""
                checked_count += 1

                # Проверить ключевые слова
                has_keywords = any(kw in text.lower() for kw in keywords_list)

                # Записать в БД (обязательно, даже если не подходит)
                source_msg = SourceMessage(
                    source_chat_id=source_chat_id,
                    source_message_id=message.id,
                    text=text[:4000],  # Обрезать на 4000 символов
                    has_keywords=has_keywords,
                    published=False,
                    checked_at=datetime.utcnow(),
                    source_channel_username=source_username
                )
                db.add(source_msg)
                db.commit()

                logger.debug(f"[BACKFILL] Записано в БД: message_id={message.id}, has_keywords={has_keywords}")

                # Если релевантно — публикуем
                if has_keywords:
                    logger.info(f"[BACKFILL] Найден релевантный пост: message_id={message.id}")

                    # Создать временный Channel объект
                    temp_channel = _create_temp_channel(entity, source_username)

                    try:
                        # Форматировать пост
                        publish_text, new_entities = await format_jobradar_post(message, temp_channel)

                        if not publish_text:
                            logger.warning(f"[BACKFILL] Не удалось форматировать пост {message.id}")
                            return {
                                "status": "error",
                                "message": "❌ Ошибка форматирования поста"
                            }

                        # Опубликовать
                        await telegram_client.send_message(
                            TARGET_CHANNEL_ID,
                            publish_text,
                            formatting_entities=new_entities if new_entities else None,
                            link_preview=False
                        )

                        # Обновить БД
                        source_msg.published = True
                        source_msg.published_at = datetime.utcnow()
                        db.commit()

                        logger.info(f"[BACKFILL] ✅ Опубликовано: message_id={message.id}, источник={source_display}")

                        # Определить найденные ключевые слова для вывода
                        matched_keywords = [kw for kw in keywords_list if kw in text.lower()]

                        return {
                            "status": "published",
                            "source_message_id": message.id,
                            "checked": checked_count,
                            "message": f"✅ Опубликовано: message_id={message.id}, источник={source_display}, ключи: {', '.join(matched_keywords[:3])}"
                        }

                    except Exception as e:
                        logger.error(f"[BACKFILL] Ошибка публикации message_id={message.id}: {e}")
                        # Оставляем в БД как "обработано, но не опубликовано"
                        return {
                            "status": "error",
                            "message": f"❌ Ошибка при публикации: {str(e)}"
                        }

                # Если не подходит — идём дальше

            except Exception as e:
                logger.warning(f"[BACKFILL] Ошибка при обработке message_id={current_id}: {e}")
                checked_count += 1
                continue

        # Не найдено подходящих постов
        logger.info(f"[BACKFILL] Не найдены релевантные посты. Проверено {checked_count} сообщений")
        return {
            "status": "not_found",
            "checked": checked_count,
            "message": f"ℹ️ Релевантных постов не найдено (проверено {checked_count} сообщений)"
        }

    except ValueError as e:
        logger.error(f"[BACKFILL] Ошибка нормализации: {e}")
        return {
            "status": "error",
            "message": f"❌ Канал не найден или недоступен: {str(e)}"
        }

    except Exception as e:
        logger.error(f"[BACKFILL] Неожиданная ошибка: {e}")
        return {
            "status": "error",
            "message": f"❌ Ошибка: {str(e)}"
        }


def _create_temp_channel(entity, username: str) -> Channel:
    """
    Создать временный объект Channel в памяти для переиспользования
    существующих функций format_jobradar_post и build_source_link.

    Args:
        entity: Telethon сущность канала
        username: username канала (без @)

    Returns:
        Channel объект (не сохранённый в БД)
    """
    channel = Channel()
    channel.kind = "username"
    channel.value = username
    channel.username = username
    channel.title = getattr(entity, 'title', None) or f"@{username}"
    channel.channel_id = entity.id if hasattr(entity, 'id') else None
    channel.enabled = True
    channel.last_message_id = 0
    channel.id = None  # Не в БД

    return channel
