"""
API клиент для взаимодействия с Astro backend
"""

import os
import aiohttp
from typing import Optional, Dict, Any
import asyncio


class BeemAPIClient:
    """Клиент для общения с Beem API"""

    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv("BEEM_BASE_URL", "http://localhost:4321")

    async def generate_video(
        self,
        telegram_user_id: int,
        photo_path: str,
        prompt: str,
        duration: int = 6,
    ) -> Dict[str, Any]:
        """
        Запустить генерацию видео

        Args:
            telegram_user_id: ID Telegram пользователя
            photo_path: Путь к локальному JPEG файлу
            prompt: Текстовый промпт
            duration: Длительность видео (6 или 10)

        Returns:
            {success, generationId, status, cost, error?}
        """
        try:
            # Проверяем что файл существует
            if not os.path.exists(photo_path):
                raise FileNotFoundError(f"Photo file not found: {photo_path}")

            # Создаём multipart request
            async with aiohttp.ClientSession() as session:
                with open(photo_path, "rb") as f:
                    form = aiohttp.FormData()
                    form.add_field("photo", f, filename="photo.jpg", content_type="image/jpeg")
                    form.add_field("telegram_user_id", str(telegram_user_id))
                    form.add_field("prompt", prompt)
                    form.add_field("duration", str(duration))

                    async with session.post(
                        f"{self.base_url}/api/telegram/generate",
                        data=form,
                        timeout=aiohttp.ClientTimeout(total=30),
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            print(f"[TELEGRAM-API] Generation started: {data.get('generationId')}")
                            return data
                        else:
                            error_text = await resp.text()
                            raise Exception(f"HTTP {resp.status}: {error_text}")

        except Exception as e:
            print(f"[TELEGRAM-API] Generate error: {str(e)}")
            raise

    async def get_generation_status(self, generation_id: str) -> Dict[str, Any]:
        """
        Получить статус генерации

        Args:
            generation_id: ID генерации

        Returns:
            {success, generationId, status, video_url?, error?}
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/api/telegram/status",
                    params={"generation_id": generation_id},
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        error_text = await resp.text()
                        raise Exception(f"HTTP {resp.status}: {error_text}")

        except Exception as e:
            print(f"[TELEGRAM-API] Status error: {str(e)}")
            raise

    async def download_video(self, video_url: str, output_path: str) -> None:
        """
        Скачать видео по URL

        Args:
            video_url: URL видео
            output_path: Путь для сохранения
        """
        try:
            # Если URL локальный путь, копируем файл напрямую
            if video_url.startswith("/storage"):
                import shutil

                file_path = video_url.replace(
                    "/storage", os.path.join(os.getcwd(), "storage")
                )
                if os.path.exists(file_path):
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    shutil.copy(file_path, output_path)
                    print(f"[TELEGRAM-API] Video copied from local path: {file_path}")
                    return

            # Иначе скачиваем по HTTP
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    video_url,
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as resp:
                    if resp.status == 200:
                        os.makedirs(os.path.dirname(output_path), exist_ok=True)
                        with open(output_path, "wb") as f:
                            f.write(await resp.read())
                        print(f"[TELEGRAM-API] Video downloaded: {output_path}")
                    else:
                        raise Exception(f"HTTP {resp.status}")

        except Exception as e:
            print(f"[TELEGRAM-API] Download error: {str(e)}")
            raise

    async def check_health(self) -> bool:
        """Проверить доступность backend'а"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.base_url,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    return resp.status == 200
        except:
            return False


# Глобальный экземпляр
api_client = BeemAPIClient()
