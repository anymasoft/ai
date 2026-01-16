"""
Telegram Bot на aiogram - версия 2.0
Система генерации видео с монетизацией по пакетам видео (credits model)

АРХИТЕКТУРА:
- Главное меню с 4 кнопками (обычные кнопки Telegram)
- Бесплатный лимит: 3 видео (триал)
- Платные пакеты: 5, 20, 50 видео
- Paywall: строгая проверка баланса перед генерацией
"""

import os
import asyncio
import random
from datetime import datetime
from pathlib import Path
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, StateFilter
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, FSInputFile
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from state import state_manager
from video_engine import video_engine
from payments import create_payment, log_payment, get_payment_status
from db import deduct_video as db_deduct_video, add_video_pack as db_add_video_pack, refund_video as db_refund_video, confirm_payment as db_confirm_payment, get_pending_payments, update_payment_status, update_payment_poll_info

# ========== КОНФИГИ ==========
TEMP_DIR = Path("/tmp/telegram-bot")
TEMP_DIR.mkdir(parents=True, exist_ok=True)

GALLERY_DIR = Path(__file__).parent / "gallery"
GALLERY_DIR.mkdir(parents=True, exist_ok=True)

# Бесплатный лимит видео при регистрации
FREE_TRIAL_VIDEOS = 3

# Настройки polling платежей (anti-spam)
MAX_POLL_ATTEMPTS = 20  # Максимум попыток проверки
TERMINAL_STATUSES = {"succeeded", "canceled", "failed", "expired", "waiting_for_capture"}  # Больше не проверяем

# Тарифы (пакеты видео)
TARIFFS = {
    "starter": {"videos": 5, "price": 490, "label": "Starter"},
    "seller": {"videos": 20, "price": 1490, "label": "Seller"},
    "pro": {"videos": 50, "price": 2990, "label": "Pro"},
}


def get_user_photo_path(user_id: int) -> str:
    """Получить путь к фото пользователя"""
    return str(TEMP_DIR / f"photo_{user_id}.jpg")


def get_user_video_path(user_id: int) -> str:
    """Получить путь к видео пользователя"""
    return str(TEMP_DIR / f"video_{user_id}.mp4")


def cleanup_user_files(user_id: int):
    """Очистить файлы пользователя"""
    for path in [get_user_photo_path(user_id), get_user_video_path(user_id)]:
        if Path(path).exists():
            Path(path).unlink()


def log_event(event_type: str, user_id: int, details: dict = None):
    """Логирование событий бота"""
    extra = f" {details}" if details else ""
    print(f"[TG] [{event_type}] user={user_id}{extra}")


# ========== ГЛАВНОЕ МЕНЮ ==========

def get_main_menu_keyboard():
    """Главное меню с 4 кнопками (обычные кнопки Telegram)"""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🎬 Создать видео"), KeyboardButton(text="💡 Примеры работ")],
            [KeyboardButton(text="💳 Тарифы и оплата"), KeyboardButton(text="💰 Мой баланс")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
    )


def get_generate_menu_keyboard():
    """Меню при создании видео"""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="❌ Отмена")],
        ],
        resize_keyboard=True,
    )


# ========== FSM СОСТОЯНИЯ ==========

class BotStates(StatesGroup):
    """FSM состояния"""
    main_menu = State()
    waiting_photo = State()
    waiting_prompt = State()
    confirm = State()
    generating = State()
    viewing_examples = State()
    viewing_tariffs = State()


# ========== ФУНКЦИИ БАЛАНСА ==========

def get_total_videos(user_state) -> int:
    """Получить общее количество доступных видео"""
    return user_state.free_remaining + user_state.video_balance


def deduct_video(user_state) -> bool:
    """Списать одно видео из БД. Возвращает True если успешно, False если баланс кончился"""
    return db_deduct_video(user_state.telegram_id)


def add_video_pack(user_state, pack_key: str):
    """Добавить пакет видео (при оплате) в БД"""
    if pack_key in TARIFFS:
        videos = TARIFFS[pack_key]["videos"]
        return db_add_video_pack(user_state.telegram_id, pack_key, videos)
    return False


# ========== СОВЕТЫ ДЛЯ ВРЕМЕНИ ОЖИДАНИЯ ==========

def get_waiting_tip() -> str:
    """Случайный совет пока генерируется видео"""
    tips = [
        """⏳ Видео в работе...

Пока готовится, вот совет:
Добавь в описание больше деталей про движение камеры
(например "камера слегка наклоняется вниз") —
видео выглядит профессиональнее 👌""",

        """⏳ Обрабатываю твоё видео...

Знал ли ты? Видео с движением камеры
повышают CTR маркетплейса на 23% 📊

Хочешь лучше? Пиши в описании движения!""",

        """⏳ Видео генерируется...

Совет для следующего раза:
Описания с глаголами действия (вращается, летит, скользит)
дают более динамичное видео 🎬""",

        """⏳ Создаю волшебство...

Факт: видео меньше 10 сек смотрят
на 80% чаще, чем длинные ролики 📱""",

        """⏳ Видео почти готово...

Лайфхак: пиши в описании конкретные
действия вместо просто "красиво" —
результат будет намного лучше ✨""",

        """⏳ Обрабатываю...

Знаешь, что общего у успешных видео маркетплейсов?
Они заканчиваются на кульминации 🎯
Помни об этом при описании!""",

        """⏳ Видео в очереди на рендер...

Совет: Короткие зум'ы и панорамы
держат внимание зрителя намного дольше ☝️""",

        """⏳ Ждём ответа от сервера...

Интересный факт:
Первые 1-2 секунды видео решают всё!
Начни с самого захватывающего момента 🎬""",
    ]
    return random.choice(tips)


# ========== МЕНЮ ТАРИФОВ ==========

def get_tariffs_text() -> str:
    """Текст с описанием тарифов"""
    return f"""💳 ТАРИФНЫЕ ПЛАНЫ

📦 СТАРТ (3 бесплатных видео)
   • Попробовать сервис
   • Без лимитов качества
   • Приватные видео
   👉 Для пробы

📦 STARTER — {TARIFFS['starter']['price']} ₽
   • {TARIFFS['starter']['videos']} видео
   • Приоритет обработки (1-2 минуты)
   • Экспорт в любое разрешение

📦 SELLER — {TARIFFS['seller']['price']} ₽
   • {TARIFFS['seller']['videos']} видео
   • Приоритет максимальный (30 сек)
   • Шаблоны для маркетплейсов
   ⭐ ПОПУЛЯРНО

📦 PRO — {TARIFFS['pro']['price']} ₽
   • {TARIFFS['pro']['videos']} видео
   • Безлимитный приоритет
   • API доступ

Никаких подписок. Видео не сгорают.
Покупаешь один раз — пользуешься пока не закончится."""


def get_purchase_keyboard():
    """Клавиатура для покупки пакетов видео"""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="💳 Купить 5 видео — 490 ₽"), KeyboardButton(text="💳 Купить 20 видео — 1490 ₽")],
            [KeyboardButton(text="💳 Купить 50 видео — 2990 ₽")],
            [KeyboardButton(text="🏠 В меню")],
        ],
        resize_keyboard=True,
    )


# ========== ГЛАВНАЯ ЛОГИКА БОТА ==========

async def setup_bot():
    """Инициализировать и запустить бота"""
    token = os.getenv("TELEGRAM_BOT_TOKEN")

    if not token:
        print("[TELEGRAM-BOT] ⚠️  TELEGRAM_BOT_TOKEN не установлен")
        return None

    bot = Bot(token=token)
    dp = Dispatcher()

    # ========== КОМАНДЫ ==========

    @dp.message(Command("start"))
    async def cmd_start(message: types.Message, state: FSMContext):
        """Команда /start - главное меню"""
        user_id = message.from_user.id
        log_event("user_start", user_id)

        user_state = state_manager.get_state(user_id)
        total_videos = get_total_videos(user_state)

        welcome_text = f"""🎬 Привет! Я помогу тебе создать видео для маркетплейса за 30 секунд.

Просто загрузи картинку и напиши описание — я сгенерирую профессиональное видео.

📊 Осталось видео: {total_videos}
"""

        await message.answer(welcome_text, reply_markup=get_main_menu_keyboard())
        await state.set_state(BotStates.main_menu)

    # ========== ОБРАБОТКА КНОПОК ГЛАВНОГО МЕНЮ ==========

    @dp.message(F.text == "🎬 Создать видео")
    async def btn_create_video(message: types.Message, state: FSMContext):
        """Кнопка: Создать видео"""
        user_id = message.from_user.id
        user_state = state_manager.get_state(user_id)

        log_event("create_video_click", user_id)

        # 🚨 PAYWALL: Проверяем баланс
        if get_total_videos(user_state) <= 0:
            log_event("paywall_triggered", user_id)

            paywall_text = """🎁 Поздравляем! Ты уже создал видео!

Значит, они тебе нравятся и ты знаешь, что получается. Отлично!

Теперь выбери тариф:"""

            await message.answer(paywall_text)
            await message.answer(get_tariffs_text())
            await state.set_state(BotStates.main_menu)
            return

        # Просим фото
        await message.answer(
            "📸 Загрузи картинку (JPEG или PNG):",
            reply_markup=get_generate_menu_keyboard(),
        )
        state_manager.set_state(user_id, step="waiting_photo")
        await state.set_state(BotStates.waiting_photo)

    @dp.message(F.text == "💡 Примеры работ")
    async def btn_examples(message: types.Message, state: FSMContext):
        """Кнопка: Примеры работ"""
        user_id = message.from_user.id
        log_event("examples_click", user_id)

        # Получаем список mp4 из gallery
        gallery_files = list(GALLERY_DIR.glob("*.mp4"))

        if not gallery_files:
            await message.answer(
                "😢 Примеров ещё нет.\n\nПокупай тариф и создай своё видео!",
                reply_markup=get_main_menu_keyboard(),
            )
            return

        # Выбираем случайное видео
        random_video = random.choice(gallery_files)
        user_state = state_manager.get_state(user_id)

        # Добавляем в seen_examples чтобы не повторять в этой сессии
        user_state.seen_examples.append(str(random_video))

        try:
            video_file = FSInputFile(str(random_video))
            await message.answer_video(
                video_file,
                caption="📹 Вот пример видео, которое может создать бот.\n\nПохоже? Ты тоже сможешь сделать такое же!",
            )

            # Кнопки для примеров
            if len(gallery_files) > 1:
                buttons = ReplyKeyboardMarkup(
                    keyboard=[
                        [KeyboardButton(text="💡 Ещё пример")],
                        [KeyboardButton(text="🎬 Создать своё"), KeyboardButton(text="🏠 В меню")],
                    ],
                    resize_keyboard=True,
                )
            else:
                buttons = ReplyKeyboardMarkup(
                    keyboard=[
                        [KeyboardButton(text="🎬 Создать своё"), KeyboardButton(text="🏠 В меню")],
                    ],
                    resize_keyboard=True,
                )

            await message.answer("Хочешь ещё?", reply_markup=buttons)
            await state.set_state(BotStates.viewing_examples)

        except Exception as e:
            print(f"[TG] Error sending video: {str(e)}")
            await message.answer(
                "❌ Ошибка при загрузке примера.",
                reply_markup=get_main_menu_keyboard(),
            )

    @dp.message(F.text == "💡 Ещё пример")
    async def btn_more_examples(message: types.Message, state: FSMContext):
        """Кнопка: Ещё пример"""
        user_id = message.from_user.id
        user_state = state_manager.get_state(user_id)

        gallery_files = list(GALLERY_DIR.glob("*.mp4"))

        if not gallery_files:
            await message.answer(
                "😢 Примеров больше нет.",
                reply_markup=get_main_menu_keyboard(),
            )
            return

        # Выбираем видео которое не показывали
        unseen = [f for f in gallery_files if str(f) not in user_state.seen_examples]

        if not unseen:
            await message.answer(
                "✅ Это были все примеры!\n\nЗдорово, да? Теперь твоя очередь!",
                reply_markup=get_main_menu_keyboard(),
            )
            return

        random_video = random.choice(unseen)
        user_state.seen_examples.append(str(random_video))

        try:
            video_file = FSInputFile(str(random_video))
            await message.answer_video(video_file)

            buttons = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text="💡 Ещё пример")],
                    [KeyboardButton(text="🎬 Создать своё"), KeyboardButton(text="🏠 В меню")],
                ],
                resize_keyboard=True,
            )
            await message.answer("Ещё?", reply_markup=buttons)

        except Exception as e:
            print(f"[TG] Error: {str(e)}")

    @dp.message(F.text == "💳 Тарифы и оплата")
    async def btn_tariffs(message: types.Message, state: FSMContext):
        """Кнопка: Тарифы и оплата"""
        user_id = message.from_user.id
        log_event("tariffs_click", user_id)

        await message.answer(get_tariffs_text(), reply_markup=get_purchase_keyboard())
        await state.set_state(BotStates.main_menu)

    @dp.message(F.text == "💰 Мой баланс")
    async def btn_balance(message: types.Message, state: FSMContext):
        """Кнопка: Мой баланс"""
        user_id = message.from_user.id
        user_state = state_manager.get_state(user_id)

        log_event("balance_click", user_id)

        free_left = user_state.free_remaining
        paid = user_state.video_balance
        total = get_total_videos(user_state)

        balance_text = f"""💰 ТВой АККАУНТ

📊 Текущий баланс: {total} видео
   • {free_left} бесплатных
   • {paid} оплачено

💡 Совет: Если ты часто генерируешь видео,
выбери пакет SELLER или PRO — окупится за пару дней!

Готов купить? Нажми "💳 Тарифы и оплата"
"""

        await message.answer(balance_text, reply_markup=get_main_menu_keyboard())
        await state.set_state(BotStates.main_menu)

    # ========== ОБРАБОТКА ФОТО ==========

    @dp.message(F.photo, StateFilter(BotStates.waiting_photo))
    async def msg_photo(message: types.Message, state: FSMContext):
        """Получить фото"""
        user_id = message.from_user.id
        log_event("photo_uploaded", user_id)

        try:
            photo = message.photo[-1]
            file_info = await bot.get_file(photo.file_id)
            photo_path = get_user_photo_path(user_id)

            await bot.download_file(file_info.file_path, destination=photo_path)

            state_manager.set_state(
                user_id,
                step="waiting_prompt",
                photo_file_id=photo.file_id,
                photo_path=photo_path,
            )

            await message.answer(
                "✅ Картинка загружена!\n\n📝 Теперь напиши, что должно происходить на видео (на русском).\n\nПримеры:\n• Красивый закат над горами\n• Кот прыгает по подушкам\n• Движение камеры вверх над городом"
            )

            await state.set_state(BotStates.waiting_prompt)

        except Exception as e:
            print(f"[TG] Photo error: {str(e)}")
            await message.answer("❌ Ошибка при загрузке. Попробуй ещё раз.")

    # ========== ОБРАБОТКА ТЕКСТА ПРОМПТА ==========

    @dp.message(F.text, StateFilter(BotStates.waiting_prompt))
    async def msg_prompt(message: types.Message, state: FSMContext):
        """Получить промпт"""
        user_id = message.from_user.id
        text = message.text

        log_event("prompt_received", user_id, {"length": len(text)})

        if len(text) < 3:
            await message.answer("❌ Описание слишком короткое.")
            return

        if len(text) > 2000:
            await message.answer("❌ Описание слишком длинное (максимум 2000).")
            return

        state_manager.set_state(user_id, step="confirm", prompt_text=text)

        summary_text = f"""📋 Резюме:

📸 Фото: ✅
📝 Описание: {text}
⏱️ Длительность: 6 секунд

Всё верно?"""

        buttons = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text="✅ Сгенерировать")],
                [KeyboardButton(text="✏️ Изменить текст"), KeyboardButton(text="📸 Другое фото")],
                [KeyboardButton(text="❌ Отмена")],
            ],
            resize_keyboard=True,
        )

        await message.answer(summary_text, reply_markup=buttons)
        await state.set_state(BotStates.confirm)

    # ========== ОБРАБОТКА ПОДТВЕРЖДЕНИЯ ==========

    @dp.message(F.text == "✅ Сгенерировать")
    async def btn_generate(message: types.Message, state: FSMContext):
        """Кнопка: Сгенерировать"""
        user_id = message.from_user.id
        user_state = state_manager.get_state(user_id)

        log_event("generate_click", user_id)

        # 🚨 ФИНАЛЬНАЯ ПРОВЕРКА БАЛАНСА
        if not deduct_video(user_state):
            log_event("paywall_final", user_id)
            await message.answer(
                "🎁 Баланс закончился!\n\nКупи видео и продолжай:",
                reply_markup=get_main_menu_keyboard(),
            )
            await message.answer(get_tariffs_text())
            await state.set_state(BotStates.main_menu)
            return

        # Начинаем генерацию
        try:
            state_manager.set_state(user_id, step="generating")

            # Показываем один из советов на время ожидания
            await message.answer(
                get_waiting_tip(),
                reply_markup=None,
            )

            # Запускаем видео-генерацию
            generate_response = await video_engine.generate_video(
                user_id,
                user_state.photo_path,
                user_state.prompt_text,
                duration=6,
            )

            if not generate_response.get("success"):
                log_event("generation_error", user_id)
                await message.answer(
                    f"❌ Ошибка: {generate_response.get('message')}",
                    reply_markup=get_main_menu_keyboard(),
                )
                # Возвращаем видео в БД если ошибка при инициализации
                db_refund_video(user_id)
                await state.set_state(BotStates.main_menu)
                return

            generation_id = generate_response.get("generation_id")

            # Ждём готовности (callback будет обновлять статус)
            max_wait = 600  # 10 минут
            check_interval = 2
            elapsed = 0

            while elapsed < max_wait:
                status_info = video_engine.get_generation_status(generation_id)
                status = status_info.get("status")

                if status == "done":
                    video_path = video_engine.get_generation_video_path(generation_id)

                    if video_path and Path(video_path).exists():
                        log_event("generation_complete", user_id)

                        try:
                            video_file = FSInputFile(video_path)
                            await message.answer_video(
                                video_file,
                                caption=f"🎬 Готово!\n\nОсталось видео: {get_total_videos(user_state)}",
                            )
                        except Exception as e:
                            print(f"[TG] Video send error: {str(e)}")

                        total_left = get_total_videos(user_state)
                        if total_left > 0:
                            await message.answer(
                                f"✅ Видео готово!\n\nОсталось: {total_left} видео\n\nХочешь создать ещё?",
                                reply_markup=get_main_menu_keyboard(),
                            )
                        else:
                            await message.answer(
                                "✅ Видео готово!\n\n🎁 Но баланс кончился. Купи ещё видео!",
                                reply_markup=get_main_menu_keyboard(),
                            )

                        cleanup_user_files(user_id)
                        state_manager.reset_state(user_id)
                        await state.set_state(BotStates.main_menu)
                        return

                    else:
                        raise Exception("Video file not found")

                if status == "failed":
                    error = status_info.get("error", "Unknown")
                    log_event("generation_failed", user_id, {"error": error})
                    await message.answer(
                        f"❌ Ошибка при генерации: {error}",
                        reply_markup=get_main_menu_keyboard(),
                    )
                    # Возвращаем видео в БД при ошибке генерации
                    db_refund_video(user_id)
                    cleanup_user_files(user_id)
                    state_manager.reset_state(user_id)
                    await state.set_state(BotStates.main_menu)
                    return

                await asyncio.sleep(check_interval)
                elapsed += check_interval

            # Timeout
            await message.answer(
                "⏰ Время ожидания истекло (10 минут).\n\nПопробуй позже или свяжись с поддержкой.",
                reply_markup=get_main_menu_keyboard(),
            )
            # Возвращаем видео при timeout
            db_refund_video(user_id)

        except Exception as e:
            print(f"[TG] Generate error: {str(e)}")
            await message.answer(
                f"❌ Ошибка: {str(e)}",
                reply_markup=get_main_menu_keyboard(),
            )
            # Возвращаем видео при exception
            db_refund_video(user_id)

        cleanup_user_files(user_id)
        state_manager.reset_state(user_id)
        await state.set_state(BotStates.main_menu)

    # ========== КНОПКИ РЕДАКТИРОВАНИЯ ==========

    @dp.message(F.text == "✏️ Изменить текст")
    async def btn_edit_prompt(message: types.Message, state: FSMContext):
        """Кнопка: Изменить текст"""
        user_id = message.from_user.id
        log_event("edit_prompt", user_id)

        await message.answer("📝 Напиши новое описание:")
        await state.set_state(BotStates.waiting_prompt)

    @dp.message(F.text == "📸 Другое фото")
    async def btn_replace_photo(message: types.Message, state: FSMContext):
        """Кнопка: Другое фото"""
        user_id = message.from_user.id
        log_event("replace_photo", user_id)

        cleanup_user_files(user_id)
        await message.answer("📸 Загрузи новую картинку:")
        await state.set_state(BotStates.waiting_photo)

    @dp.message(F.text == "🎬 Создать своё")
    async def btn_create_from_examples(message: types.Message, state: FSMContext):
        """Кнопка: Создать своё (из примеров)"""
        await btn_create_video(message, state)

    # ========== ОБРАБОТЧИКИ ПОКУПКИ ==========

    @dp.message(F.text == "💳 Купить 5 видео — 490 ₽")
    async def btn_buy_starter(message: types.Message, state: FSMContext):
        """Кнопка: Купить 5 видео"""
        user_id = message.from_user.id
        log_event("purchase_click", user_id, {"pack": "starter"})

        payment = create_payment(user_id, "starter")

        if not payment:
            await message.answer(
                "❌ Ошибка при создании платежа. Попробуй позже.",
                reply_markup=get_purchase_keyboard(),
            )
            return

        payment_id = payment["payment_id"]
        confirmation_url = payment["confirmation_url"]

        # Сохраняем payment_id в состояние пользователя для polling
        user_state = state_manager.get_state(user_id)
        user_state.pending_payment_id = payment_id
        user_state.pending_payment_timestamp = datetime.now()
        print(f"[TG] Payment {payment_id} saved to state for polling (user {user_id})")

        await message.answer(
            f"""✅ Платёж создан!

💳 Перейдите по ссылке для оплаты:
{confirmation_url}

Мы автоматически проверим статус оплаты.
После успешной оплаты вам будет начислено 5 видео.

Payment ID: {payment_id}
""",
            reply_markup=get_main_menu_keyboard(),
        )

        log_payment("INFO", f"User {user_id} initiated purchase for starter pack", {"payment_id": payment_id})
        await state.set_state(BotStates.main_menu)

    @dp.message(F.text == "💳 Купить 20 видео — 1490 ₽")
    async def btn_buy_seller(message: types.Message, state: FSMContext):
        """Кнопка: Купить 20 видео"""
        user_id = message.from_user.id
        log_event("purchase_click", user_id, {"pack": "seller"})

        payment = create_payment(user_id, "seller")

        if not payment:
            await message.answer(
                "❌ Ошибка при создании платежа. Попробуй позже.",
                reply_markup=get_purchase_keyboard(),
            )
            return

        payment_id = payment["payment_id"]
        confirmation_url = payment["confirmation_url"]

        # Сохраняем payment_id в состояние пользователя для polling
        user_state = state_manager.get_state(user_id)
        user_state.pending_payment_id = payment_id
        user_state.pending_payment_timestamp = datetime.now()
        print(f"[TG] Payment {payment_id} saved to state for polling (user {user_id})")

        await message.answer(
            f"""✅ Платёж создан!

💳 Перейдите по ссылке для оплаты:
{confirmation_url}

Мы автоматически проверим статус оплаты.
После успешной оплаты вам будет начислено 20 видео.

Payment ID: {payment_id}
""",
            reply_markup=get_main_menu_keyboard(),
        )

        log_payment("INFO", f"User {user_id} initiated purchase for seller pack", {"payment_id": payment_id})
        await state.set_state(BotStates.main_menu)

    @dp.message(F.text == "💳 Купить 50 видео — 2990 ₽")
    async def btn_buy_pro(message: types.Message, state: FSMContext):
        """Кнопка: Купить 50 видео"""
        user_id = message.from_user.id
        log_event("purchase_click", user_id, {"pack": "pro"})

        payment = create_payment(user_id, "pro")

        if not payment:
            await message.answer(
                "❌ Ошибка при создании платежа. Попробуй позже.",
                reply_markup=get_purchase_keyboard(),
            )
            return

        payment_id = payment["payment_id"]
        confirmation_url = payment["confirmation_url"]

        # Сохраняем payment_id в состояние пользователя для polling
        user_state = state_manager.get_state(user_id)
        user_state.pending_payment_id = payment_id
        user_state.pending_payment_timestamp = datetime.now()
        print(f"[TG] Payment {payment_id} saved to state for polling (user {user_id})")

        await message.answer(
            f"""✅ Платёж создан!

💳 Перейдите по ссылке для оплаты:
{confirmation_url}

Мы автоматически проверим статус оплаты.
После успешной оплаты вам будет начислено 50 видео.

Payment ID: {payment_id}
""",
            reply_markup=get_main_menu_keyboard(),
        )

        log_payment("INFO", f"User {user_id} initiated purchase for pro pack", {"payment_id": payment_id})
        await state.set_state(BotStates.main_menu)

    @dp.message(F.text == "🏠 В меню")
    async def btn_to_menu(message: types.Message, state: FSMContext):
        """Кнопка: В меню"""
        user_id = message.from_user.id
        user_state = state_manager.get_state(user_id)
        total = get_total_videos(user_state)

        await message.answer(
            f"📊 Баланс: {total} видео",
            reply_markup=get_main_menu_keyboard(),
        )
        await state.set_state(BotStates.main_menu)

    @dp.message(F.text == "❌ Отмена")
    async def btn_cancel(message: types.Message, state: FSMContext):
        """Кнопка: Отмена"""
        user_id = message.from_user.id
        log_event("cancelled", user_id)

        cleanup_user_files(user_id)
        state_manager.reset_state(user_id)

        await message.answer(
            "❌ Отменено. Вернёмся в меню?",
            reply_markup=get_main_menu_keyboard(),
        )
        await state.set_state(BotStates.main_menu)

    return bot, dp


# ========== ПРОВЕРКА ПЛАТЕЖЕЙ (POLLING) ==========

async def check_pending_payments(bot: Bot):
    """
    Фоновая задача для проверки статуса платежей (polling вместо webhook)

    ANTI-SPAM АРХИТЕКТУРА:
    - Terminal статусы (succeeded/canceled/failed/expired/waiting_for_capture) → больше не проверяем
    - Max 20 попыток → abandoned
    - Exponential backoff → снижаем нагрузку
    - Логи только при смене статуса → нет спама
    """
    from datetime import timedelta

    print("[PAYMENTS-POLL] ✅ Payment polling task started")

    # Для экспоненциального backoff
    def get_next_delay(attempts: int) -> int:
        """Exponential backoff: 5s → 10s → 30s → 60s → max 300s"""
        if attempts == 0:
            return 5
        elif attempts == 1:
            return 10
        elif attempts <= 3:
            return 30
        elif attempts <= 6:
            return 60
        else:
            return min(300, 60 * (2 ** (attempts - 6)))

    while True:
        try:
            await asyncio.sleep(5)  # Базовый интервал

            pending_payments = get_pending_payments()

            for payment in pending_payments:
                payment_id = payment["payment_id"]
                user_id = payment["telegram_id"]
                videos_count = payment["videos_count"]
                created_at = payment["created_at"]
                poll_attempts = payment.get("poll_attempts", 0)
                last_status = payment.get("last_status")

                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)

                elapsed = datetime.now() - created_at

                # A. MAX ATTEMPTS: abandoned после 20 попыток
                if poll_attempts >= MAX_POLL_ATTEMPTS:
                    print(f"[PAYMENTS] Payment {payment_id} abandoned after {MAX_POLL_ATTEMPTS} checks")
                    update_payment_status(payment_id, "abandoned")
                    continue

                # B. BACKOFF: пропускаем если ещё рано проверять
                if poll_attempts > 0:
                    required_delay = get_next_delay(poll_attempts - 1)
                    last_poll = payment.get("last_poll_at")
                    if last_poll:
                        if isinstance(last_poll, str):
                            last_poll = datetime.fromisoformat(last_poll)
                        time_since_last_poll = (datetime.now() - last_poll).total_seconds()
                        if time_since_last_poll < required_delay:
                            continue  # Ещё рано

                # Проверяем статус в YooKassa API
                result = get_payment_status(payment_id)

                if not result:
                    # Не удалось получить статус
                    if elapsed > timedelta(minutes=30):
                        print(f"[PAYMENTS] Payment {payment_id} expired (no API response after 30 min)")
                        update_payment_status(payment_id, "expired")
                    else:
                        # Увеличиваем счётчик попыток
                        update_payment_poll_info(payment_id, poll_attempts + 1, last_status or "unknown")
                    continue

                payment_status = result.get("status")

                # C. ANTI-SPAM: логируем ТОЛЬКО при смене статуса
                if payment_status != last_status:
                    print(f"[PAYMENTS] Payment {payment_id} status changed: {last_status} → {payment_status}")

                # D. TERMINAL СТАТУСЫ: обработка и удаление из pending
                if payment_status == "succeeded":
                    print(f"[PAYMENTS] Payment {payment_id} SUCCEEDED - confirming")
                    db_result = db_confirm_payment(payment_id)
                    if db_result:
                        try:
                            await bot.send_message(
                                user_id,
                                f"""✅ ПЛАТЁЖ УСПЕШЕН!

🎁 Вам зачислено {videos_count} видео.

Теперь можете создавать видео!
""",
                                reply_markup=get_main_menu_keyboard()
                            )
                        except:
                            pass

                        if user_id in state_manager.states:
                            state = state_manager.states[user_id]
                            state.pending_payment_id = None
                            state.pending_payment_timestamp = None

                elif payment_status == "canceled" or payment_status == "failed":
                    print(f"[PAYMENTS] Payment {payment_id} {payment_status.upper()} - marking terminal")
                    update_payment_status(payment_id, payment_status)

                    try:
                        await bot.send_message(
                            user_id,
                            f"""❌ Платёж отменён или ошибка.

Попробуй ещё раз или свяжись с поддержкой.""",
                            reply_markup=get_main_menu_keyboard()
                        )
                    except:
                        pass

                    if user_id in state_manager.states:
                        state = state_manager.states[user_id]
                        state.pending_payment_id = None
                        state.pending_payment_timestamp = None

                elif payment_status == "waiting_for_capture":
                    # E. WAITING_FOR_CAPTURE: terminal (не подтверждаем автоматически)
                    if last_status != "waiting_for_capture":
                        print(f"[PAYMENTS] Payment {payment_id} in waiting_for_capture (requires manual capture)")
                    update_payment_status(payment_id, "waiting_for_capture")

                else:
                    # Статус pending или другой - продолжаем проверять
                    # Обновляем счётчик попыток
                    update_payment_poll_info(payment_id, poll_attempts + 1, payment_status)

        except Exception as e:
            print(f"[PAYMENTS-POLL] Error: {str(e)}")
            import traceback
            traceback.print_exc()


async def run_bot():
    """Запустить бота"""
    result = await setup_bot()
    if not result:
        return

    bot, dp = result
    print("[TELEGRAM-BOT] ✅ Bot initialized, starting polling...")

    # Запускаем фоновую задачу проверки платежей
    payment_check_task = asyncio.create_task(check_pending_payments(bot))

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    except Exception as e:
        print(f"[TELEGRAM-BOT] Error: {str(e)}")
    finally:
        payment_check_task.cancel()
        await bot.session.close()
