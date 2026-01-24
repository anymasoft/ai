"""
JobRadar - Функционал backfill (загрузка истории постов)

НЕЗАВИСИМЫЙ КОНТУР: работает независимо от статуса мониторинга (включен/выключен).
Переиспользует существующие функции из monitor.py для получения и обработки сообщений.
"""
import asyncio
import logging
import random
from datetime import datetime
from sqlalchemy.orm import Session

from models import SourceMessage, Channel, Keyword
import monitor
from database import get_db

logger = logging.getLogger(__name__)

MAX_BACKFILL_ATTEMPTS = 50
BACKFILL_SLEEP_MIN = 0.7
BACKFILL_SLEEP_MAX = 1.5


async def backfill_one_post(source_username: str, db: Session) -> dict:
    """
    Загрузить один релевантный пост из истории источника.

    НЕЗАВИСИМЫЙ КОНТУР:
    - Работает независимо от статуса мониторинга (включен/выключен)
    - Использует авторизованный telegram_client из monitor.py
    - Проверяет по тем же ключевым словам
    - Публикует в целевой канал (переиспользует publish_matched_post)

    Алгоритм:
    1. Resolve источника (как в monitor.py)
    2. Получить последний message_id
    3. Идти назад по message_id и искать первый необработанный
    4. Проверить на ключевые слова (как в monitor.py)
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
    # Проверить что telegram_client инициализирован
    if not monitor.telegram_client:
        return {
            "status": "error",
            "message": "❌ Telegram клиент не инициализирован"
        }

    try:
        # Шаг 1: Resolve источника (как в resolve_channel_entity для username)
        logger.info(f"[BACKFILL] Resolve источника @{source_username}")
        entity = await monitor.telegram_client.get_entity(f"@{source_username}")
        source_chat_id = entity.id
        source_display = f"@{source_username}"

        logger.info(f"[BACKFILL] Источник resolved: {source_display}, chat_id={source_chat_id}")

        # Шаг 2: Найти последний message_id
        messages = await monitor.telegram_client.get_messages(entity, limit=1)
        if not messages:
            return {
                "status": "error",
                "message": f"❌ Канал пуст или недоступен: {source_display}"
            }

        last_id = messages[0].id
        logger.info(f"[BACKFILL] Последний message_id в {source_display}: {last_id}")

        # Получить активные ключевые слова (как в check_channel_for_new_messages)
        keywords = db.query(Keyword).filter(Keyword.enabled == True).all()
        keywords_list = [kw.word.lower() for kw in keywords]

        if not keywords_list:
            return {
                "status": "error",
                "message": "❌ Нет активных ключевых слов для проверки"
            }

        # Шаг 3: Цикл по необработанным сообщениям
        checked_count = 0

        for offset in range(1, MAX_BACKFILL_ATTEMPTS + 1):
            current_id = last_id - offset

            if current_id <= 0:
                logger.info(f"[BACKFILL] Достигнут начало истории (message_id={current_id})")
                break

            # Sleep между запросами (анти-бан)
            await asyncio.sleep(random.uniform(BACKFILL_SLEEP_MIN, BACKFILL_SLEEP_MAX))

            try:
                # Получить одно сообщение (как в check_channel_for_new_messages)
                msg_list = await monitor.telegram_client.get_messages(entity, ids=current_id)
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

                # Извлечь текст (как в check_channel_for_new_messages)
                text = (message.text or "").lower()
                checked_count += 1

                if not text:
                    logger.debug(f"[BACKFILL] Сообщение {message.id} пусто (пропуск)")
                    continue

                # Проверить ключевые слова (как в check_channel_for_new_messages)
                matched_keywords = [kw for kw in keywords_list if kw in text]

                # Записать в БД (обязательно, даже если не подходит)
                source_msg = SourceMessage(
                    source_chat_id=source_chat_id,
                    source_message_id=message.id,
                    text=(message.text or "")[:4000],  # Обрезать на 4000 символов
                    has_keywords=bool(matched_keywords),
                    published=False,
                    checked_at=datetime.utcnow(),
                    source_channel_username=source_username
                )
                db.add(source_msg)
                db.commit()

                logger.debug(f"[BACKFILL] Записано в БД: message_id={message.id}, has_keywords={bool(matched_keywords)}")

                # Если релевантно — публикуем
                if matched_keywords:
                    logger.info(f"[BACKFILL] Найден релевантный пост: message_id={message.id}, ключи: {matched_keywords}")

                    # Создать временный Channel объект для переиспользования publish_matched_post
                    temp_channel = _create_temp_channel(entity, source_username)

                    try:
                        # Форматировать и опубликовать (как в check_channel_for_new_messages -> publish_matched_post)
                        await monitor.publish_matched_post(message, temp_channel)

                        # Обновить БД
                        source_msg.published = True
                        source_msg.published_at = datetime.utcnow()
                        db.commit()

                        logger.info(f"[BACKFILL] ✅ Опубликовано: message_id={message.id}, источник={source_display}")

                        return {
                            "status": "published",
                            "source_message_id": message.id,
                            "checked": checked_count,
                            "message": f"✅ Опубликовано из {source_display}: ключи {', '.join(matched_keywords[:3])}"
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
    существующих функций publish_matched_post.

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
