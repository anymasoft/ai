"""
State Management для Telegram-бота
Thin wrapper над SQLite БД
"""

from typing import Optional, Dict, Any
import asyncio
from datetime import datetime, timedelta
from db import get_user, init_db, get_or_create_user


class UserState:
    """Состояние пользователя - reads from DB, not in-memory"""

    def __init__(self, telegram_id: int):
        self.telegram_id = telegram_id
        self.step: str = "waiting_photo"  # waiting_photo, waiting_prompt, confirm, generating
        self.photo_file_id: Optional[str] = None
        self.photo_path: Optional[str] = None
        self.prompt_text: Optional[str] = None
        self.last_generation_id: Optional[str] = None
        self.last_generation_status: Optional[str] = None
        self.last_update: datetime = datetime.now()

        # 💰 БАЛАНС ВИДЕО - читается из БД
        # self.video_balance, self.free_remaining берутся из db при необходимости
        self.seen_examples: list = []  # В памяти, для текущей сессии

        # 💳 ПЛАТЕЖИ - для polling статуса
        self.pending_payment_id: Optional[str] = None  # ID платежа в процессе (для polling)
        self.pending_payment_timestamp: Optional[datetime] = None  # Когда создан платёж (для timeout)

    @property
    def video_balance(self) -> int:
        """Получить баланс оплаченных видео из БД"""
        user = get_user(self.telegram_id)
        return user["video_balance"] if user else 0

    @property
    def free_remaining(self) -> int:
        """Получить оставшиеся бесплатные видео из БД"""
        user = get_user(self.telegram_id)
        return user["free_remaining"] if user else 3

    @property
    def free_used(self) -> int:
        """Получить использованные бесплатные видео из БД"""
        user = get_user(self.telegram_id)
        return user["free_used"] if user else 0


class StateManager:
    """Управление состоянием пользователей (тонкий wrapper над БД)"""

    def __init__(self, cleanup_interval_hours: int = 1):
        self.states: Dict[int, UserState] = {}  # Кэш в памяти (FSM state только)
        self.cleanup_interval = cleanup_interval_hours * 3600
        self._cleanup_task = None

    async def start_cleanup_task(self):
        """Запустить периодическую очистку"""
        while True:
            await asyncio.sleep(self.cleanup_interval)
            self.cleanup()

    def get_state(self, user_id: int) -> UserState:
        """Получить состояние пользователя (создаёт в БД если не существует)"""
        if user_id not in self.states:
            # Создаём в БД если не существует
            user = get_user(user_id)
            if not user:
                get_or_create_user(user_id)

            self.states[user_id] = UserState(user_id)

        self.states[user_id].last_update = datetime.now()
        return self.states[user_id]

    def set_state(self, user_id: int, **kwargs):
        """Обновить состояние пользователя (только FSM поля)"""
        state = self.get_state(user_id)
        for key, value in kwargs.items():
            # Только FSM-поля в памяти, баланс в БД
            if key in ["step", "photo_file_id", "photo_path", "prompt_text", "last_generation_id", "last_generation_status", "seen_examples"]:
                setattr(state, key, value)
        state.last_update = datetime.now()

    def reset_state(self, user_id: int):
        """Сбросить состояние пользователя"""
        if user_id in self.states:
            self.states[user_id] = UserState(user_id)

    def delete_state(self, user_id: int):
        """Удалить состояние из кэша (БД остаётся)"""
        if user_id in self.states:
            del self.states[user_id]

    def cleanup(self):
        """Очистить старые состояния из кэша"""
        now = datetime.now()
        max_age = timedelta(hours=3)

        users_to_delete = []
        for user_id, state in self.states.items():
            if now - state.last_update > max_age:
                users_to_delete.append(user_id)

        for user_id in users_to_delete:
            del self.states[user_id]
            print(f"[STATE] Cleaned up cached state for user {user_id}")

    def get_active_count(self) -> int:
        """Получить количество активных кэшированных состояний"""
        return len(self.states)


# Глобальный экземпляр
state_manager = StateManager()
