"""
Telegram Bot на aiogram
Генерирует видео из фото и текста через Beem API
"""

import os
import asyncio
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, StateFilter
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, FSInputFile
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from pathlib import Path

from state import state_manager, UserState as TGUserState
from api import api_client


# Создаём временную папку для фото и видео
TEMP_DIR = Path("/tmp/telegram-bot")
TEMP_DIR.mkdir(parents=True, exist_ok=True)


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
    print(f"[TELEGRAM-BOT] [{event_type}] user={user_id}{extra}")


class UserStates(StatesGroup):
    """FSM состояния"""

    waiting_photo = State()
    waiting_prompt = State()
    confirm = State()
    generating = State()


async def setup_bot():
    """Инициализировать и запустить бота"""
    token = os.getenv("TELEGRAM_BOT_TOKEN")

    if not token:
        print("[TELEGRAM-BOT] ⚠️  TELEGRAM_BOT_TOKEN не установлен")
        return None

    bot = Bot(token=token)
    dp = Dispatcher()

    # ============ КОМАНДЫ ============

    @dp.message(Command("start"))
    async def cmd_start(message: types.Message, state: FSMContext):
        """Команда /start"""
        user_id = message.from_user.id
        log_event("BOT_START", user_id)

        state_manager.reset_state(user_id)

        welcome_text = """🎬 Добро пожаловать в Beem Video AI!

Я помогу тебе создать видео из фото и описания за несколько минут.

Вот как это работает:
1️⃣ Отправь фото (любое JPEG изображение)
2️⃣ Напиши, что должно происходить на видео
3️⃣ Нажми "Сгенерировать"
4️⃣ Жди готовое видео 🎥

Ограничения:
- Максимум 2000 символов в описании
- Только JPEG фото
- Генерация может занять 1-3 минуты

Начнём? 👇"""

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="📸 Загрузить фото", callback_data="start_photo")]
            ]
        )

        await message.answer(welcome_text, reply_markup=keyboard)
        await state.set_state(UserStates.waiting_photo)

    # ============ CALLBACK QUERIES ============

    @dp.callback_query(F.data == "start_photo")
    async def cb_start_photo(query: types.CallbackQuery, state: FSMContext):
        """Кнопка 'Загрузить фото'"""
        user_id = query.from_user.id
        log_event("BOT_PHOTO_REQUESTED", user_id)

        state_manager.set_state(user_id, step="waiting_photo")

        await query.answer()
        await query.message.answer(
            "📸 Отправь мне фото в формате JPEG (можно сделать скриншот)"
        )
        await state.set_state(UserStates.waiting_photo)

    @dp.callback_query(F.data == "confirm_generate")
    async def cb_confirm_generate(query: types.CallbackQuery, state: FSMContext):
        """Кнопка 'Сгенерировать'"""
        user_id = query.from_user.id
        tg_state = state_manager.get_state(user_id)

        if not tg_state.photo_path or not tg_state.prompt_text:
            await query.answer("❌ Ошибка: данные потеряны", show_alert=True)
            return

        log_event("BOT_GENERATE_CLICK", user_id)

        state_manager.set_state(user_id, step="generating")

        await query.answer()
        processing_msg = await query.message.answer(
            "⏳ Генерирую видео...\n\n(Это может занять 1-3 минуты)\n\n0%"
        )

        try:
            # Запускаем генерацию
            generate_response = await api_client.generate_video(
                user_id, tg_state.photo_path, tg_state.prompt_text, 6
            )

            if not generate_response.get("success"):
                await query.message.edit_text(
                    "❌ Ошибка при запуске генерации"
                )
                state_manager.set_state(user_id, step="confirm")
                return

            generation_id = generate_response.get("generationId")
            state_manager.set_state(
                user_id,
                last_generation_id=generation_id,
                last_generation_status="queued",
            )

            log_event("TG_GENERATE_CREATED", user_id, {"generation_id": generation_id})

            # Начинаем polling
            max_attempts = 120  # 2 минуты с интервалом 1 сек
            for attempt in range(max_attempts):
                try:
                    status_response = await api_client.get_generation_status(
                        generation_id
                    )
                    status = status_response.get("status")

                    state_manager.set_state(user_id, last_generation_status=status)

                    log_event(
                        "TG_STATUS",
                        user_id,
                        {"generation_id": generation_id, "status": status},
                    )

                    # Обновляем прогресс
                    progress = min(100, int(((attempt + 1) / max_attempts) * 100))
                    try:
                        await query.message.edit_text(
                            f"⏳ Генерирую видео...\n\n(Это может занять 1-3 минуты)\n\n{progress}%"
                        )
                    except:
                        pass  # Игнорируем ошибки редактирования

                    # Если видео готово
                    if status == "done" and status_response.get("video_url"):
                        log_event("BOT_DONE", user_id, {"generation_id": generation_id})

                        try:
                            await query.message.edit_text("✅ Видео готово! Скачиваю...")
                        except:
                            pass

                        # Скачиваем видео
                        video_path = get_user_video_path(user_id)
                        await api_client.download_video(
                            status_response.get("video_url"), video_path
                        )

                        # Отправляем видео
                        video_file = FSInputFile(video_path)
                        await query.message.answer_video(
                            video_file,
                            caption="🎬 Вот твоё видео!\n\nХочешь создать ещё одно?",
                        )

                        # Показываем кнопку для новой генерации
                        keyboard = InlineKeyboardMarkup(
                            inline_keyboard=[
                                [
                                    InlineKeyboardButton(
                                        text="📸 Создать новое видео", callback_data="start_photo"
                                    )
                                ]
                            ]
                        )
                        await query.message.answer(
                            "Начнём заново?", reply_markup=keyboard
                        )

                        state_manager.reset_state(user_id)
                        cleanup_user_files(user_id)
                        await state.set_state(UserStates.waiting_photo)
                        return

                    # Если ошибка
                    if status == "failed":
                        log_event("BOT_FAIL", user_id, {"generation_id": generation_id})

                        await query.message.edit_text(
                            "❌ Ошибка при генерации видео. Попробуй ещё раз."
                        )

                        state_manager.reset_state(user_id)
                        cleanup_user_files(user_id)
                        await state.set_state(UserStates.waiting_photo)
                        return

                    # Ждём перед следующей попыткой
                    await asyncio.sleep(1)

                except Exception as e:
                    print(f"[TELEGRAM-BOT] Status check error: {str(e)}")
                    await asyncio.sleep(2)

            # Timeout
            await query.message.edit_text(
                "⏰ Время ожидания истекло. Видео может всё ещё генерироваться.\nПопробуй позже."
            )
            state_manager.reset_state(user_id)
            cleanup_user_files(user_id)

        except Exception as e:
            print(f"[TELEGRAM-BOT] Generate error: {str(e)}")
            await query.message.edit_text(
                f"❌ Ошибка: {str(e)}"
            )
            state_manager.reset_state(user_id)
            cleanup_user_files(user_id)

        await state.set_state(UserStates.waiting_photo)

    @dp.callback_query(F.data == "edit_prompt")
    async def cb_edit_prompt(query: types.CallbackQuery, state: FSMContext):
        """Кнопка 'Изменить текст'"""
        user_id = query.from_user.id
        log_event("BOT_EDIT_PROMPT", user_id)

        state_manager.set_state(user_id, step="waiting_prompt")

        await query.answer()
        await query.message.answer("📝 Напиши новое описание:")
        await state.set_state(UserStates.waiting_prompt)

    @dp.callback_query(F.data == "replace_photo")
    async def cb_replace_photo(query: types.CallbackQuery, state: FSMContext):
        """Кнопка 'Заменить фото'"""
        user_id = query.from_user.id
        log_event("BOT_REPLACE_PHOTO", user_id)

        cleanup_user_files(user_id)
        state_manager.set_state(user_id, step="waiting_photo")

        await query.answer()
        await query.message.answer("📸 Отправь новое фото:")
        await state.set_state(UserStates.waiting_photo)

    @dp.callback_query(F.data == "cancel_generation")
    async def cb_cancel(query: types.CallbackQuery, state: FSMContext):
        """Кнопка 'Отмена'"""
        user_id = query.from_user.id
        log_event("BOT_CANCEL", user_id)

        cleanup_user_files(user_id)
        state_manager.reset_state(user_id)

        await query.answer()

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="📸 Загрузить фото", callback_data="start_photo")]
            ]
        )
        await query.message.answer(
            "❌ Отменено.\n\nХочешь начать заново?", reply_markup=keyboard
        )
        await state.set_state(UserStates.waiting_photo)

    # ============ ФОТО ============

    @dp.message(F.photo, StateFilter(UserStates.waiting_photo))
    async def msg_photo(message: types.Message, state: FSMContext):
        """Получить фото"""
        user_id = message.from_user.id
        log_event("BOT_PHOTO_RECEIVED", user_id)

        try:
            # Получаем самый большой размер фото
            photo = message.photo[-1]

            # Скачиваем файл с Telegram
            file_info = await bot.get_file(photo.file_id)
            photo_path = get_user_photo_path(user_id)

            # Используем встроенный метод для скачивания
            await bot.download_file(file_info.file_path, destination=photo_path)

            state_manager.set_state(
                user_id,
                step="waiting_prompt",
                photo_file_id=photo.file_id,
                photo_path=photo_path,
            )

            await message.answer(
                "✅ Фото загружено!\n\n📝 Теперь напиши, что должно происходить на видео (на русском).\n\nПримеры:\n- Красивый закат над горами с пением птиц\n- Кот прыгает по подушкам в комнате\n- Балет на сцене театра"
            )

            log_event("BOT_PHOTO_SAVED", user_id, {"path": photo_path})
            await state.set_state(UserStates.waiting_prompt)

        except Exception as e:
            print(f"[TELEGRAM-BOT] Photo download error: {str(e)}")
            await message.answer("❌ Ошибка при загрузке фото. Попробуй ещё раз.")

    # ============ ТЕКСТ ============

    @dp.message(F.text, StateFilter(UserStates.waiting_prompt))
    async def msg_prompt(message: types.Message, state: FSMContext):
        """Получить промпт"""
        user_id = message.from_user.id
        text = message.text

        log_event("BOT_PROMPT_RECEIVED", user_id, {"length": len(text)})

        # Валидируем промпт
        if len(text) < 3:
            await message.answer("❌ Описание слишком короткое. Минимум 3 символа.")
            return

        if len(text) > 2000:
            await message.answer("❌ Описание слишком длинное. Максимум 2000 символов.")
            return

        state_manager.set_state(user_id, step="confirm", prompt_text=text)

        # Показываем confirm экран
        summary_text = f"""📋 Резюме:

📸 Фото: загружено
📝 Описание: {text}
⏱️ Длительность: 6 секунд

Всё верно?"""

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="✅ Сгенерировать", callback_data="confirm_generate")],
                [InlineKeyboardButton(text="✏️ Изменить текст", callback_data="edit_prompt")],
                [InlineKeyboardButton(text="📸 Заменить фото", callback_data="replace_photo")],
                [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_generation")],
            ]
        )

        await message.answer(summary_text, reply_markup=keyboard)
        await state.set_state(UserStates.confirm)

    return bot, dp


async def run_bot():
    """Запустить бота"""
    result = await setup_bot()
    if not result:
        return

    bot, dp = result
    print("[TELEGRAM-BOT] ✅ Bot initialized, starting polling...")

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    except Exception as e:
        print(f"[TELEGRAM-BOT] Error: {str(e)}")
    finally:
        await bot.session.close()
