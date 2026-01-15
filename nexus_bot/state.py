"""
State Management для Telegram-бота
In-memory хранилище состояния пользователей с TTL
"""

from typing import Optional, Dict, Any
import asyncio
from datetime import datetime, timedelta


class UserState:
    """Состояние пользователя"""

    def __init__(self):
        self.step: str = "waiting_photo"  # waiting_photo, waiting_prompt, confirm, generating
        self.photo_file_id: Optional[str] = None
        self.photo_path: Optional[str] = None
        self.prompt_text: Optional[str] = None
        self.last_generation_id: Optional[str] = None
        self.last_generation_status: Optional[str] = None
        self.last_update: datetime = datetime.now()

        # 💰 НОВАЯ СИСТЕМА БАЛАНСА ВИДЕО
        self.video_balance: int = 0          # Оплаченные видео
        self.free_remaining: int = 3         # Бесплатные видео (триал)
        self.free_used: int = 0              # Сколько бесплатных использовано
        self.seen_examples: list = []        # Примеры которые уже показали


class StateManager:
    """Управление состоянием пользователей"""

    def __init__(self, cleanup_interval_hours: int = 1):
        self.states: Dict[int, UserState] = {}
        self.cleanup_interval = cleanup_interval_hours * 3600  # в секундах
        self._cleanup_task = None

    async def start_cleanup_task(self):
        """Запустить периодическую очистку старых состояний"""
        while True:
            await asyncio.sleep(self.cleanup_interval)
            self.cleanup()

    def get_state(self, user_id: int) -> UserState:
        """Получить или создать состояние пользователя"""
        if user_id not in self.states:
            self.states[user_id] = UserState()

        self.states[user_id].last_update = datetime.now()
        return self.states[user_id]

    def set_state(self, user_id: int, **kwargs):
        """Обновить состояние пользователя"""
        state = self.get_state(user_id)
        for key, value in kwargs.items():
            if hasattr(state, key):
                setattr(state, key, value)
        state.last_update = datetime.now()

    def reset_state(self, user_id: int):
        """Сбросить состояние пользователя"""
        self.states[user_id] = UserState()

    def delete_state(self, user_id: int):
        """Удалить состояние пользователя"""
        if user_id in self.states:
            del self.states[user_id]

    def cleanup(self):
        """Очистить старые состояния (старше 3 часов)"""
        now = datetime.now()
        max_age = timedelta(hours=3)

        users_to_delete = []
        for user_id, state in self.states.items():
            if now - state.last_update > max_age:
                users_to_delete.append(user_id)

        for user_id in users_to_delete:
            del self.states[user_id]
            print(f"[STATE] Cleaned up old state for user {user_id}")

    def get_active_count(self) -> int:
        """Получить количество активных состояний"""
        return len(self.states)


# Глобальный экземпляр
state_manager = StateManager()
