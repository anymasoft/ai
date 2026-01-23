"""
JobRadar v0 - Polling-мониторинг каналов (на основе LeadScanner)
"""
import asyncio
import json
import re
import logging
import os
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

# Флаг для подробной диагностики
DEBUG_MESSAGE_DUMP = os.getenv("DEBUG_MESSAGE_DUMP", "false").lower() == "true"

# Глобальный Telegram клиент
telegram_client = None


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
        logger.info(f"    - msg.from_user.id = {getattr(msg.from_user, 'id', 'N/A')}")
        logger.info(f"    - msg.from_user.username = {getattr(msg.from_user, 'username', 'N/A')}")

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


async def build_message_link(channel: Channel, message_id: int) -> str:
    """
    Построить permalink на конкретный пост в канале

    Args:
        channel: Объект Channel из БД
        message_id: ID сообщения в канале

    Returns:
        URL ссылка на пост
        - для публичных каналов: https://t.me/{username}/{message_id}
        - для приватных каналов: https://t.me/c/{internal_id}/{message_id}
    """
    try:
        # Для username (публичные каналы)
        if channel.kind == "username" or channel.username:
            username = channel.username or channel.value
            return f"https://t.me/{username}/{message_id}"

        # Для приватных каналов используем internal_id
        # Internal ID получается из channel_id через битовую операцию
        if channel.channel_id:
            internal_id = channel.channel_id & 0x7FFFFFFF
            return f"https://t.me/c/{internal_id}/{message_id}"

        # Fallback - если ничего не сработало
        logger.warning(f"⚠️ Не удалось построить ссылку на пост - нет username и channel_id")
        return None

    except Exception as e:
        logger.error(f"❌ Ошибка при построении ссылки на пост: {e}")
        return None


async def build_source_link(message, channel: Channel) -> tuple:
    """
    Построить ссылку-источник в каноничном формате JobRadar.

    КАНОНИЧНАЯ ЛОГИКА:
    1. ЕСЛИ message.chat.broadcast == True (КАНАЛ):
       → ссылка на конкретный пост в канале

    2. ЕСЛИ message.chat.broadcast == False (чат/группа/супергруппа):
       - ЕСЛИ message.sender.username есть:
         → ссылка на профиль пользователя (@username)
       - ИНАЧЕ:
         → ссылка на пост в чате

    Args:
        message: Объект сообщения от Telethon
        channel: Объект Channel из БД

    Returns:
        Кортеж (link_text, url, should_create_entity)
        - link_text: текст, который выводится пользователю
        - url: куда ведет ссылка
        - should_create_entity: нужно ли создавать MessageEntityTextUrl
    """
    from telethon.tl.types import MessageEntityTextUrl

    # Определяем тип источника: канал или чат
    # КРИТИЧНО: message.is_channel может быть True и для супергрупп!
    # Правильный способ: проверять message.chat.broadcast
    is_broadcast_channel = bool(message.chat and getattr(message.chat, "broadcast", False))

    # ДИАГНОСТИКА: дамп полей сообщения при включенном DEBUG_MESSAGE_DUMP
    dump_message_for_diagnostics(message, channel, is_broadcast_channel)

    logger.debug(f"🔍 Определение источника: broadcast={is_broadcast_channel}, "
                f"chat_type={getattr(message.chat, 'type', 'unknown')}, "
                f"sender_username={getattr(message.sender, 'username', None) if message.sender else None}")

    if is_broadcast_channel:
        # КАНАЛ: ссылка на конкретный пост
        logger.debug(f"📢 Тип: КАНАЛ")
        link_text = channel.title or (f"@{channel.username}" if channel.username else f"@{channel.value}")
        message_link = await build_message_link(channel, message.id)

        if message_link:
            if DEBUG_MESSAGE_DUMP:
                logger.info(f"📋 РЕЗУЛЬТАТ (КАНАЛ): link_text='{link_text}' | url='{message_link}'")
            return link_text, message_link, True
        else:
            logger.warning(f"⚠️ Не удалось построить ссылку на пост для канала {channel.title}")
            return None, None, False
    else:
        # ЧАТ / ГРУППА / СУПЕРГРУППА
        logger.debug(f"💬 Тип: ЧАТ/ГРУППА")

        # Определяем автора: сначала пробуем sender, потом from_user
        # (в группах message.from_user часто = None, реальный автор в message.sender)
        author = getattr(message, 'sender', None) or getattr(message, 'from_user', None)

        logger.debug(f"   message.sender={type(getattr(message, 'sender', None)).__name__ if getattr(message, 'sender', None) else None}, "
                    f"message.from_user={type(getattr(message, 'from_user', None)).__name__ if getattr(message, 'from_user', None) else None}, "
                    f"author={type(author).__name__ if author else None}")

        # Проверяем: есть ли username у ОТПРАВИТЕЛЯ сообщения
        sender_username = None
        if author and hasattr(author, 'username'):
            sender_username = author.username

        logger.debug(f"   Автор: {sender_username or 'нет username'}")

        if sender_username:
            # Есть username автора → ссылка на профиль
            logger.debug(f"   ✅ Публикуем со ссылкой на профиль @{sender_username}")
            author_username = f"@{sender_username}"
            profile_url = f"https://t.me/{sender_username}"
            if DEBUG_MESSAGE_DUMP:
                logger.info(f"📋 РЕЗУЛЬТАТ: link_text='{author_username}' | url='{profile_url}'")
            return author_username, profile_url, True
        else:
            # Нет username → ссылка на пост в чате
            logger.debug(f"   ⚠️ Нет username, используем ссылку на пост")

            # Построить ссылку на пост
            if channel.channel_id:
                # Для приватных чатов используем internal ID
                internal_id = channel.channel_id & 0x7FFFFFFF
                post_link = f"https://t.me/c/{internal_id}/{message.id}"
            else:
                # Для публичных чатов используем username/title
                chat_identifier = channel.username or channel.value or str(channel.channel_id)
                post_link = f"https://t.me/{chat_identifier}/{message.id}"

            # Текст ссылки (название чата или сам URL)
            link_text = channel.title or (f"@{channel.username}" if channel.username else post_link)
            if DEBUG_MESSAGE_DUMP:
                logger.info(f"📋 РЕЗУЛЬТАТ (FALLBACK): link_text='{link_text}' | url='{post_link}'")
                logger.info(f"   Причина fallback: author.username={sender_username}, channel.channel_id={channel.channel_id}")
            return link_text, post_link, True


async def format_jobradar_post(message, channel: Channel) -> tuple:
    """
    Форматирует пост вакансии в каноничный формат JobRadar.

    Логика выбора ссылки:
    A) ЕСЛИ сообщение из КАНАЛА (message.chat.broadcast == True):
       - Текст вакансии + название канала как кликабельная ссылка на конкретный пост
       - Формат: <текст вакансии>\n\n@channel_name (где ссылка ведёт на пост)

    B) ЕСЛИ сообщение из ЧАТА/ГРУППЫ (message.chat.broadcast == False):
       - Если у АВТОРА есть username: <текст вакансии>\n\n@username (ссылка на профиль)
       - Если username нет: <текст вакансии>\n\nhttps://t.me/chat/POST_ID

    Args:
        message: Объект сообщения от Telethon
        channel: Объект Channel из БД

    Returns:
        Кортеж (publish_text, new_entities) для отправки в telegram_client.send_message
    """
    if not message.text:
        return None, None

    # НЕ копируем message.entities! Вместо этого обработаем текст вручную
    new_entities = []

    # Оригинальный текст вакансии
    original_text = message.text

    # ШАГ 1: найти все конструкции ссылок в тексте
    # Паттерн 1: markdown-ссылки [@username](url)
    markdown_pattern = r'\[@([a-zA-Z0-9_]+)\]\((https?://[^)]+)\)'
    # Паттерн 2: обычные ссылки @username (url)
    plain_pattern = r'@([a-zA-Z0-9_]+)\s*\((https?://[^\)]+)\)'

    # Извлечём все найденные пары (anchor, url) из обоих паттернов
    links_to_embed = []  # [(anchor, url), ...]

    # Ищем markdown-ссылки
    for match in re.finditer(markdown_pattern, original_text):
        username = match.group(1)
        url = match.group(2)
        anchor = f"@{username}"
        links_to_embed.append({
            'anchor': anchor,
            'url': url
        })

    # Ищем обычные ссылки
    for match in re.finditer(plain_pattern, original_text):
        username = match.group(1)
        url = match.group(2)
        anchor = f"@{username}"
        links_to_embed.append({
            'anchor': anchor,
            'url': url
        })

    # ШАГ 2: очистить текст — заменить обе конструкции на "@username"
    # Используем функцию-replace для корректной очистки
    def remove_markdown_url(match):
        username = match.group(1)
        return f"@{username}"

    def remove_plain_url(match):
        username = match.group(1)
        return f"@{username}"

    body_text = re.sub(markdown_pattern, remove_markdown_url, original_text)
    body_text = re.sub(plain_pattern, remove_plain_url, body_text)

    # ПРОВЕРКА: убедимся что URL из ссылок в теле текста удалены
    for link_info in links_to_embed:
        if link_info['url'] in body_text:
            logger.warning(
                f"⚠️ ВНИМАНИЕ: URL '{link_info['url']}' остался в тексте после очистки!"
            )

    # ШАГ 3: в очищенном тексте найти каждый anchor и создать entities
    search_start = 0
    for link_info in links_to_embed:
        anchor = link_info['anchor']
        url = link_info['url']

        # Ищем anchor в body_text начиная с последней найденной позиции
        offset = body_text.find(anchor, search_start)

        if offset != -1:
            # Найдена позиция anchor в очищенном тексте
            from telethon.tl.types import MessageEntityTextUrl

            entity = MessageEntityTextUrl(
                offset=offset,
                length=len(anchor),
                url=url
            )
            new_entities.append(entity)

            # Обновляем стартовую позицию для следующего поиска
            search_start = offset + len(anchor)
        else:
            # Это не должно случиться, но логируем на случай
            logger.warning(
                f"⚠️ Не найдена позиция для anchor '{anchor}' в очищенном тексте. "
                f"Оригинальный текст: {original_text[:100]}..."
            )

    # Вычисляем offset для ссылки-источника (после текста + 2 переноса)
    offset = len(body_text) + 2

    # Получаем ссылку-источник через централизованную функцию
    link_text, link_url, should_create_entity = await build_source_link(message, channel)

    if not link_text or not link_url:
        logger.warning(f"⚠️ Не удалось построить ссылку-источник")
        return body_text, new_entities

    # Строим финальный текст (используем ТОЛЬКО body_text, в котором URL уже удалены)
    publish_text = f"{body_text}\n\n{link_text}"

    # Если нужно создавать entity для ссылки-источника (кликабельность)
    if should_create_entity:
        from telethon.tl.types import MessageEntityTextUrl

        text_url_entity = MessageEntityTextUrl(
            offset=offset,
            length=len(link_text),
            url=link_url
        )
        new_entities.append(text_url_entity)

    return publish_text, new_entities


async def publish_matched_post(message, channel: Channel):
    """
    Публикует найденный пост в целевой канал JobRadar в каноничном формате.

    Формат:
    [оригинальный текст вакансии БЕЗ ИЗМЕНЕНИЙ]

    [кликабельная ссылка на источник - одна строка]

    Логика ссылки:
    - Для канала: название канала → ссылка на конкретный пост
    - Для чата с автором: @username → ссылка на профиль
    - Для чата без автора: прямая ссылка на пост

    Args:
        message: Объект сообщения от Telethon
        channel: Объект Channel из БД
    """
    if not telegram_client or not TARGET_CHANNEL_ID:
        return

    if not message.text:
        logger.debug(f"⏩ Сообщение без текста, пропускаю публикацию")
        return

    try:
        channel_display = await get_channel_display(channel)

        # Форматируем пост в каноничный формат JobRadar
        publish_text, new_entities = await format_jobradar_post(message, channel)

        if not publish_text:
            logger.warning(f"⚠️ Не удалось форматировать пост из {channel_display}")
            return

        # Отправляем сообщение с сохранением форматирования и ссылок
        await telegram_client.send_message(
            TARGET_CHANNEL_ID,
            publish_text,
            formatting_entities=new_entities if new_entities else None,
            link_preview=False  # Отключаем preview для чистого формата
        )

        logger.info(f"📤 Опубликовано вакансия из {channel_display} | message_id={message.id}")

    except Exception as e:
        channel_display = await get_channel_display(channel)
        logger.error(f"❌ Ошибка публикации в JobRadar из {channel_display}: {e}")


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
                    await publish_matched_post(msg, channel)

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
