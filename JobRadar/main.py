"""
JobRadar v0 - Telegram бот с управлением каналами и ключевыми словами
"""
import asyncio
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes
)
from sqlalchemy.orm import Session

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_ID, TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE
from database import init_db, get_db
from models import Channel, Keyword
from monitor import init_telegram_client, close_telegram_client, start_polling_monitoring

# Логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Контекст для хранения состояния
USER_CONTEXT = {}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Команда /start - главное меню"""
    if update.effective_user.id != TELEGRAM_ADMIN_ID:
        await update.message.reply_text("❌ У вас нет доступа")
        return

    await show_main_menu(update, context)


async def show_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать главное меню с inline-кнопками"""
    keyboard = [
        [InlineKeyboardButton("📡 Источники", callback_data="menu_channels")],
        [InlineKeyboardButton("🔑 Ключевые слова", callback_data="menu_keywords")],
        [InlineKeyboardButton("📢 Статус", callback_data="menu_status")],
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)

    if update.message:
        await update.message.reply_text(
            "🤖 JobRadar v0 - Мониторинг каналов\n\nВыберите действие:",
            reply_markup=reply_markup
        )
    else:
        await update.callback_query.edit_message_text(
            "🤖 JobRadar v0 - Мониторинг каналов\n\nВыберите действие:",
            reply_markup=reply_markup
        )


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработка inline-кнопок"""
    query = update.callback_query
    await query.answer()

    data = query.data

    if data == "menu_channels":
        await show_channels_menu(query, context)
    elif data == "menu_keywords":
        await show_keywords_menu(query, context)
    elif data == "menu_status":
        await show_status(query, context)
    elif data == "add_channel":
        await start_add_channel(query, context)
    elif data == "list_channels":
        await list_channels(query, context)
    elif data.startswith("toggle_channel_"):
        channel_id = int(data.split("_")[-1])
        await toggle_channel(query, context, channel_id)
    elif data == "add_keyword":
        await start_add_keyword(query, context)
    elif data == "list_keywords":
        await list_keywords(query, context)
    elif data.startswith("delete_keyword_"):
        keyword_id = int(data.split("_")[-1])
        await delete_keyword(query, context, keyword_id)
    elif data == "back_main":
        await show_main_menu(query, context)
    elif data == "back_channels":
        await show_channels_menu(query, context)
    elif data == "back_keywords":
        await show_keywords_menu(query, context)


async def show_channels_menu(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Меню управления каналами"""
    keyboard = [
        [InlineKeyboardButton("➕ Добавить канал", callback_data="add_channel")],
        [InlineKeyboardButton("📋 Показать список", callback_data="list_channels")],
        [InlineKeyboardButton("⬅️ Назад", callback_data="back_main")],
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(
        "📡 Управление источниками (каналами):\n\nВыберите действие:",
        reply_markup=reply_markup
    )


async def show_keywords_menu(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Меню управления ключевыми словами"""
    keyboard = [
        [InlineKeyboardButton("➕ Добавить слово/фразу", callback_data="add_keyword")],
        [InlineKeyboardButton("📋 Показать список", callback_data="list_keywords")],
        [InlineKeyboardButton("⬅️ Назад", callback_data="back_main")],
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(
        "🔑 Управление ключевыми словами:\n\nВыберите действие:",
        reply_markup=reply_markup
    )


async def show_status(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать статус мониторинга"""
    db = get_db()

    channels_count = db.query(Channel).filter(Channel.enabled == True).count()
    keywords_count = db.query(Keyword).filter(Keyword.enabled == True).count()

    # Получаем последний обработанный пост
    last_channel = db.query(Channel).filter(Channel.last_message_id > 0).order_by(
        Channel.id.desc()
    ).first()

    status_text = f"""📢 СТАТУС МОНИТОРИНГА

📡 Активные каналы: {channels_count}
🔑 Активные ключевые слова: {keywords_count}
⏰ Последний обработанный пост: {'Нет' if not last_channel else 'ID ' + str(last_channel.last_message_id)}

🟢 Мониторинг: АКТИВЕН (polling каждые 10 сек)
"""

    keyboard = [
        [InlineKeyboardButton("⬅️ Назад", callback_data="back_main")],
    ]

    db.close()
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(status_text, reply_markup=reply_markup)


async def start_add_channel(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Начать добавление канала"""
    user_id = query.from_user.id
    USER_CONTEXT[user_id] = {"action": "waiting_channel"}

    keyboard = [[InlineKeyboardButton("❌ Отмена", callback_data="back_channels")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        "📡 Введите имя канала (например: @username или https://t.me/username)",
        reply_markup=reply_markup
    )


async def list_channels(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Список всех каналов"""
    db = get_db()
    channels = db.query(Channel).all()

    if not channels:
        text = "📡 Каналы не добавлены"
        keyboard = [[InlineKeyboardButton("⬅️ Назад", callback_data="back_channels")]]
    else:
        text = "📡 Список каналов:\n\n"
        for ch in channels:
            status = "🟢" if ch.enabled else "🔴"
            text += f"{status} @{ch.username}\n"

        # Клавиатура со ссылками на включение/отключение
        keyboard = []
        for ch in channels:
            text_btn = f"{'✅' if ch.enabled else '❌'} @{ch.username}"
            keyboard.append([InlineKeyboardButton(text_btn, callback_data=f"toggle_channel_{ch.id}")])

        keyboard.append([InlineKeyboardButton("⬅️ Назад", callback_data="back_channels")])

    db.close()
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def toggle_channel(query, context: ContextTypes.DEFAULT_TYPE, channel_id: int) -> None:
    """Включить/отключить канал"""
    db = get_db()
    channel = db.query(Channel).filter(Channel.id == channel_id).first()

    if channel:
        channel.enabled = not channel.enabled
        db.commit()
        status = "✅ включен" if channel.enabled else "❌ отключен"
        await query.answer(f"Канал @{channel.username} {status}", show_alert=True)

    db.close()
    await list_channels(query, context)


async def start_add_keyword(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Начать добавление ключевого слова"""
    user_id = query.from_user.id
    USER_CONTEXT[user_id] = {"action": "waiting_keyword"}

    keyboard = [[InlineKeyboardButton("❌ Отмена", callback_data="back_keywords")]]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text(
        "🔑 Введите ключевое слово или фразу (например: Python, Data Science, Senior Developer):",
        reply_markup=reply_markup
    )


async def list_keywords(query, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Список всех ключевых слов"""
    db = get_db()
    keywords = db.query(Keyword).all()

    if not keywords:
        text = "🔑 Ключевые слова не добавлены"
        keyboard = [[InlineKeyboardButton("⬅️ Назад", callback_data="back_keywords")]]
    else:
        text = "🔑 Список ключевых слов:\n\n"
        for kw in keywords:
            status = "🟢" if kw.enabled else "🔴"
            text += f"{status} {kw.word}\n"

        # Клавиатура со ссылками на удаление
        keyboard = []
        for kw in keywords:
            keyboard.append([InlineKeyboardButton(f"🗑 {kw.word}", callback_data=f"delete_keyword_{kw.id}")])

        keyboard.append([InlineKeyboardButton("⬅️ Назад", callback_data="back_keywords")])

    db.close()
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup)


async def delete_keyword(query, context: ContextTypes.DEFAULT_TYPE, keyword_id: int) -> None:
    """Удалить ключевое слово"""
    db = get_db()
    keyword = db.query(Keyword).filter(Keyword.id == keyword_id).first()

    if keyword:
        word = keyword.word
        db.delete(keyword)
        db.commit()
        await query.answer(f"✅ Ключевое слово '{word}' удалено", show_alert=True)

    db.close()
    await list_keywords(query, context)


async def handle_text_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обработка текстового ввода пользователя"""
    user_id = update.effective_user.id

    if user_id not in USER_CONTEXT:
        return

    action = USER_CONTEXT[user_id].get("action")
    text = update.message.text.strip()

    if action == "waiting_channel":
        # Очищаем от @ и https://t.me/
        channel_name = text.replace("@", "").replace("https://t.me/", "").split("/")[0]

        db = get_db()

        # Проверяем, не существует ли уже
        existing = db.query(Channel).filter(Channel.username == channel_name).first()
        if existing:
            await update.message.reply_text(f"⚠️ Канал @{channel_name} уже добавлен")
            db.close()
            return

        # Добавляем новый канал
        new_channel = Channel(username=channel_name, enabled=True)
        db.add(new_channel)
        db.commit()
        db.close()

        await update.message.reply_text(f"✅ Канал @{channel_name} добавлен в мониторинг")

        # Возвращаемся в меню
        del USER_CONTEXT[user_id]
        await show_channels_menu(update, context)

    elif action == "waiting_keyword":
        db = get_db()

        # Проверяем, не существует ли уже
        existing = db.query(Keyword).filter(Keyword.word.ilike(text)).first()
        if existing:
            await update.message.reply_text(f"⚠️ Ключевое слово '{text}' уже добавлено")
            db.close()
            return

        # Добавляем новое ключевое слово
        new_keyword = Keyword(word=text, enabled=True)
        db.add(new_keyword)
        db.commit()
        db.close()

        await update.message.reply_text(f"✅ Ключевое слово '{text}' добавлено")

        # Возвращаемся в меню
        del USER_CONTEXT[user_id]
        await show_keywords_menu(update, context)


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

    # Обработчик inline-кнопок
    app.add_handler(CallbackQueryHandler(button_callback))

    # Обработчик текстовых сообщений
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_input))

    # Запускаем polling-мониторинг каналов в фоне
    scheduler = start_polling_monitoring()

    # Инициализируем и запускаем бота в существующем event loop
    await app.initialize()
    await app.start()

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
