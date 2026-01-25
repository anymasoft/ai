"""
JobRadar v0 - Telegram бот с управлением каналами и ключевыми словами
"""
import asyncio
import logging
from telegram import (
    Update,
    ReplyKeyboardMarkup,
    KeyboardButton
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes
)
from sqlalchemy.orm import Session

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_ID, TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE
from database import init_db, get_db
from models import Channel, Keyword
from monitor import init_telegram_client, close_telegram_client, monitoring_loop, normalize_channel_ref
from backfill import backfill_one_post

# Логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Подавляем логи сторонних библиотек
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("telegram").setLevel(logging.WARNING)
logging.getLogger("telegram.ext").setLevel(logging.WARNING)
logging.getLogger("telethon").setLevel(logging.WARNING)

# Контекст для хранения состояния
USER_CONTEXT = {}

# Глобальный флаг мониторинга
monitoring_enabled = False


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Команда /start - главное меню"""
    if update.effective_user.id != TELEGRAM_ADMIN_ID:
        await update.message.reply_text("❌ У вас нет доступа")
        return

    logger.info(f"🤖 /start получена от пользователя {update.effective_user.id}")
    await show_main_menu(update, context)


async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать главное меню"""
    keyboard = [
        [KeyboardButton("▶️ Начать мониторинг"), KeyboardButton("⏹ Остановить мониторинг")],
        [KeyboardButton("📡 Источники"), KeyboardButton("🔑 Ключевые слова")],
        [KeyboardButton("📊 Статус"), KeyboardButton("📦 Загрузить историю")],
    ]

    reply_markup = ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Выбери действие…"
    )

    if update.message:
        await update.message.reply_text(
            "🤖 JobRadar v0 - Мониторинг каналов\n\nВыберите действие:",
            reply_markup=reply_markup
        )
    else:
        # Если это не сообщение (не должно быть в новой архитектуре)
        await update.message.reply_text(
            "🤖 JobRadar v0 - Мониторинг каналов\n\nВыберите действие:",
            reply_markup=reply_markup
        )


async def start_monitoring(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Включить мониторинг и инициализировать стартовую точку для новых сообщений"""
    global monitoring_enabled
    user_id = update.effective_user.id

    if monitoring_enabled:
        logger.info(f"ℹ️ Мониторинг уже запущен, пользователь {user_id}")
        await update.message.reply_text("ℹ️ Мониторинг уже запущен")
    else:
        monitoring_enabled = True

        # Инициализируем last_message_id для всех активных каналов
        db = get_db()
        channels = db.query(Channel).filter(Channel.enabled == True).all()

        initialized_count = 0
        for channel in channels:
            try:
                from monitor import telegram_client, resolve_channel_entity

                if telegram_client:
                    # Получаем последний message ID для этого канала
                    entity = await resolve_channel_entity(channel)
                    messages = await telegram_client.get_messages(entity, limit=1)

                    if messages:
                        channel.last_message_id = messages[0].id
                        db.commit()
                        initialized_count += 1
                        display = f"@{channel.value}" if channel.kind == "username" else f"id:{channel.value}"
                        logger.info(f"⏺ Зафиксирована стартовая точка мониторинга для {display}: last_message_id={channel.last_message_id}")
            except Exception as e:
                display = f"@{channel.value}" if channel.kind == "username" else f"id:{channel.value}"
                logger.warning(f"⚠️ Не удалось инициализировать стартовую точку для {display}: {e}")

        db.close()

        logger.info(f"▶️ Мониторинг запущен пользователем {user_id} (инициализировано {initialized_count} каналов)")
        await update.message.reply_text(f"▶️ Мониторинг запущен. Инициализировано {initialized_count} каналов. Будут обрабатываться только новые посты, начиная с момента запуска.")

    await show_main_menu(update, context)


async def stop_monitoring(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Выключить мониторинг"""
    global monitoring_enabled
    user_id = update.effective_user.id

    if not monitoring_enabled:
        logger.info(f"ℹ️ Мониторинг уже остановлен, пользователь {user_id}")
        await update.message.reply_text("ℹ️ Мониторинг уже остановлен")
    else:
        monitoring_enabled = False
        logger.info(f"⏹ Мониторинг остановлен пользователем {user_id}")
        await update.message.reply_text("⏹ Мониторинг остановлен")

    await show_main_menu(update, context)


async def show_channels_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Меню управления каналами"""
    user_id = update.effective_user.id
    # Сохраняем контекст меню для правильной обработки "Показать список"
    USER_CONTEXT[user_id] = {"menu_type": "channels"}

    keyboard = [
        [KeyboardButton("➕ Добавить канал")],
        [KeyboardButton("📋 Показать список")],
        [KeyboardButton("🗑 Удалить канал")],
        [KeyboardButton("⬅️ Назад")],
    ]

    reply_markup = ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Выбери действие…"
    )

    await update.message.reply_text(
        "📡 Управление источниками (каналами):\n\nВыберите действие:",
        reply_markup=reply_markup
    )


async def show_keywords_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Меню управления ключевыми словами"""
    user_id = update.effective_user.id
    # Сохраняем контекст меню для правильной обработки "Показать список"
    USER_CONTEXT[user_id] = {"menu_type": "keywords"}

    keyboard = [
        [KeyboardButton("➕ Добавить слово/фразу")],
        [KeyboardButton("📋 Показать список")],
        [KeyboardButton("⬅️ Назад")],
    ]

    reply_markup = ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Выбери действие…"
    )

    await update.message.reply_text(
        "🔑 Управление ключевыми словами:\n\nВыберите действие:",
        reply_markup=reply_markup
    )


async def show_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать статус мониторинга"""
    db = get_db()

    channels_count = db.query(Channel).filter(Channel.enabled == True).count()
    keywords_count = db.query(Keyword).filter(Keyword.enabled == True).count()

    # Получаем последний обработанный пост
    last_channel = db.query(Channel).filter(Channel.last_message_id > 0).order_by(
        Channel.id.desc()
    ).first()

    monitoring_status = "🟢 ВКЛ" if monitoring_enabled else "🔴 ВЫКЛ"

    status_text = f"""📊 Статус JobRadar

Мониторинг: {monitoring_status}
Каналов: {channels_count}
Ключевых слов: {keywords_count}
⏰ Последний обработанный пост: {'Нет' if not last_channel else 'ID ' + str(last_channel.last_message_id)}
"""

    keyboard = [[KeyboardButton("⬅️ Назад")]]
    reply_markup = ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False
    )

    db.close()
    await update.message.reply_text(status_text, reply_markup=reply_markup)


async def start_add_channel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Начать добавление канала"""
    user_id = update.effective_user.id
    USER_CONTEXT[user_id] = {"action": "waiting_channel"}

    logger.info(f"➕ Начинаю добавление канала для пользователя {user_id}")
    await update.message.reply_text(
        "📡 Введите @username или ссылку t.me/username:\n"
        "Примеры:\n"
        "• @OneCHunter\n"
        "• t.me/OneCHunter\n\n"
        "(добавление по ID не поддерживается)"
    )


async def start_delete_channel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Начать удаление канала"""
    user_id = update.effective_user.id
    db = get_db()
    channels = db.query(Channel).all()

    if not channels:
        await update.message.reply_text("📡 Каналы для мониторинга не добавлены")
        db.close()
        return

    # Показываем список каналов с номерами
    enabled_channels = [ch for ch in channels if ch.enabled]
    disabled_channels = [ch for ch in channels if not ch.enabled]

    text = "📡 Выберите номер канала для удаления:\n\n"

    channel_index_map = {}

    # Отображение активных каналов
    for i, ch in enumerate(enabled_channels, 1):
        channel_index_map[i] = ch.id
        if ch.title:
            text += f"{i}. {ch.title}\n"
            if ch.username:
                text += f"   @{ch.username}\n"
        else:
            if ch.kind == "username":
                text += f"{i}. @{ch.value}\n"
            else:
                text += f"{i}. id: {ch.value}\n"
        text += "\n"

    # Отображение отключённых каналов
    if disabled_channels:
        text += "🔴 Отключённые:\n\n"
        for i, ch in enumerate(disabled_channels, 1):
            channel_index_map[len(enabled_channels) + i] = ch.id
            if ch.title:
                text += f"{len(enabled_channels) + i}. {ch.title}\n"
                if ch.username:
                    text += f"   @{ch.username}\n"
            else:
                if ch.kind == "username":
                    text += f"{len(enabled_channels) + i}. @{ch.value}\n"
                else:
                    text += f"{len(enabled_channels) + i}. id: {ch.value}\n"
            text += "\n"

    # Сохраняем mapping в контексте
    USER_CONTEXT[user_id] = {"action": "waiting_delete_channel", "channel_index_map": channel_index_map}

    logger.info(f"🗑 Начинаю удаление канала для пользователя {user_id}")
    await update.message.reply_text(
        text + "Введите номер канала для удаления (например: 1)"
    )

    db.close()


async def list_channels(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Список всех каналов"""
    user_id = update.effective_user.id
    db = get_db()
    channels = db.query(Channel).all()

    logger.info(f"📡 Пользователь {user_id} запросил список каналов")

    # Сохраняем mapping номеров на ID каналов для последующего использования
    channel_index_map = {}

    if not channels:
        text = "📡 Каналы для мониторинга не добавлены"
    else:
        enabled_channels = [ch for ch in channels if ch.enabled]
        disabled_channels = [ch for ch in channels if not ch.enabled]

        text = "📡 Отслеживаемые каналы:\n\n"

        # Отображение активных каналов
        for i, ch in enumerate(enabled_channels, 1):
            channel_index_map[i] = ch.id  # Сохраняем mapping
            if ch.title:
                text += f"{i}. {ch.title}\n"
                if ch.username:
                    text += f"   @{ch.username}\n"
                if ch.channel_id:
                    text += f"   id: {ch.channel_id}\n"
            else:
                # Обратная совместимость - если нет title
                if ch.kind == "username":
                    text += f"{i}. @{ch.value}\n   id: {ch.channel_id if ch.channel_id else 'не получено'}\n"
                else:
                    text += f"{i}. id: {ch.value} (название не получено)\n"
            text += "\n"

        # Отображение отключённых каналов
        if disabled_channels:
            text += "🔴 Отключённые каналы:\n\n"
            for i, ch in enumerate(disabled_channels, 1):
                channel_index_map[len(enabled_channels) + i] = ch.id  # Сохраняем mapping
                if ch.title:
                    text += f"{len(enabled_channels) + i}. {ch.title}\n"
                    if ch.username:
                        text += f"   @{ch.username}\n"
                    if ch.channel_id:
                        text += f"   id: {ch.channel_id}\n"
                else:
                    if ch.kind == "username":
                        text += f"{len(enabled_channels) + i}. @{ch.value}\n   id: {ch.channel_id if ch.channel_id else 'не получено'}\n"
                    else:
                        text += f"{len(enabled_channels) + i}. id: {ch.value} (название не получено)\n"
                text += "\n"

    # Сохраняем mapping в контексте пользователя
    if user_id in USER_CONTEXT:
        USER_CONTEXT[user_id]["channel_index_map"] = channel_index_map
    else:
        USER_CONTEXT[user_id] = {"channel_index_map": channel_index_map}

    keyboard = [[KeyboardButton("⬅️ Назад")]]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    await update.message.reply_text(text, reply_markup=reply_markup)

    db.close()


async def start_add_keyword(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Начать добавление ключевого слова"""
    user_id = update.effective_user.id

    # Сохраняем текущий контекст меню, если существует
    previous_menu = None
    if user_id in USER_CONTEXT:
        previous_menu = USER_CONTEXT[user_id].get("menu_type")

    # Устанавливаем новое состояние ожидания ввода ключевого слова
    USER_CONTEXT[user_id] = {
        "action": "waiting_keyword",
        "menu_type": previous_menu or "keywords"
    }

    logger.info(f"➕ Пользователь {user_id} начал добавление ключевого слова")
    await update.message.reply_text(
        "🔑 Введите ключевое слово или фразу:\n"
        "Примеры: 1С, ERP, УТ, Python, Data Science, Senior Developer"
    )


async def list_keywords(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Список всех ключевых слов"""
    user_id = update.effective_user.id
    db = get_db()
    keywords = db.query(Keyword).all()

    logger.info(f"📋 Пользователь {user_id} запросил список ключевых слов")

    if not keywords:
        text = "🔑 Ключевые слова не добавлены"
    else:
        enabled_keywords = [kw for kw in keywords if kw.enabled]
        disabled_keywords = [kw for kw in keywords if not kw.enabled]

        text = "🔑 Текущие ключевые слова:\n\n"

        if enabled_keywords:
            for i, kw in enumerate(enabled_keywords, 1):
                text += f"• {kw.word}\n"

        if disabled_keywords:
            text += "\n🔴 Отключённые:\n"
            for i, kw in enumerate(disabled_keywords, 1):
                text += f"• {kw.word}\n"

    keyboard = [[KeyboardButton("⬅️ Назад")]]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    await update.message.reply_text(text, reply_markup=reply_markup)

    db.close()


async def delete_channel_by_input(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    """Обработка удаления канала по введённому номеру"""
    user_id = update.effective_user.id

    # Проверяем, что введено число
    try:
        channel_number = int(text.strip())
    except ValueError:
        logger.info(f"❌ Некорректный ввод номера канала пользователем {user_id}: '{text}'")
        await update.message.reply_text("❌ Введите номер канала цифрой")
        return

    # Получаем mapping номеров из контекста
    if user_id not in USER_CONTEXT or "channel_index_map" not in USER_CONTEXT[user_id]:
        logger.warning(f"⚠️ Не найден mapping номеров для пользователя {user_id}")
        await update.message.reply_text("❌ Ошибка: список каналов не найден. Повторите попытку")
        return

    channel_index_map = USER_CONTEXT[user_id]["channel_index_map"]

    # Проверяем, что номер в диапазоне
    if channel_number not in channel_index_map:
        logger.info(f"❌ Номер канала {channel_number} вне диапазона, пользователь {user_id}")
        await update.message.reply_text("❌ Канал с таким номером не найден")
        return

    # Получаем ID канала
    channel_id = channel_index_map[channel_number]

    # Удаляем канал из БД
    db = get_db()
    channel = db.query(Channel).filter(Channel.id == channel_id).first()

    if not channel:
        logger.warning(f"⚠️ Канал с ID {channel_id} не найден в БД, пользователь {user_id}")
        await update.message.reply_text("❌ Канал не найден в базе данных")
        db.close()
        return

    # Сохраняем информацию о канале для логирования
    channel_display = channel.title if channel.title else f"@{channel.value}" if channel.kind == "username" else f"id:{channel.value}"

    # Удаляем канал
    db.delete(channel)
    db.commit()
    db.close()

    logger.info(f"🗑 Пользователь {user_id} удалил канал {channel_id}: {channel_display}")
    await update.message.reply_text(f"🗑 Канал «{channel_display}» удалён из мониторинга")

    # Очищаем контекст и возвращаемся в меню
    del USER_CONTEXT[user_id]
    await show_channels_menu(update, context)


async def handle_text_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработка текстового ввода пользователя"""
    user_id = update.effective_user.id
    text = update.message.text.strip()

    # Обработка reply-кнопок
    if text == "▶️ Начать мониторинг":
        logger.info(f"📥 Получена команда '▶️ Начать мониторинг' от пользователя {user_id}")
        await start_monitoring(update, context)
        return

    if text == "⏹ Остановить мониторинг":
        logger.info(f"📥 Получена команда '⏹ Остановить мониторинг' от пользователя {user_id}")
        await stop_monitoring(update, context)
        return

    if text == "📡 Источники":
        logger.info(f"📥 Получена команда '📡 Источники' от пользователя {user_id}")
        await show_channels_menu(update, context)
        return

    if text == "🔑 Ключевые слова":
        logger.info(f"📥 Получена команда '🔑 Ключевые слова' от пользователя {user_id}")
        await show_keywords_menu(update, context)
        return

    if text == "📊 Статус":
        logger.info(f"📥 Получена команда '📊 Статус' от пользователя {user_id}")
        await show_status(update, context)
        return

    if text == "📦 Загрузить историю":
        logger.info(f"📥 Получена команда '📦 Загрузить историю' от пользователя {user_id}")
        await start_backfill(update, context)
        return

    if text == "⬅️ Назад":
        logger.info(f"📥 Получена команда '⬅️ Назад' от пользователя {user_id}")
        await show_main_menu(update, context)
        return

    if text == "➕ Добавить канал":
        logger.info(f"📥 Получена команда '➕ Добавить канал' от пользователя {user_id}")
        await start_add_channel(update, context)
        return

    if text == "🗑 Удалить канал":
        logger.info(f"📥 Получена команда '🗑 Удалить канал' от пользователя {user_id}")
        await start_delete_channel(update, context)
        return

    if text == "📋 Показать список":
        logger.info(f"📥 Получена команда '📋 Показать список' от пользователя {user_id}")
        # Проверяем контекст меню - какой список показывать
        if user_id in USER_CONTEXT:
            menu_type = USER_CONTEXT[user_id].get("menu_type")
            if menu_type == "keywords":
                await list_keywords(update, context)
                return
            elif menu_type == "channels":
                await list_channels(update, context)
                return
        # Если контекст не установлен, показываем каналы по умолчанию
        await list_channels(update, context)
        return

    if text == "📋 Показать ключевые слова":
        logger.info(f"📥 Получена команда '📋 Показать ключевые слова' от пользователя {user_id}")
        await list_keywords(update, context)
        return

    if text == "➕ Добавить слово/фразу":
        logger.info(f"📥 Получена команда '➕ Добавить слово/фразу' от пользователя {user_id}")
        await start_add_keyword(update, context)
        return

    if text == "➕ Добавить ещё":
        logger.info(f"📥 Получена команда '➕ Добавить ещё' от пользователя {user_id}")
        await start_add_keyword(update, context)
        return

    # Обработка ввода в контексте (добавление канала/ключевого слова)
    if user_id not in USER_CONTEXT:
        return

    action = USER_CONTEXT[user_id].get("action")

    if action == "waiting_channel":
        # Используем нормализацию ввода
        try:
            parsed = normalize_channel_ref(text)
        except ValueError as e:
            await update.message.reply_text(f"❌ {str(e)}")
            return

        kind = parsed["kind"]
        value = parsed["value"]
        display = parsed["display"]

        db = get_db()

        # Проверяем, не существует ли уже (по kind и value)
        existing = db.query(Channel).filter(
            Channel.kind == kind,
            Channel.value == value
        ).first()
        if existing:
            logger.info(f"⚠️ Канал {display} уже существует, пользователь {user_id}")
            await update.message.reply_text(f"⚠️ Канал {display} уже есть в списке")
            db.close()
            return

        # Пытаемся получить информацию о канале через Telethon
        title = None
        channel_id = None
        username = None

        try:
            from monitor import telegram_client, resolve_channel_entity

            if telegram_client:
                entity = await resolve_channel_entity(Channel(kind=kind, value=value))
                # Получаем информацию из entity
                title = entity.title if hasattr(entity, "title") else None
                channel_id = entity.id if hasattr(entity, "id") else None
                username = entity.username if hasattr(entity, "username") else None
                logger.info(f"✅ Получена информация о канале: title={title}, username={username}, id={channel_id}")
        except Exception as e:
            logger.warning(f"⚠️ Не удалось получить информацию о канале {display}: {e}")

        # Добавляем новый канал
        new_channel = Channel(
            kind=kind,
            value=value,
            title=title,
            channel_id=channel_id,
            username=username,
            enabled=True
        )
        db.add(new_channel)
        db.commit()
        db.close()

        logger.info(f"➕ Пользователь {user_id} добавил канал {display}")
        await update.message.reply_text(f"✅ Канал «{display}» добавлен и будет использоваться при мониторинге")

        # Возвращаемся в меню
        del USER_CONTEXT[user_id]
        await show_channels_menu(update, context)

    elif action == "waiting_keyword":
        # Проверяем на пустой ввод
        if not text:
            logger.warning(f"❌ Пустой ввод ключевого слова, пользователь {user_id}")
            await update.message.reply_text("❌ Ключевое слово не может быть пустым")
            return

        # Очищаем текст
        keyword_text = text.strip()

        db = get_db()

        # Проверяем, не существует ли уже
        existing = db.query(Keyword).filter(Keyword.word.ilike(keyword_text)).first()
        if existing:
            logger.info(f"⚠️ Ключевое слово '{keyword_text}' уже существует, пользователь {user_id}")
            await update.message.reply_text(f"⚠️ Ключевое слово «{keyword_text}» уже добавлено")
            db.close()
            return

        # Добавляем новое ключевое слово
        new_keyword = Keyword(word=keyword_text, enabled=True)
        db.add(new_keyword)
        db.commit()
        db.close()

        logger.info(f"➕ Добавлено ключевое слово: '{keyword_text}' пользователем {user_id}")
        await update.message.reply_text(f"✅ Ключевое слово «{keyword_text}» добавлено")

        # Предлагаем кнопки для продолжения
        keyboard = [
            [KeyboardButton("➕ Добавить ещё")],
            [KeyboardButton("📋 Показать ключевые слова")],
            [KeyboardButton("⬅️ Назад")],
        ]

        reply_markup = ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
            input_field_placeholder="Выбери действие…"
        )

        await update.message.reply_text(
            "Хотите добавить ещё ключевое слово?",
            reply_markup=reply_markup
        )

        # Сохраняем состояние меню для правильной обработки кнопок
        menu_type = USER_CONTEXT[user_id].get("menu_type", "keywords")
        USER_CONTEXT[user_id] = {"menu_type": menu_type}

    elif action == "waiting_delete_channel":
        # Обработка удаления канала
        await delete_channel_by_input(update, context, text)

    elif action == "waiting_backfill_channel":
        # Обработка ввода канала для backfill
        await process_backfill_channel(update, context, text)

    elif action == "waiting_backfill_count":
        # Обработка ввода количества сообщений для backfill
        await process_backfill_count(update, context, text)


async def start_backfill(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Начать процесс загрузки истории - запросить канал"""
    user_id = update.effective_user.id
    USER_CONTEXT[user_id] = {"action": "waiting_backfill_channel"}

    keyboard = [
        [KeyboardButton("⬅️ Назад")],
    ]
    reply_markup = ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False
    )

    await update.message.reply_text(
        "📦 Загрузить историю\n\nВведите канал-источник в формате:\n• @channel_name\n• t.me/channel_name",
        reply_markup=reply_markup
    )


async def process_backfill_channel(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    """Обработать ввод канала и спросить количество сообщений"""
    user_id = update.effective_user.id
    text = text.strip()

    # Нормализовать ввод
    try:
        parsed = normalize_channel_ref(text)
    except ValueError as e:
        await update.message.reply_text(f"❌ {str(e)}")
        return

    username = parsed["value"]  # без @

    # Сохранить username в контексте
    USER_CONTEXT[user_id] = {
        "action": "waiting_backfill_count",
        "backfill_username": username
    }

    # Спросить количество сообщений
    keyboard = [
        [KeyboardButton("1"), KeyboardButton("3"), KeyboardButton("5")],
        [KeyboardButton("10"), KeyboardButton("20"), KeyboardButton("⬅️ Назад")],
    ]
    reply_markup = ReplyKeyboardMarkup(
        keyboard,
        resize_keyboard=True,
        one_time_keyboard=False
    )

    await update.message.reply_text(
        f"Канал: @{username}\n\nСколько постов загрузить?",
        reply_markup=reply_markup
    )


async def process_backfill_count(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    """Обработать ввод количества и запустить загрузку"""
    user_id = update.effective_user.id
    text = text.strip()

    # Получить username из контекста
    username = USER_CONTEXT.get(user_id, {}).get("backfill_username")
    if not username:
        await update.message.reply_text("❌ Ошибка: канал не найден")
        await show_main_menu(update, context)
        return

    # Попробовать распарсить количество
    try:
        count = int(text)
        if count <= 0 or count > 100:
            await update.message.reply_text("❌ Укажите число от 1 до 100")
            return
    except ValueError:
        await update.message.reply_text("❌ Укажите числовое значение")
        return

    # Загрузка начинается
    await update.message.reply_text(f"⏳ Загрузка {count} постов из @{username}...")

    db = get_db()

    try:
        result = await backfill_one_post(username, db, count=count)

        if result["status"] == "published":
            await update.message.reply_text(result["message"])
            logger.info(f"📥 Backfill: {result['message']}")
        elif result["status"] == "not_found":
            await update.message.reply_text(result["message"])
            logger.info(f"📥 Backfill: {result['message']}")
        elif result["status"] == "error":
            await update.message.reply_text(result["message"])
            logger.warning(f"📥 Backfill ошибка: {result['message']}")

    except Exception as e:
        logger.error(f"❌ Ошибка backfill: {e}")
        await update.message.reply_text(f"❌ Ошибка: {str(e)}")

    finally:
        db.close()

    # Вернуться в главное меню
    await show_main_menu(update, context)


async def main():
    """Главная функция запуска бота"""
    print("🚀 JobRadar v0 запускается...\n")

    # Инициализация БД
    init_db()

    # Инициализация Telegram User Client для мониторинга
    await init_telegram_client()

    # Создание приложения бота
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Обработчики команд
    app.add_handler(CommandHandler("start", start))

    # Обработчик текстовых сообщений (reply-кнопки и текстовый ввод)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_input))

    # Запускаем polling-мониторинг каналов в фоне
    asyncio.create_task(monitoring_loop())

    # Инициализируем и запускаем бота в существующем event loop
    await app.initialize()
    await app.start()

    # Явно запускаем polling апдейтов (без создания нового event loop)
    await app.updater.start_polling()

    print(f"\n✅ Бот запущен. Admin ID: {TELEGRAM_ADMIN_ID}")
    print("📍 Используй /start для открытия меню\n")

    # Ждём сигнала завершения (процесс остаётся работать)
    await asyncio.Event().wait()


if __name__ == "__main__":
    # Проверка конфигурации
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_API_ID or not TELEGRAM_API_HASH or not TELEGRAM_PHONE:
        print("❌ Ошибка: не установлены переменные окружения")
        print("Установите следующие переменные в .env:")
        print("  - TELEGRAM_BOT_TOKEN")
        print("  - TELEGRAM_API_ID")
        print("  - TELEGRAM_API_HASH")
        print("  - TELEGRAM_PHONE")
        print("  - TELEGRAM_ADMIN_ID")
        exit(1)

    asyncio.run(main())
