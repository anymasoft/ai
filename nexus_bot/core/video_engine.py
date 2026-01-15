"""
Video Engine - Оркестратор видео-генерации
Координирует: prompt enhancement → camera direction → MiniMax API → queue processing
"""

import os
import uuid
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any

from .prompts import prompt_enhancer
from .director import camera_director
from .minimax import minimax_client
from .queue import queue, QueueItem

print("[VIDEO-ENGINE] Initializing...")


class VideoEngine:
    """Главный движок генерации видео"""

    def __init__(self):
        self.temp_dir = "/tmp/beem-videos"
        os.makedirs(self.temp_dir, exist_ok=True)
        self._generation_status = {}  # In-memory storage генераций

    # ============ GENERATION INITIATION ============

    async def generate_video(
        self,
        user_id: int,
        photo_path: str,
        prompt_text: str,
        duration: int = 6,
    ) -> Dict[str, Any]:
        """
        Главная функция инициации генерации видео

        Args:
            user_id: ID пользователя (Telegram)
            photo_path: Путь к фото
            prompt_text: Русский текст промпта
            duration: Длительность (6 или 10)

        Returns:
            {
                "success": bool,
                "generation_id": str,
                "status": str,
                "message": str
            }
        """
        generation_id = str(uuid.uuid4())
        print(f"[ENGINE] Generation initiated: {generation_id} (user={user_id})")

        try:
            # Фаза 1: Smart Prompt Enhancement
            print(f"[ENGINE] Phase 1: Enhancing prompt...")
            enhanced_prompt = await prompt_enhancer.enhance_prompt(prompt_text, mode="prompt")
            print(f"[ENGINE] prompt_enhanced: {generation_id}")

            # Фаза 2: Camera Director (только для PROMPT MODE)
            print(f"[ENGINE] Phase 2: Compiling camera commands...")
            cinematic_prompt = await camera_director.compile(enhanced_prompt)
            print(f"[ENGINE] camera_selected: {generation_id}")

            # Добавляем в очередь
            queue_item = QueueItem(
                generation_id=generation_id,
                user_id=user_id,
                prompt=cinematic_prompt,
                photo_path=photo_path,
                duration=duration,
            )

            await queue.enqueue(queue_item)

            # Сохраняем status
            self._generation_status[generation_id] = {
                "status": "queued",
                "user_id": user_id,
                "created_at": datetime.now(),
                "prompt": prompt_text,
                "prompt_enhanced": enhanced_prompt,
                "prompt_cinematic": cinematic_prompt,
            }

            print(f"[ENGINE] Generation queued: {generation_id}")

            return {
                "success": True,
                "generation_id": generation_id,
                "status": "queued",
                "message": "Генерация добавлена в очередь",
            }

        except Exception as e:
            print(f"[ENGINE] Generation failed: {str(e)}")
            self._generation_status[generation_id] = {
                "status": "failed",
                "user_id": user_id,
                "error": str(e),
            }
            return {
                "success": False,
                "generation_id": generation_id,
                "status": "failed",
                "message": f"Ошибка: {str(e)}",
            }

    # ============ QUEUE PROCESSING ============

    async def process_queue(self) -> None:
        """
        Обработчик очереди (работает в фоне)
        Рекурсивно обрабатывает генерации с concurrency=1
        """
        print("[ENGINE] Queue processor started")

        while True:
            try:
                # Получаем следующий элемент из очереди
                queue_item = await queue.dequeue()

                if not queue_item:
                    # Очередь пуста - ждем перед следующей проверкой
                    await asyncio.sleep(1)
                    continue

                # Обрабатываем генерацию
                await self._process_generation(queue_item)

            except Exception as e:
                print(f"[ENGINE] Queue processor error: {str(e)}")
                await asyncio.sleep(2)

    async def _process_generation(self, queue_item: QueueItem) -> None:
        """Обработка одной генерации"""
        gen_id = queue_item.generation_id
        user_id = queue_item.user_id

        try:
            print(f"[ENGINE] Processing generation: {gen_id}")

            # Обновляем статус
            self._generation_status[gen_id]["status"] = "processing"

            # Фаза 3: Вызов MiniMax
            print(f"[ENGINE] Phase 3: Calling MiniMax...")
            minimax_response = await minimax_client.generate_from_prompt(
                queue_item.photo_path,
                queue_item.prompt,
                queue_item.duration,
            )

            if not minimax_response.get("success"):
                raise Exception(minimax_response.get("error", "MiniMax error"))

            minimax_generation_id = minimax_response.get("generation_id")
            print(f"[ENGINE] minimax_request: {gen_id} → {minimax_generation_id}")

            # Обновляем статус
            self._generation_status[gen_id].update({
                "status": "processing",
                "minimax_generation_id": minimax_generation_id,
            })

            # Фаза 4: Polling для получения результата
            print(f"[ENGINE] Phase 4: Polling MiniMax status...")
            max_attempts = 120  # 2 минуты с интервалом 1 сек
            video_url = None

            for attempt in range(max_attempts):
                status_response = await minimax_client.get_generation_status(
                    minimax_generation_id
                )

                status = status_response.get("status")
                self._generation_status[gen_id]["minimax_status"] = status

                if status == "done":
                    video_url = status_response.get("video_url")
                    print(f"[ENGINE] minimax_done: {gen_id}")
                    break

                if status == "failed":
                    raise Exception(status_response.get("error", "MiniMax generation failed"))

                await asyncio.sleep(1)

            if not video_url:
                raise Exception("MiniMax polling timeout")

            # Фаза 5: Скачивание видео
            print(f"[ENGINE] Phase 5: Downloading video...")
            video_path = os.path.join(self.temp_dir, f"{gen_id}.mp4")

            success = await minimax_client.download_video(video_url, video_path)
            if not success:
                raise Exception("Failed to download video")

            # Обновляем финальный статус
            self._generation_status[gen_id].update({
                "status": "done",
                "video_path": video_path,
                "video_url": video_url,
                "completed_at": datetime.now(),
            })

            print(f"[ENGINE] ✅ Generation complete: {gen_id}")

        except Exception as e:
            print(f"[ENGINE] ❌ Generation failed: {gen_id} - {str(e)}")
            self._generation_status[gen_id].update({
                "status": "failed",
                "error": str(e),
            })

    # ============ STATUS TRACKING ============

    def get_generation_status(self, generation_id: str) -> Dict[str, Any]:
        """Получить статус генерации"""
        return self._generation_status.get(
            generation_id,
            {"status": "unknown", "error": "Generation not found"}
        )

    def get_generation_video_path(self, generation_id: str) -> Optional[str]:
        """Получить путь к видео файлу (если готово)"""
        status_info = self._generation_status.get(generation_id)
        if status_info and status_info.get("status") == "done":
            return status_info.get("video_path")
        return None

    # ============ STATISTICS ============

    async def get_stats(self) -> Dict[str, Any]:
        """Получить статистику"""
        queue_size = await queue.get_size()
        is_queue_running = await queue.is_running()

        total_generations = len(self._generation_status)
        completed = sum(
            1 for g in self._generation_status.values()
            if g.get("status") == "done"
        )
        failed = sum(
            1 for g in self._generation_status.values()
            if g.get("status") == "failed"
        )

        return {
            "total_generations": total_generations,
            "completed": completed,
            "failed": failed,
            "queue_size": queue_size,
            "queue_running": is_queue_running,
        }


# Глобальный экземпляр
video_engine = VideoEngine()


# ============ BACKGROUND TASK ============

async def start_video_engine():
    """Запустить видео-движок (должен быть запущен в фоне)"""
    print("[VIDEO-ENGINE] ✅ Video engine started")
    await queue.set_running(True)
    # Запускаем обработчик очереди в фоне
    asyncio.create_task(video_engine.process_queue())
