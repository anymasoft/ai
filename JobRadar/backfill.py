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
from database import get_db
from filter_engine import load_active_filter, match_text
from telegram_clients import get_user_client

logger = logging.getLogger(__name__)

MAX_BACKFILL_ATTEMPTS = 1000  # Максимум попыток при поиске N постов
BACKFILL_SLEEP_MIN = 2.0      # Пауза для человекоподобности (2-5 сек)
BACKFILL_SLEEP_MAX = 5.0


async def backfill_one_post(source_username: str, user_id: int, db: Session, count: int = 1) -> dict:
    """
    Загрузить N релевантных постов из истории источника.

    НЕЗАВИСИМЫЙ КОНТУР:
    - Работает независимо от статуса мониторинга (включен/выключен)
    - Использует per-user TelegramClient (получается через get_user_client)
    - Проверяет по тем же ключевым словам
    - Сохраняет найденные посты в SourceMessage таблице

    Алгоритм:
    1. Resolve источника (как в monitor.py)
    2. Получить последний message_id
    3. Идти назад по message_id и искать релевантные сообщения
    4. Проверить на ключевые слова (как в monitor.py)
    5. Если подходит — сохранить в БД
    6. Если не подходит — пометить и идти дальше
    7. Повторять пока не найдется count постов или не кончатся попытки

    Args:
        source_username: username источника (без @)
        user_id: ID пользователя (владельца Telegram сессии)
        db: SQLAlchemy сессия
        count: сколько постов загрузить (по умолчанию 1)

    Returns:
        dict с результатом: {
            "status": "published" | "not_found" | "error",
            "published_count": int,
            "checked": int,
            "message": str,
            ...
        }
    """
    try:
        # Получить TelegramClient пользователя
        client = await get_user_client(user_id, db)
        if not client:
            return {
                "status": "error",
                "message": f"❌ Telegram клиент для user_id={user_id} не инициализирован"
            }

        # Шаг 1: Resolve источника (как в resolve_channel_entity для username)
        logger.info(f"[BACKFILL] Resolve источника @{source_username} для user_id={user_id}")
        entity = await client.get_entity(f"@{source_username}")
        source_chat_id = entity.id
        source_display = f"@{source_username}"

        logger.info(f"[BACKFILL] Источник resolved: {source_display}, chat_id={source_chat_id}")

        # Шаг 2: Найти последний message_id
        messages = await client.get_messages(entity, limit=1)
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

        # Загружаем конфигурацию фильтра (как в check_channel_for_new_messages)
        filter_config = load_active_filter(db)

        if not keywords_list and filter_config.get("mode") == "keyword_or":
            return {
                "status": "error",
                "message": "❌ Нет активных ключевых слов для проверки"
            }

        # Шаг 3: Цикл по необработанным сообщениям
        checked_count = 0
        published_count = 0

        for offset in range(1, MAX_BACKFILL_ATTEMPTS + 1):
            # Если уже загрузили нужное количество - выходим
            if published_count >= count:
                break
            current_id = last_id - offset

            if current_id <= 0:
                logger.info(f"[BACKFILL] Достигнут начало истории (message_id={current_id})")
                break

            # Sleep между запросами (анти-бан)
            await asyncio.sleep(random.uniform(BACKFILL_SLEEP_MIN, BACKFILL_SLEEP_MAX))

            try:
                # Получить одно сообщение - ТОЧНО КАК в check_channel_for_new_messages
                # используя min_id и max_id для получения конкретного сообщения
                msg_list = await client.get_messages(
                    entity,
                    limit=1,
                    min_id=current_id - 1,  # ID > current_id - 1, т.е. ID >= current_id
                    max_id=current_id + 1   # ID < current_id + 1, т.е. ID <= current_id
                )

                if not msg_list:
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

                # Проверить совпадение через фильтр (как в check_channel_for_new_messages)
                if match_text(text, filter_config):
                    logger.info(f"[BACKFILL] Найден релевантный пост #{published_count + 1}: message_id={message.id}")

                    try:
                        # Записать в БД
                        source_msg = SourceMessage(
                            source_chat_id=source_chat_id,
                            source_message_id=message.id,
                            text=(message.text or "")[:4000],
                            has_keywords=True,
                            published=True,
                            checked_at=datetime.utcnow(),
                            published_at=datetime.utcnow(),
                            source_channel_username=source_username
                        )
                        db.add(source_msg)
                        db.commit()

                        published_count += 1
                        logger.info(f"[BACKFILL] ✅ Найден пост {published_count}/{count}: message_id={message.id}")

                        # Если уже загрузили нужное количество - выходим
                        if published_count >= count:
                            logger.info(f"[BACKFILL] Загружено {published_count} постов из {source_display}")
                            break

                    except Exception as e:
                        logger.error(f"[BACKFILL] Ошибка сохранения message_id={message.id}: {e}")
                        # Не записываем в БД, продолжаем искать дальше

                # Если не подходит — идём дальше

            except Exception as e:
                logger.warning(f"[BACKFILL] Ошибка при обработке message_id={current_id}: {e}")
                checked_count += 1
                continue

        # Результаты завершения
        if published_count > 0:
            logger.info(f"[BACKFILL] Загружено {published_count}/{count} постов из {source_display}. Проверено {checked_count} сообщений")
            return {
                "status": "published",
                "published_count": published_count,
                "checked": checked_count,
                "message": f"✅ Загружено {published_count} пост(ов) из {source_display} (проверено {checked_count} сообщений)"
            }
        else:
            logger.info(f"[BACKFILL] Не найдены релевантные посты. Проверено {checked_count} сообщений")
            return {
                "status": "not_found",
                "published_count": 0,
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
