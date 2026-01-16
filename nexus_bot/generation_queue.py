"""
Queue система для управления генерациями видео
Гарантирует, что только одна генерация обрабатывается одновременно (concurrency=1)
"""

import asyncio
from typing import List, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class QueueItem:
    """Элемент очереди"""
    generation_id: str
    user_id: int
    prompt: str
    photo_path: str
    duration: int = 6
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()


class GenerationQueue:
    """Менеджер очереди генераций"""

    def __init__(self):
        self._queue: List[QueueItem] = []
        self._is_running = False
        self._lock = asyncio.Lock()

    async def enqueue(self, item: QueueItem) -> None:
        """Добавить в очередь"""
        async with self._lock:
            self._queue.append(item)
            print(f"[QUEUE] Added generation {item.generation_id} (queue size: {len(self._queue)})")

    async def dequeue(self) -> Optional[QueueItem]:
        """Удалить и вернуть первый элемент"""
        async with self._lock:
            if self._queue:
                item = self._queue.pop(0)
                print(f"[QUEUE] Dequeued generation {item.generation_id} (remaining: {len(self._queue)})")
                return item
            return None

    async def peek(self) -> Optional[QueueItem]:
        """Посмотреть первый элемент без удаления"""
        async with self._lock:
            return self._queue[0] if self._queue else None

    async def set_running(self, is_running: bool) -> None:
        """Установить флаг обработки"""
        async with self._lock:
            self._is_running = is_running

    async def is_running(self) -> bool:
        """Проверить, запущена ли обработка"""
        async with self._lock:
            return self._is_running

    async def get_size(self) -> int:
        """Получить размер очереди"""
        async with self._lock:
            return len(self._queue)

    async def clear(self) -> None:
        """Очистить очередь (для тестов)"""
        async with self._lock:
            self._queue.clear()

    async def get_all(self) -> List[QueueItem]:
        """Получить все элементы очереди"""
        async with self._lock:
            return self._queue.copy()


# Глобальный экземпляр
queue = GenerationQueue()
