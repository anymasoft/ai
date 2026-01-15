"""
MiniMax API Client - Вызовы к MiniMax для генерации видео
Поддерживает два режима: template и prompt
"""

import os
import base64
import asyncio
from typing import Optional, Dict, Any
import aiohttp

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
MINIMAX_API_URL = "https://api.minimax.io/v1"


class MinimaxVideoClient:
    """Клиент для работы с MiniMax Video API"""

    def __init__(self, api_key: str = None, callback_url: str = None):
        self.api_key = api_key or MINIMAX_API_KEY
        self.callback_url = callback_url or os.getenv("MINIMAX_CALLBACK_URL")
        self.timeout = aiohttp.ClientTimeout(total=30)

    # ============ IMAGE CONVERSION ============

    def _image_to_base64(self, image_path: str) -> str:
        """Конвертирует JPEG изображение в base64 data URL"""
        try:
            with open(image_path, "rb") as f:
                image_data = f.read()
            base64_data = base64.b64encode(image_data).decode("utf-8")
            return f"data:image/jpeg;base64,{base64_data}"
        except Exception as e:
            print(f"[MINIMAX] Image conversion error: {str(e)}")
            raise

    # ============ PROMPT MODE ============

    async def generate_from_prompt(
        self,
        image_path: str,
        prompt: str,
        duration: int = 6,
    ) -> Dict[str, Any]:
        """
        Генерирует видео из фото + текстового промпта (PROMPT MODE)

        Args:
            image_path: Путь к JPEG файлу
            prompt: Текстовый промпт (с camera commands)
            duration: Длительность видео (6 или 10 сек)

        Returns:
            {
                "success": bool,
                "generation_id": str,
                "status": str,
                "cost": float,
                "error": str (if failed)
            }
        """
        try:
            image_data_url = self._image_to_base64(image_path)

            payload = {
                "model": "MiniMax-Hailuo-02",
                "first_frame_image": image_data_url,
                "prompt": prompt,
                "duration": duration,
                "resolution": "768P",
                "callback_url": self.callback_url,
            }

            response = await self._post_to_minimax("/video_generation", payload)

            if response.get("success"):
                generation_id = response.get("data", {}).get("task_id") or response.get("generation_id")
                print(f"[MINIMAX] Prompt mode - generation started: {generation_id}")
                return {
                    "success": True,
                    "generation_id": generation_id,
                    "status": "queued",
                    "cost": response.get("cost", 0),
                }
            else:
                error = response.get("message", response.get("error", "Unknown error"))
                print(f"[MINIMAX] Prompt mode - error: {error}")
                print(f"[MINIMAX] Full response: {response}")
                return {
                    "success": False,
                    "generation_id": None,
                    "status": "failed",
                    "error": error,
                }

        except Exception as e:
            print(f"[MINIMAX] Prompt mode exception: {str(e)}")
            return {
                "success": False,
                "generation_id": None,
                "status": "error",
                "error": str(e),
            }

    # ============ STATUS CHECKING ============

    async def get_generation_status(self, generation_id: str) -> Dict[str, Any]:
        """
        Получить статус генерации

        Returns:
            {
                "success": bool,
                "generation_id": str,
                "status": "processing" | "done" | "failed",
                "video_url": str (if done),
                "error": str (if failed)
            }
        """
        try:
            params = {"task_id": generation_id}

            response = await self._get_from_minimax("/video_generation", params)

            status = response.get("status", "processing").lower()
            # Нормализуем статусы
            if status in ["success", "complete"]:
                status = "done"

            result = {
                "success": True,
                "generation_id": generation_id,
                "status": status,
            }

            # Если готово - добавляем URL видео
            if status == "done":
                video_url = response.get("data", {}).get("video_url") or response.get("video_url")
                result["video_url"] = video_url

            # Если ошибка - добавляем сообщение
            if status == "failed":
                result["error"] = response.get("message", "Generation failed")

            print(f"[MINIMAX] Status check - {generation_id}: {status}")
            return result

        except Exception as e:
            print(f"[MINIMAX] Status check exception: {str(e)}")
            return {
                "success": False,
                "generation_id": generation_id,
                "status": "error",
                "error": str(e),
            }

    # ============ VIDEO DOWNLOAD ============

    async def download_video(self, video_url: str, output_path: str) -> bool:
        """
        Скачивает видео по URL

        Args:
            video_url: URL видео
            output_path: Путь для сохранения

        Returns:
            bool: True если успешно, False если ошибка
        """
        try:
            # Если локальный путь - копируем напрямую
            if video_url.startswith("/storage"):
                import shutil

                file_path = video_url.replace(
                    "/storage", os.path.join(os.getcwd(), "storage")
                )
                if os.path.exists(file_path):
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    shutil.copy(file_path, output_path)
                    print(f"[MINIMAX] Video copied from local: {output_path}")
                    return True

            # Иначе скачиваем по HTTP
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(video_url) as resp:
                    if resp.status == 200:
                        os.makedirs(os.path.dirname(output_path), exist_ok=True)
                        with open(output_path, "wb") as f:
                            f.write(await resp.read())
                        print(f"[MINIMAX] Video downloaded: {output_path}")
                        return True
                    else:
                        print(f"[MINIMAX] Download failed: HTTP {resp.status}")
                        return False

        except Exception as e:
            print(f"[MINIMAX] Download exception: {str(e)}")
            return False

    # ============ PRIVATE METHODS ============

    async def _post_to_minimax(self, endpoint: str, payload: Dict) -> Dict:
        """Отправляет POST запрос к MiniMax API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        url = f"{MINIMAX_API_URL}{endpoint}"
        print(f"[MINIMAX] POST {url}")

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                url,
                json=payload,
                headers=headers,
            ) as resp:
                print(f"[MINIMAX] POST response status: {resp.status}")
                response_data = await resp.json()
                print(f"[MINIMAX] POST response body: {response_data}")
                return response_data

    async def _get_from_minimax(self, endpoint: str, params: Dict) -> Dict:
        """Отправляет GET запрос к MiniMax API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        url = f"{MINIMAX_API_URL}{endpoint}"
        print(f"[MINIMAX] GET {url} params={params}")

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.get(
                url,
                params=params,
                headers=headers,
            ) as resp:
                print(f"[MINIMAX] GET response status: {resp.status}")
                response_data = await resp.json()
                print(f"[MINIMAX] GET response body: {response_data}")
                return response_data

    # ============ HEALTH CHECK ============

    async def check_health(self) -> bool:
        """Проверить доступность MiniMax API"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.get(f"{MINIMAX_API_URL}/status") as resp:
                    return resp.status == 200
        except:
            return False


# Глобальный экземпляр
minimax_client = MinimaxVideoClient()
