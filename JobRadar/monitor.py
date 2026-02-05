"""
JobRadar v0 - Polling-мониторинг каналов (на основе LeadScanner)
"""
import asyncio
import re
import random
import logging
import os
from typing import Optional
from telethon import TelegramClient
from telethon.errors import FloodWaitError
from sqlalchemy.orm import Session
from datetime import datetime

from config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE
from config import POLLING_INTERVAL_SECONDS, MAX_MESSAGES_PER_CHECK, TARGET_CHANNEL_ID
from models import Channel, Keyword, FilterRule, Task, Lead, SourceMessage, TelegramSession, TaskSourceState
from database import get_db
from filter_engine import load_active_filter, match_text
from telegram_clients import get_user_client, disconnect_all_clients

# ========================================================================
# АРХИТЕКТУРНЫЙ ПРИНЦИП:
# Мониторинг ПОЛНОСТЬЮ НЕЗАВИСИМ от веб-авторизации.
#
# Мониторинг использует ТОЛЬКО:
#   - TelegramSession из БД (сессии Telegram пользователей)
#   - Task из БД (задачи мониторинга)
#   - TelegramClient, восстановленные из session_string
#
# Мониторинг НЕ зависит от:
#   - Web auth_token
#   - Web cookies
#   - Web sessions (user_sessions таблица)
#   - Текущего статуса пользователя в веб-приложении
#
# СЛЕДСТВИЕ:
#   - Logout пользователя НЕ влияет на мониторинг
#   - Мониторинг продолжает доставлять лиды после logout
#   - Logout НЕ должен трогать TelegramSession или TelegramClient
# ========================================================================

# Логирование с обработчиками для консоли
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Консольный обработчик
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)

# Добавить обработчик если его еще нет
if not logger.handlers:
    logger.addHandler(console_handler)

# Флаг для подробной диагностики
DEBUG_MESSAGE_DUMP = os.getenv("DEBUG_MESSAGE_DUMP", "false").lower() == "true"


def dump_message_for_diagnostics(msg, channel: Channel, is_broadcast: bool):
    """
    Выводит полный дамп данных сообщения для диагностики.
    Вызывается только если DEBUG_MESSAGE_DUMP=true
    """
    if not DEBUG_MESSAGE_DUMP:
        return

    logger.info(f"\n{'='*80}")
    logger.info(f"🔍 ДИАГНОСТИКА СООБЩЕНИЯ #{msg.id}")
    logger.info(f"{'='*80}")

    # Структура сообщения
    logger.info(f"Структура Message:")
    logger.info(f"  - type(msg) = {type(msg).__name__}")
    logger.info(f"  - msg.id = {msg.id}")
    logger.info(f"  - msg.date = {msg.date}")

    # Проверка атрибутов is_*
    logger.info(f"Атрибуты is_*:")
    logger.info(f"  - hasattr(msg, 'is_channel') = {hasattr(msg, 'is_channel')}")
    logger.info(f"  - msg.is_channel = {getattr(msg, 'is_channel', 'N/A')}")
    logger.info(f"  - hasattr(msg, 'is_group') = {hasattr(msg, 'is_group')}")
    logger.info(f"  - msg.is_group = {getattr(msg, 'is_group', 'N/A')}")
    logger.info(f"  - hasattr(msg, 'is_private') = {hasattr(msg, 'is_private')}")
    logger.info(f"  - msg.is_private = {getattr(msg, 'is_private', 'N/A')}")

    # Peer/Chat информация
    logger.info(f"Peer & Chat информация:")
    logger.info(f"  - type(msg.peer_id) = {type(msg.peer_id).__name__ if hasattr(msg, 'peer_id') else 'N/A'}")
    logger.info(f"  - type(msg.to_id) = {type(msg.to_id).__name__ if hasattr(msg, 'to_id') else 'N/A'}")
    logger.info(f"  - msg.chat_id = {getattr(msg, 'chat_id', 'N/A')}")
    logger.info(f"  - type(msg.chat) = {type(msg.chat).__name__ if hasattr(msg, 'chat') and msg.chat else 'None'}")
    if hasattr(msg, 'chat') and msg.chat:
        logger.info(f"    - msg.chat.title = {getattr(msg.chat, 'title', 'N/A')}")
        logger.info(f"    - msg.chat.username = {getattr(msg.chat, 'username', 'N/A')}")
        logger.info(f"    - msg.chat.id = {getattr(msg.chat, 'id', 'N/A')}")
        logger.info(f"    - msg.chat.broadcast = {getattr(msg.chat, 'broadcast', 'N/A')}")

    # Автор сообщения (sender, from_user, sender_id, from_id)
    logger.info(f"Информация об авторе:")
    logger.info(f"  - type(msg.sender) = {type(msg.sender).__name__ if hasattr(msg, 'sender') and msg.sender else 'None'}")
    if hasattr(msg, 'sender') and msg.sender:
        logger.info(f"    - msg.sender.id = {getattr(msg.sender, 'id', 'N/A')}")
        logger.info(f"    - msg.sender.username = {getattr(msg.sender, 'username', 'N/A')}")
        logger.info(f"    - msg.sender.first_name = {getattr(msg.sender, 'first_name', 'N/A')}")
        logger.info(f"    - msg.sender.last_name = {getattr(msg.sender, 'last_name', 'N/A')}")
        logger.info(f"    - msg.sender.is_bot = {getattr(msg.sender, 'is_bot', 'N/A')}")

    logger.info(f"  - type(msg.from_user) = {type(getattr(msg, 'from_user', None)).__name__ if getattr(msg, 'from_user', None) else 'None/N/A'}")
    if getattr(msg, 'from_user', None):
        from_user = getattr(msg, 'from_user', None)
        logger.info(f"    - msg.from_user.id = {getattr(from_user, 'id', 'N/A')}")
        logger.info(f"    - msg.from_user.username = {getattr(from_user, 'username', 'N/A')}")

    logger.info(f"  - msg.sender_id = {getattr(msg, 'sender_id', 'N/A')}")
    logger.info(f"  - msg.from_id = {getattr(msg, 'from_id', 'N/A')}")

    # Другие поля, которые могут содержать информацию об авторе
    logger.info(f"Альтернативные источники информации об авторе:")
    logger.info(f"  - msg.post_author = {getattr(msg, 'post_author', 'N/A')}")
    logger.info(f"  - msg.via_bot_id = {getattr(msg, 'via_bot_id', 'N/A')}")
    logger.info(f"  - msg.fwd_from = {getattr(msg, 'fwd_from', 'N/A')}")

    # Определение типа в БД
    logger.info(f"Данные из БД (канал):")
    logger.info(f"  - channel.title = {channel.title}")
    logger.info(f"  - channel.username = {channel.username}")
    logger.info(f"  - channel.value = {channel.value}")
    logger.info(f"  - channel.channel_id = {channel.channel_id}")
    logger.info(f"  - channel.kind = {channel.kind}")

    # Определение по нашей логике
    logger.info(f"Определение типа по нашей логике:")
    logger.info(f"  - is_broadcast (calculated) = {is_broadcast}")

    # Определение автора по нашей логике
    author = getattr(msg, 'sender', None) or getattr(msg, 'from_user', None)
    sender_username = None
    if author and hasattr(author, 'username'):
        sender_username = author.username

    logger.info(f"Выбранный автор:")
    logger.info(f"  - author (sender or from_user) = {type(author).__name__ if author else 'None'}")
    logger.info(f"  - author.id = {getattr(author, 'id', 'N/A') if author else 'N/A'}")
    logger.info(f"  - author.username = {sender_username}")

    logger.info(f"{'='*80}\n")


def normalize_telegram_source(raw: str) -> Optional[str]:
    """
    Нормализировать источник Telegram в чистый username.

    Преобразует любой формат в username без @.

    Вход:
    - https://t.me/jobs1c
    - http://t.me/jobs1c
    - t.me/jobs1c
    - @jobs1c
    - jobs1c

    Выход: jobs1c

    Args:
        raw: Строка с источником в любом формате

    Returns:
        Чистый username или None если не удалось нормализировать
    """
    if not raw:
        return None

    raw = raw.strip()
    if not raw:
        return None

    # Удаляем хвостовые слэши
    raw = raw.rstrip("/")

    # Если начинается с https:// или http://
    if raw.startswith("https://t.me/") or raw.startswith("http://t.me/"):
        # t.me/username или t.me/username/extra
        match = re.search(r't\.me/([a-zA-Z0-9_]+)', raw)
        if match:
            return match.group(1)

    # Если начинается с t.me/
    if raw.startswith("t.me/"):
        match = re.search(r't\.me/([a-zA-Z0-9_]+)', raw)
        if match:
            return match.group(1)

    # Если начинается с @
    if raw.startswith("@"):
        username = raw[1:].strip()
        if re.match(r'^[a-zA-Z0-9_]+$', username):
            return username

    # Если это просто username без @ и без спецсимволов
    if re.match(r'^[a-zA-Z0-9_]+$', raw):
        return raw

    return None


async def safe_send_message(client: TelegramClient, chat_id, text: str, **kwargs):
    """
    Безопасная отправка сообщения с автоматической обработкой FloodWait.

    Если Telegram просит ждать (FloodWaitError) — ждём указанное время и повторяем.

    Args:
        client: TelegramClient для отправки
        chat_id: ID чата или username куда отправляем
        text: Текст сообщения
        **kwargs: Дополнительные параметры для send_message (formatting_entities, link_preview и т.д.)

    Returns:
        Результат send_message если успешно

    Raises:
        Exception: Если ошибка не FloodWait
    """
    logger.debug(f"[SEND_MESSAGE] Попытка отправки в chat_id={chat_id}, client.is_connected()={client.is_connected()}")
    while True:
        try:
            result = await client.send_message(chat_id, text, **kwargs)
            logger.debug(f"[SEND_MESSAGE] Успешно отправлено в chat_id={chat_id}, message_id={result.id}")
            return result
        except FloodWaitError as e:
            wait_time = e.seconds
            logger.warning(f"⏸️ FloodWait: требуется ждать {wait_time} секунд")
            await asyncio.sleep(wait_time)
            logger.info(f"▶️ Повторная попытка отправки после FloodWait")
            continue
        except Exception as e:
            logger.error(f"❌ Ошибка отправки сообщения в chat_id={chat_id}: {type(e).__name__}: {e}")
            raise


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



async def send_lead_to_telegram(task: Task, lead: Lead, db: Session):
    """
    Отправить найденный лид в личный Telegram пользователя.

    Args:
        task: Объект Task из БД
        lead: Объект Lead из БД
        db: SQLAlchemy сессия
    """
    try:
        # Получить TelegramSession по user_id из Task (строгая привязка к БД, не к веб-авторизации)
        telegram_session = (
            db.query(TelegramSession)
            .filter(TelegramSession.user_id == task.user_id)
            .first()
        )
        logger.debug(f"[MONITOR_SESSION] Получена TelegramSession из БД для task.user_id={task.user_id} (независимо от web auth)")
        if not telegram_session:
            logger.warning(f"[SEND] task={task.id} lead={lead.id} - нет Telegram сессии для user_id={task.user_id}")
            return

        if not telegram_session.telegram_user_id:
            logger.warning(f"[SEND] task={task.id} lead={lead.id} - telegram_user_id не установлен в сессии user_id={task.user_id}")
            return

        # Проверить разрешены ли уведомления в личный Telegram
        if not telegram_session.alerts_personal:
            logger.info(f"[SEND] task={task.id} lead={lead.id} отправка в личный чат отключена (alerts_personal=False)")
            return

        # Получить клиент пользователя
        client = await get_user_client(task.user_id, db)
        if not client:
            logger.warning(f"[SEND] task={task.id} lead={lead.id} - Telegram клиент для user_id={task.user_id} не инициализирован")
            return

        logger.debug(f"[SEND] task={task.id} lead={lead.id} - клиент получен, is_connected={client.is_connected()}")

        # Форматируем текст лида
        matched_keyword = lead.matched_keyword or 'не определено'
        text = f"""🔥 Новый лид

{lead.text}

Источник: {lead.source_channel}
Ключ: {matched_keyword}"""

        # Отправляем в личный Telegram используя клиент пользователя
        try:
            await safe_send_message(client, telegram_session.telegram_user_id, text)
            logger.info(f"[SEND] task={task.id} lead={lead.id} доставлено в личный Telegram ({telegram_session.telegram_user_id})")

            # Обновляем поле delivered_at
            lead.delivered_at = datetime.utcnow()
            db.commit()
            logger.info(f"[SEND] task={task.id} lead={lead.id} отмечено как доставленное")
        except Exception as e:
            logger.error(f"[SEND] task={task.id} lead={lead.id} ошибка отправки сообщения: {e}")

    except Exception as e:
        logger.error(f"[SEND] task={task.id} lead={lead.id} критическая ошибка: {e}")


async def monitoring_loop_tasks():
    """
    Бесконечный цикл мониторинга задач (Task-based leads).

    НОВЫЙ КОНТУР: Работает параллельно с существующим monitoring_loop()
    - Получает все Task с status="running"
    - Для каждого task проверяет источники на новые сообщения
    - При совпадении фильтра сохраняет Lead в БД
    - НЕ публикует в Telegram (только сохранение в БД)

    Запускается через asyncio.create_task() при старте приложения.

    ВАЖНО: Мониторинг работает НЕЗАВИСИМО от веб-авторизации.
    Используются ТОЛЬКО TelegramSession и Task из БД.
    """
    logger.info("[MONITOR] Запущен цикл мониторинга (независим от веб-авторизации)")
    while True:
        try:
            db = get_db()

            try:
                # Получаем все активные задачи
                tasks = db.query(Task).filter(Task.status == "running").all()

                if tasks:
                    # Обрабатываем каждую задачу
                    for task in tasks:
                        try:
                            await process_task_for_leads(task, db)
                        except Exception as e:
                            logger.error(f"❌ Ошибка при обработке задачи {task.id} ({task.name}): {e}")
                        await asyncio.sleep(0.2)
            finally:
                db.close()

            # Спим перед следующей проверкой (с random jitter 0-20 сек)
            # Итоговый интервал: 10-30 секунд
            await asyncio.sleep(POLLING_INTERVAL_SECONDS + random.uniform(0, 20))

        except Exception as e:
            logger.error(f"❌ Ошибка в monitoring_loop_tasks: {e}")
            # При ошибке спим 30 секунд перед повторной попыткой
            await asyncio.sleep(30)


async def process_task_for_leads(task: Task, db: Session):
    """
    Обработать одну задачу: проверить все источники на новые сообщения,
    применить фильтр и сохранить найденные leads в БД.

    Args:
        task: Объект Task из БД
        db: SQLAlchemy сессия
    """
    # Парсим sources (может быть comma-separated или newline-separated)
    sources = []
    if task.sources:
        # Пробуем оба формата
        if "," in task.sources:
            sources = [s.strip() for s in task.sources.split(",") if s.strip()]
        else:
            sources = [s.strip() for s in task.sources.split("\n") if s.strip()]

    if not sources:
        logger.warning(f"[LEAD] task={task.id} ({task.name}) не имеет источников")
        return

    # Парсим ключевые слова
    include_keywords = []
    if task.include_keywords:
        if "," in task.include_keywords:
            include_keywords = [kw.strip().lower() for kw in task.include_keywords.split(",") if kw.strip()]
        else:
            include_keywords = [kw.strip().lower() for kw in task.include_keywords.split("\n") if kw.strip()]

    exclude_keywords = []
    if task.exclude_keywords:
        if "," in task.exclude_keywords:
            exclude_keywords = [kw.strip().lower() for kw in task.exclude_keywords.split(",") if kw.strip()]
        else:
            exclude_keywords = [kw.strip().lower() for kw in task.exclude_keywords.split("\n") if kw.strip()]

    if not include_keywords:
        logger.warning(f"[LEAD] task={task.id} ({task.name}) не имеет ключевых слов для поиска")
        return

    # Формируем filter_config прямо в коде
    filter_config = {
        "mode": "advanced",
        "include_any": include_keywords,
        "require_all": [],
        "exclude_any": exclude_keywords
    }

    # Обрабатываем каждый источник
    for raw_source in sources:
        # Нормализируем источник
        source_username = normalize_telegram_source(raw_source)
        if not source_username:
            logger.warning(f"[LEAD] task={task.id} ({task.name}) не удалось нормализировать источник: {raw_source}")
            continue

        try:
            await check_source_for_task_leads(task, source_username, include_keywords, filter_config, db)
        except Exception as e:
            logger.error(f"[LEAD] task={task.id} ({task.name}) ошибка при проверке {source_username}: {e}")
            continue


async def check_source_for_task_leads(task: Task, source_username: str, include_keywords: list, filter_config: dict, db: Session):
    """
    Проверить один источник (канал) на новые сообщения для конкретной задачи.

    ЛОГИКА:
    1. Первый проход (last_message_id == 0):
       - Получить последний пост канала
       - Сохранить его id как last_message_id в TaskSourceState
       - НИЧЕГО НЕ ОБРАБАТЫВАТЬ
       - Возврат

    2. Все остальные проходы:
       - Получить новые сообщения с min_id = last_message_id
       - Обработать ТОЛЬКО msg.id > last_message_id
       - Сохранить найденные leads в БД
       - Обновить last_message_id на max(msg.id) из обработанных

    Args:
        task: Объект Task
        source_username: username источника (без @)
        include_keywords: список ключевых слов для поиска
        filter_config: конфигурация фильтра
        db: SQLAlchemy сессия
    """
    try:
        # Получить клиент пользователя
        client = await get_user_client(task.user_id, db)
        if not client:
            logger.warning(f"[CHECK] task={task.id} source=@{source_username} - Telegram клиент для user_id={task.user_id} не инициализирован")
            return

        # Резолвим источник (source_username уже нормализирован)
        entity = await client.get_entity(f"@{source_username}")
        source_chat_id = entity.id

        # Получаем текущее состояние TaskSourceState для этой пары (task, source)
        task_source_state = (
            db.query(TaskSourceState)
            .filter(
                TaskSourceState.task_id == task.id,
                TaskSourceState.source == source_username
            )
            .first()
        )

        # ИНИЦИАЛИЗАЦИЯ (первый проход)
        if not task_source_state or task_source_state.last_message_id == 0:
            # Получаем последний пост в канале
            messages = await client.get_messages(entity, limit=1)

            if not messages:
                # Канал пуст
                logger.info(f"[INIT] task={task.id} source=@{source_username} empty channel, initialized with 0")
                if not task_source_state:
                    task_source_state = TaskSourceState(
                        task_id=task.id,
                        source=source_username,
                        last_message_id=0
                    )
                    db.add(task_source_state)
                    db.commit()
                return

            # Запомнили позицию последнего сообщения
            initial_message_id = messages[0].id

            if task_source_state:
                # Обновляем существующую запись
                task_source_state.last_message_id = initial_message_id
                task_source_state.updated_at = datetime.utcnow()
            else:
                # Создаём новую запись
                task_source_state = TaskSourceState(
                    task_id=task.id,
                    source=source_username,
                    last_message_id=initial_message_id
                )
                db.add(task_source_state)

            db.commit()
            logger.info(f"[INIT] task={task.id} source=@{source_username} last_message_id={initial_message_id}")
            # ВЫХОД из функции - первый проход только инициализирует позицию
            return

        # РЕГУЛЯРНАЯ ПРОВЕРКА (все остальные проходы)
        last_message_id = task_source_state.last_message_id

        # Получаем новые сообщения с min_id = last_message_id
        new_messages = await client.get_messages(
            entity,
            limit=MAX_MESSAGES_PER_CHECK,
            min_id=last_message_id
        )

        if not new_messages:
            # Нет новых сообщений
            return

        # Фильтруем - оставляем ТОЛЬКО сообщения с id > last_message_id
        filtered_messages = [msg for msg in new_messages if msg.id > last_message_id]

        if not filtered_messages:
            # Все сообщения уже обработаны
            return

        # Обрабатываем сообщения (от старых к новым)
        matched_count = 0
        for msg in reversed(filtered_messages):
            text = (msg.text or "").lower()

            if not text:
                continue

            # Проверяем совпадение через фильтр
            if match_text(text, filter_config):
                # Ищем какое ключевое слово совпало
                matched_keyword = None
                for kw in include_keywords:
                    if kw in text:
                        matched_keyword = kw
                        break

                # Проверяем, не сохраняли ли мы этот lead уже
                existing_lead = (
                    db.query(Lead)
                    .filter(
                        Lead.task_id == task.id,
                        Lead.source_channel == f"@{source_username}",
                        Lead.source_message_id == msg.id
                    )
                    .first()
                )

                if not existing_lead:
                    # Сохраняем новый lead
                    source_url = f"https://t.me/{source_username}/{msg.id}"
                    clean_text = (msg.text or "").lstrip()[:4000]
                    lead = Lead(
                        task_id=task.id,
                        text=clean_text,
                        source_channel=f"@{source_username}",
                        source_message_id=msg.id,
                        source_url=source_url,
                        matched_keyword=matched_keyword,
                        found_at=datetime.utcnow(),
                        is_read=False
                    )
                    db.add(lead)
                    db.commit()

                    matched_count += 1
                    text_preview = (msg.text or "")[:100].replace("\n", " ")
                    logger.info(f"🎯 НОВЫЙ ЛИД | task={task.id} ({task.name}) | @{source_username} | ключ: '{matched_keyword}' | {text_preview}...")

                    # Отправляем лид пользователю в Telegram
                    await send_lead_to_telegram(task, lead, db)

        # Обновляем last_message_id на максимальный обработанный
        new_last_id = max([msg.id for msg in filtered_messages])
        task_source_state.last_message_id = new_last_id
        task_source_state.updated_at = datetime.utcnow()
        db.commit()

        # Логируем только если найдены совпадения
        if matched_count > 0:
            logger.info(f"🎯 task={task.id} ({task.name}) source=@{source_username} найдено лидов: {matched_count}")

    except Exception as e:
        logger.error(f"[LEAD] task={task.id} ({task.name}) ошибка при резолвинге @{source_username}: {e}")
